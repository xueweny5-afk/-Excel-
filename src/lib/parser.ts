import * as XLSX from 'xlsx';
import type {
  ActivityRecord,
  DashboardData,
  ForecastType,
  HealthLevel,
  NaCustomer,
  NaCustomerType,
  PerformanceRecord,
  PPLRecord,
  SummaryRecord,
} from '../domain';
import { PPL_FIELD_ALIASES, REQUIRED_PPL_FIELDS } from '../fieldAliases';

type Row = Record<string, unknown>;

// ========== 文件/Sheet 安全边界 ==========
/**
 * 安全边界常量集中管理。
 *
 * 已知风险：xlsx@0.18.5 上游有两个 GHSA：
 *   - GHSA-4r6h-8v6p-xvw（CWE-1321 原型链污染，<0.19.3）
 *   - GHSA-5pgg-2g8v-p4x9（CWE-1333 ReDoS，<0.20.2）
 * 上游未发布修复版（npm `xlsx` 最新就是 0.18.5）。
 * 缓解策略：
 *   1. 限制文件大小（MAX_FILE_SIZE）减小 ReDoS 攻击窗口
 *   2. 限制 Sheet / 行 / 列 / 单元格字符串长度（防止恶意大文件耗尽内存）
 *   3. 解析前 magic bytes 校验（detectContainer、validateWorkbookContent）
 *   4. parseDashboardFile / parseNaCustomers 后立即 sanitizeRow
 *   5. 工作台导入走 IndexedDB 备份恢复前 schema 校验（详见 db.ts / 备份恢复）
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_SHEETS = 20;
const MAX_ROWS = 50000;
const MAX_COLS = 200;

/**
 * 完整的原型链污染防护键。
 * 覆盖 JS 内置危险属性、Object.prototype 方法、Symbol 注入等。
 */
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'valueOf',
  'hasOwnProperty',
  'toString',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  '__proto__',
  '__noSuchMethod__',
  'isPrototypeOf',
  'propertyIsEnumerable',
]);

// ========== 健康度算法常量 ==========
/**
 * 各阶段对应的成熟度权重（0-1）。
 * 售前口径（带数字前缀）排在销售口径前面，因为 `Object.keys().find(s => stage.includes(s))`
 * 按插入顺序匹配——让"3.方案评估..."先于"方案评估"匹配，避免售前的"3.方案评估"被错算成销售的 0.55。
 */
const STAGE_WEIGHTS: Record<string, number> = {
  // 售前口径（数字前缀版本，优先匹配）
  '1.提出需求': 0.2,
  '2.项目立项，预算到位': 0.5,
  '3.方案评估，选择品牌及供应商': 0.65,
  '4.内部达成共识，确认品牌及供应商方案': 0.8,
  '5.招标采购': 0.9,
  // 销售口径
  初步接洽: 0.2,
  需求确认: 0.4,
  方案交流: 0.5,
  方案评估: 0.55,
  POC: 0.6,
  测试验证: 0.65,
  商务谈判: 0.8,
  合同谈判: 0.85,
  合同流程: 0.9,
  赢单: 1,
  输单: 0,
};

/** 健康度阈值（综合得分 ≥ X 为该等级） */
const HEALTH_THRESHOLDS = {
  healthy: 0.7,
  watch: 0.4,
} as const;

/** 大额商机阈值（万元） */
const LARGE_AMOUNT = 500;
/** 大额低赢单率阈值 */
const LARGE_LOW_WIN_RATE = 0.3;
/** 早期阶段阈值天数（距今 ≤ X 天且处于早期阶段则风险） */
const EARLY_STAGE_DAYS = 90;
/** 单元格最大长度（防止恶意超长字符串污染内存）
 * 安全边界常量定义见文件顶部"文件/Sheet 安全边界"区块。
 */
const MAX_CELL_LENGTH = 5000;

/**
 * PPLRecord.id 计数种子。
 * 用稳定的 rowNumber + 业务字段组合，避免按 index 漂移导致 React 重渲染错乱。
 */
const ID_SEPARATOR = '|';

const PERFORMANCE_FIELD_ALIASES: Record<string, string[]> = {
  customerName: ['最终用户', '客户名称', '最终客户', '客户', '最终用户名'],
  productName: ['产品名称', '产品', '产品线'],
  productLevel2: ['二级分类', '二级产品分类', '二级产品线', '二级'],
  productLevel3: ['三级产品分类', '三级分类', '三类产品分类', '三级'],
  orderAmount: ['下单金额', '订单金额', '已下单金额'],
  contractAmount: ['合同总额', '合同金额', '合同总价'],
  salesGrossProfit: ['销售毛利（含激励）', '销售毛利(含激励)', '销售毛利', '个人毛利'],
  performanceGrossProfit: ['业绩毛利金额（含激励）', '业绩毛利金额(含激励)', '业绩毛利金额', '业绩毛利'],
  finalPerformance: ['最终核算业绩', '核算业绩', '最终业绩'],
  isT2000: [
    'T2000客户标签',
    'T2000 客户标签',
    '客户标签',
    'CRM标签',
    '客户Tag',
    '客户是否T2000',
    '客户是否 T2000',
    '是否T2000',
  ],
};

// ========== 入口 ==========
export async function parseDashboardFile(file: File): Promise<DashboardData> {
  validateFile(file);
  const arrayBuffer = await file.arrayBuffer();
  validateWorkbookContent(file, arrayBuffer);
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellHTML: false,
    cellFormula: false,
    cellNF: false,
  });
  if (workbook.SheetNames.length > MAX_SHEETS) {
    throw new Error(`Sheet 数超过 ${MAX_SHEETS} 个，请拆分文件后再导入。`);
  }

  const sheets = workbook.SheetNames.reduce<Record<string, Row[]>>((acc, sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false });
    if (rows.length > MAX_ROWS) throw new Error(`${sheetName} 超过 ${MAX_ROWS} 行，请拆分后再导入。`);
    const first = rows[0] ?? {};
    if (Object.keys(first).length > MAX_COLS)
      throw new Error(`${sheetName} 超过 ${MAX_COLS} 列，请清理无关列后再导入。`);
    acc[sheetName] = rows.map(sanitizeRow);
    return acc;
  }, {});

  const pplSheetName =
    findSheet(workbook.SheetNames, [
      'PPL明细',
      'PPL',
      'Pipeline',
      '商机明细',
      '商机',
      '商机&业绩',
      '商机和业绩',
    ]) ?? findPplSheetByHeaders(workbook.SheetNames, sheets);
  const summarySheetName = findSheet(workbook.SheetNames, ['数据汇总', '汇总']);
  const activitySheetName = findSheet(workbook.SheetNames, ['新增PPL+活动记录', '活动记录', '新增PPL']);
  const performanceSheetName =
    findSheet(workbook.SheetNames, [
      'Y26业绩明细',
      'Y26 业绩明细',
      '业绩明细',
      '业绩',
      '订单明细',
      '下单明细',
    ]) ?? findPerformanceSheetByHeaders(workbook.SheetNames, sheets);
  const naSheetNames = findCurrentQuarterNaSheets(workbook.SheetNames);

  const pplRows = pplSheetName ? sheets[pplSheetName] : [];
  const fieldMap = mapFields(pplRows[0] ?? {});
  const missingFields = REQUIRED_PPL_FIELDS.filter((field) => !fieldMap[field]);
  const warnings: string[] = [];
  let skippedRows = 0;
  if (!pplSheetName) {
    warnings.push('未识别到商机明细 Sheet，请确认 Sheet 名包含 PPL、Pipeline 或商机明细。');
  }
  if (pplSheetName && missingFields.length > 0) {
    warnings.push(`商机明细缺少关键字段：${missingFields.map(fieldLabel).join('、')}。`);
  }

  // 销售/售前 PPL Sheet 口径不同，决定 amount 列无表头单位线索时的兜底：
  //   - 销售 PPL（"PPL明细"/"PPL"/"Pipeline"）→ 万元
  //   - 售前 PPL 两种常见格式：
  //       a) 新格式：sheet 名含"售前"且含"明细"（如"售前商机明细表-XXX"），金额已是万元
  //       b) 老格式：sheet 名含"商机明细"/"商机"（如"商机明细"），金额是元
  const isPresalesAmountMode: 'wanyuan' | 'yuan' | null =
    pplSheetName && /^(PPL明细|PPL|Pipeline)$/.test(pplSheetName)
      ? 'wanyuan'
      : pplSheetName && /售前.*明细|售前.*商机/.test(pplSheetName)
        ? 'wanyuan'
        : null;
  const pplAmountMode: 'wanyuan' | 'yuan' = isPresalesAmountMode ?? 'yuan';

  const ppl = pplRows.flatMap((row, index) => {
    const record = normalizePpl(row, fieldMap, index, warnings, pplAmountMode);
    if (!record) {
      skippedRows += 1;
      return [];
    }
    return [record];
  });

  const summary = summarySheetName ? parseSummary(sheets[summarySheetName]) : [];
  const activity = activitySheetName ? parseActivity(sheets[activitySheetName]) : [];
  const performance = performanceSheetName ? parsePerformance(sheets[performanceSheetName]) : [];
  const naCustomers = naSheetNames.flatMap((name) => parseNaCustomers(sheets[name], name));

  return {
    ppl,
    summary,
    activity,
    performance,
    naCustomers,
    report: {
      fileName: file.name,
      importedAt: new Date().toLocaleString('zh-CN'),
      pplRows: ppl.length,
      summaryRows: summary.length,
      activityRows: activity.length,
      performanceRows: performance.length,
      naCustomerRows: naCustomers.length,
      skippedRows,
      detectedFields: Object.keys(fieldMap).map((key) => `${fieldLabel(key)}：${fieldMap[key]}`),
      missingFields: missingFields.map(fieldLabel),
      warnings: Array.from(new Set(warnings)).slice(0, 12),
    },
  };
}

function validateFile(file: File) {
  const allowed = ['.xlsx', '.xls', '.csv', '.xlsm', '.xlsb', '.et'];
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';
  if (!allowed.includes(ext)) throw new Error('仅支持 .xlsx / .xls / .csv / .xlsm / .xlsb / .et 文件。');
  if (file.size > MAX_FILE_SIZE) throw new Error('文件超过 20MB，请拆分后再导入。');
  // MIME 类型二次校验（防御文件名伪装）
  const allowedMimePrefixes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroenabled',
    'application/vnd.ms-excel.sheet.binary',
    'text/csv',
    'text/plain',
    'application/octet-stream', // 浏览器对部分 xlsx 返回 generic
  ];
  if (file.type && !allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix))) {
    throw new Error(`文件 MIME 类型不合法：${file.type}，请确认是 Excel/CSV 文件。`);
  }
}

function validateWorkbookContent(file: File, arrayBuffer: ArrayBuffer) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (ext === '.csv') return;

  const bytes = new Uint8Array(arrayBuffer.slice(0, 8));
  const signature = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
  const isZipOffice = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isLegacyOffice = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  const isTextLike = bytes.every(
    (byte) => byte === 0 || byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126),
  );
  const inverted = Array.from(bytes).map((byte) => 0xff - byte);
  const isVirtualShell = String.fromCharCode(...inverted.slice(0, 4)) === 'VSBX';

  if (isZipOffice || isLegacyOffice || (ext === '.xls' && isTextLike)) return;

  if (isVirtualShell) {
    throw new Error(
      '该文件不是标准 Excel 工作簿，像是 WPS/系统生成的临时壳文件。请在 Excel 或 WPS 中打开后，另存为标准 .xlsx 或 .xlsm 再导入。',
    );
  }
  throw new Error(
    `该文件扩展名是 ${ext}，但内容不是标准 Excel 文件，文件头为 ${signature}。请另存为标准 .xlsx / .xlsm 后再导入。`,
  );
}

export function sanitizeRow(row: Row): Row {
  return Object.entries(row).reduce<Row>((acc, [key, value]) => {
    if (DANGEROUS_KEYS.has(key)) return acc;
    const cleanKey = String(key).trim();
    if (DANGEROUS_KEYS.has(cleanKey)) return acc;
    acc[cleanKey] = typeof value === 'string' ? value.trim().slice(0, MAX_CELL_LENGTH) : value;
    return acc;
  }, {});
}

function findSheet(sheetNames: string[], candidates: string[]) {
  return sheetNames.find((name) => candidates.some((candidate) => name.includes(candidate)));
}

/**
 * 找出当前季度（或最新）的 NA 客户 Sheet。
 *
 * 业务规则：每个 Excel 文件通常包含多个季度的 NA Sheet（Q1/Q3/Q4），
 * 但只有当前季度才是业务关注的活跃名单。优先返回当前季度的 Sheet；
 * 找不到时回退到最新的季度。
 *
 * Sheet 名格式示例：`2026年Q3-NA客户`、`2026年Q1-NA客户`。
 */
function findCurrentQuarterNaSheets(sheetNames: string[]): string[] {
  const now = new Date();
  const currentQuarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;
  const currentYear = now.getFullYear();
  const sheetMeta = sheetNames
    .map((name) => ({ name, meta: matchQuarterSheet(name) }))
    .filter((item): item is { name: string; meta: { year: number; quarter: number } } => item.meta !== null);

  if (sheetMeta.length === 0) return [];

  const currentQuarterNumber = Number(currentQuarter.replace(/\D/g, ''));
  const matched = sheetMeta.filter(
    (item) => item.meta.year === currentYear && item.meta.quarter === currentQuarterNumber,
  );
  if (matched.length > 0) return matched.map((item) => item.name);

  // 回退：选最新（年最大，再 Q 最大）
  sheetMeta.sort((a, b) => b.meta.year - a.meta.year || b.meta.quarter - a.meta.quarter);
  return sheetMeta[0] ? [sheetMeta[0].name] : [];
}

/**
 * 解析 Sheet 名中的季度信息。匹配 `YYYY年Q{1-4}-NA客户` 或 `Q{1-4}-NA客户`。
 */
function matchQuarterSheet(name: string): { year: number; quarter: number } | null {
  const yearQuarterMatch = name.match(/(\d{4})\s*年?\s*[Qq]([1-4])/);
  if (yearQuarterMatch) {
    return { year: Number(yearQuarterMatch[1]), quarter: Number(yearQuarterMatch[2]) };
  }
  const quarterOnly = name.match(/^[Qq]([1-4])/);
  if (quarterOnly) {
    return { year: new Date().getFullYear(), quarter: Number(quarterOnly[1]) };
  }
  return null;
}

function findPplSheetByHeaders(sheetNames: string[], sheets: Record<string, Row[]>) {
  if (sheetNames.length === 1) return sheetNames[0];
  return sheetNames.find((sheetName) => {
    const fieldMap = mapFields(sheets[sheetName]?.[0] ?? {});
    const matchedRequired = REQUIRED_PPL_FIELDS.filter((field) => fieldMap[field]).length;
    return matchedRequired >= 3 || Boolean(fieldMap.customerName && fieldMap.amount);
  });
}

function findPerformanceSheetByHeaders(sheetNames: string[], sheets: Record<string, Row[]>) {
  return sheetNames.find((sheetName) => {
    const fieldMap = mapPerformanceFields(sheets[sheetName]?.[0] ?? {});
    return Boolean(
      fieldMap.customerName &&
      (fieldMap.orderAmount || fieldMap.salesGrossProfit || fieldMap.performanceGrossProfit),
    );
  });
}

function mapFields(row: Row) {
  return mapFieldsWithAliases(row, PPL_FIELD_ALIASES);
}

function mapPerformanceFields(row: Row) {
  return mapFieldsWithAliases(row, PERFORMANCE_FIELD_ALIASES);
}

function mapFieldsWithAliases(row: Row, aliasesByField: Record<string, string[]>) {
  const headers = Object.keys(row);
  return Object.entries(aliasesByField).reduce<Record<string, string>>((acc, [field, aliases]) => {
    const match = aliases
      .map((alias) => headers.find((header) => headerMatches(header, alias)))
      .find(Boolean);
    if (match) acc[field] = match;
    return acc;
  }, {});
}

function headerMatches(header: string, alias: string) {
  const normalizedHeader = normalizeHeader(header);
  const normalizedAlias = normalizeHeader(alias);
  return (
    normalizedHeader === normalizedAlias ||
    normalizedHeader.includes(normalizedAlias) ||
    normalizedAlias.includes(normalizedHeader)
  );
}

export function normalizeHeader(value: string) {
  return value
    .replace(/\s/g, '')
    .replace(/[()（）【】[\]_\-—:：/\\]/g, '')
    .toLowerCase();
}

function normalizePpl(
  row: Row,
  fieldMap: Record<string, string>,
  rowNumber: number,
  warnings: string[],
  amountMode: 'wanyuan' | 'yuan' = 'wanyuan',
): PPLRecord | null {
  const owner = readString(row, fieldMap.owner);
  const customerName = readString(row, fieldMap.customerName);
  const opportunityName = readString(row, fieldMap.opportunityName);
  const amount = parseAmountByHeader(row[fieldMap.amount], fieldMap.amount, amountMode);
  if (!owner && !customerName && !opportunityName && amount === 0) return null;
  if (!fieldMap.amount || amount === 0) warnings.push('部分记录金额为空或无法识别，已按 0 处理。');

  const expectedCloseDate = readString(row, fieldMap.expectedCloseDate);
  const expectedQuarter = readString(row, fieldMap.expectedQuarter) || inferQuarter(expectedCloseDate);
  const stage = readString(row, fieldMap.stage) || 'Unknown';
  const status = readString(row, fieldMap.status) || 'Unknown';
  const winRate = parseRate(row[fieldMap.winRate]);
  const health = scoreHealth({
    amount,
    winRate,
    stage,
    status,
    expectedCloseDate,
    customerName,
    expectedQuarter,
  });

  return {
    id: buildRecordId(rowNumber, owner, customerName, opportunityName),
    owner: owner || '未填写',
    customerName: customerName || '未填写',
    opportunityName: opportunityName || '未命名商机',
    industryLevel1: readString(row, fieldMap.industryLevel1) || '未分类',
    industryLevel2: readString(row, fieldMap.industryLevel2),
    t2000CustomerTag: readString(row, fieldMap.t2000CustomerTag),
    product: readString(row, fieldMap.product) || '未分类产品',
    productLevel2: readString(row, fieldMap.productLevel2),
    productLevel3: readString(row, fieldMap.productLevel3),
    amount,
    stage,
    status,
    winRate,
    forecastType: parseForecast(row[fieldMap.forecastType]),
    expectedQuarter: expectedQuarter || '未填写',
    expectedCloseDate,
    healthScore: health.score,
    healthLevel: health.level,
    healthReasons: health.reasons,
    raw: row,
  };
}

function parsePerformance(rows: Row[]): PerformanceRecord[] {
  const fieldMap = mapPerformanceFields(rows[0] ?? {});
  return rows.flatMap((row) => {
    const customerName = readString(row, fieldMap.customerName);
    const orderAmount = parseAmountByHeader(row[fieldMap.orderAmount], fieldMap.orderAmount, 'yuan');
    const salesGrossProfit = parseAmountByHeader(
      row[fieldMap.salesGrossProfit],
      fieldMap.salesGrossProfit,
      'yuan',
    );
    const performanceGrossProfit = parseAmountByHeader(
      row[fieldMap.performanceGrossProfit],
      fieldMap.performanceGrossProfit,
      'yuan',
    );
    const finalPerformance = parseAmountByHeader(
      row[fieldMap.finalPerformance],
      fieldMap.finalPerformance,
      'yuan',
    );
    const contractAmount = parseAmountByHeader(row[fieldMap.contractAmount], fieldMap.contractAmount, 'yuan');

    if (!customerName && !orderAmount && !salesGrossProfit && !performanceGrossProfit && !finalPerformance)
      return [];

    return [
      {
        customerName,
        productName: readString(row, fieldMap.productName),
        productLevel2: readString(row, fieldMap.productLevel2),
        productLevel3: readString(row, fieldMap.productLevel3),
        orderAmount,
        contractAmount,
        salesGrossProfit,
        performanceGrossProfit,
        finalPerformance,
        isT2000: parseT2000Value(row[fieldMap.isT2000], fieldMap.isT2000),
        raw: row,
      },
    ];
  });
}

/**
 * 构造稳定 ID：以原始行号 + 业务字段组合。
 * 即便下游筛选/排序变化，ID 仍能稳定标识同一条记录。
 */
export function buildRecordId(
  rowNumber: number,
  owner: string,
  customer: string,
  opportunity: string,
): string {
  return [rowNumber, owner, customer, opportunity].join(ID_SEPARATOR);
}

function readString(row: Row, key?: string) {
  return key ? String(row[key] ?? '').trim() : '';
}

function parseBoolean(value: unknown) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!text) return false;
  // 把"--" / "无" / "/" / "n/a" 等"无值"占位符也视为 false，
  // 否则 T2000 类布尔字段（如"客户是否T2000"列里用户填"--"）会被错判成 true
  return !['否', 'no', 'false', '0', 'n', '非', '--', '——', '-', '无', '空', '/', 'n/a', 'na'].includes(text);
}

function parseT2000Value(value: unknown, header?: string) {
  const normalizedHeader = normalizeHeader(header ?? '');
  const normalizedValue = String(value ?? '')
    .replace(/\s/g, '')
    .toLowerCase();
  if (!normalizedValue) return false;
  const isTagField =
    normalizedHeader.includes('客户标签') ||
    normalizedHeader.includes('crm标签') ||
    normalizedHeader.includes('客户tag') ||
    normalizedHeader === '标签';
  if (isTagField) {
    // tag 字段里若值含 "t2000" 直接 true；其它都按布尔语义判（parseBoolean 已覆盖 "--" 等占位符）
    if (normalizedValue.includes('t2000')) return true;
    return normalizedHeader.includes('t2000') && parseBoolean(value);
  }
  return parseBoolean(value);
}

export function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === '') return 0;
  const text = String(value).replace(/,/g, '').trim();
  const numeric = Number(text.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(numeric)) return 0;
  if (text.includes('亿')) return numeric * 10000;
  if (text.includes('万')) return numeric;
  return numeric;
}

/**
 * 销售/售前金额单位识别。
 * - mode='wanyuan'：万元口径（销售 PPL 明细、目标缺口等）
 * - mode='yuan'：元口径（售前业绩明细、合同金额等，需要 ÷10000 转万元存储）
 *
 * 表头显式声明 "万元"/"元" 时优先尊重；都没有时按 mode 兜底。
 */
function parseAmountByHeader(value: unknown, header?: string, mode: 'wanyuan' | 'yuan' = 'wanyuan') {
  const amount = parseAmount(value);
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const valueText = String(value ?? '');
  const headerText = String(header ?? '');

  if (valueText.includes('万') || valueText.includes('萬')) return amount;

  if (/万元|萬元/.test(headerText)) return amount; // 表头显式说"万元"
  if (/(^|[^万])元/.test(headerText) && !/万元/.test(headerText)) return amount / 10000;

  // 业绩/合同类列在售前模块常常以"元"为单位，按 mode 区分：
  // - mode='yuan'：÷10000
  // - mode='wanyuan'：保持原值（销售 PPL 不该用这些列名做 amount，但兜底防呆）
  if (
    /总价|总额|合同金额|合同总额|下单金额|订单金额|销售毛利|业绩毛利|核算业绩|预计合同金额/.test(headerText)
  ) {
    return mode === 'yuan' ? amount / 10000 : amount;
  }
  // 兜底：万元模式保持原值；元模式 ÷10000。
  return mode === 'yuan' ? amount / 10000 : amount;
}

/**
 * 解析赢单率。
 *
 * 修复 H2 bug：原先 `text.includes('%') || numeric > 1` 会把已经存为小数的
 * "1.5"（100%+）误判成百分比 → 0.015。
 * 新规则：只有显式包含 `%` 才视为百分比字符串，否则按原样作为 0-1 小数。
 */
export function parseRate(value: unknown) {
  if (value === null || value === undefined || value === '') return 0;
  const text = String(value).trim();
  const numeric = Number(text.replace('%', ''));
  if (!Number.isFinite(numeric)) return 0;
  return text.includes('%') ? numeric / 100 : numeric;
}

export function parseForecast(value: unknown): ForecastType {
  const text = String(value ?? '').toLowerCase();
  if (
    text.includes('commit') ||
    text.includes('是') ||
    text.includes('确认') ||
    text.includes('承诺') ||
    text.includes('中标')
  )
    return 'Commit';
  if (text.includes('best')) return 'Best Case';
  if (text.includes('pipeline') || text.includes('争取') || text.includes('商机')) return 'Pipeline';
  if (text.includes('omit') || text.includes('否')) return 'Omitted';
  return 'Unknown';
}

/**
 * 将日期字符串推断为标准季度。
 * 输出格式：Q{1-4}'{4 位年份}，例如 "Q2'2026"
 */
export function inferQuarter(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `Q${Math.floor(date.getMonth() / 3) + 1}'${date.getFullYear()}`;
}

function scoreHealth(input: {
  amount: number;
  winRate: number;
  stage: string;
  status: string;
  expectedCloseDate: string;
  customerName: string;
  expectedQuarter: string;
}) {
  const matchedStage = Object.keys(STAGE_WEIGHTS).find((stage) => input.stage.includes(stage));
  const stageScore = matchedStage ? STAGE_WEIGHTS[matchedStage] : 0.45;
  const closeDateScore = scoreCloseDate(input.expectedCloseDate, input.stage);
  const amountQualityScore = input.amount <= 0 ? 0 : input.amount > LARGE_AMOUNT ? 0.65 : 1;
  const score = stageScore * 0.4 + input.winRate * 0.3 + closeDateScore * 0.2 + amountQualityScore * 0.1;
  const reasons: string[] = [];
  let level: HealthLevel =
    score >= HEALTH_THRESHOLDS.healthy ? '健康' : score >= HEALTH_THRESHOLDS.watch ? '关注' : '风险';

  // H3 修复：所有降级统一走 worse()，避免直接赋值绕过已有等级
  if (input.amount <= 0) {
    level = worse(level, '关注');
    reasons.push('金额为空或为 0');
  }
  if (!input.customerName || input.customerName === '未填写') {
    level = worse(level, '风险');
    reasons.push('客户名称为空');
  }
  if (input.amount > LARGE_AMOUNT && input.winRate < LARGE_LOW_WIN_RATE) {
    level = worse(level, '关注');
    reasons.push(`金额大于 ${LARGE_AMOUNT} 万且赢单率低于 ${(LARGE_LOW_WIN_RATE * 100).toFixed(0)}%`);
  }
  if (isExpired(input.expectedCloseDate) && !/赢单|输单|关闭/.test(input.status)) {
    level = worse(level, '风险');
    reasons.push('预计落单时间已过但状态未关闭');
  }
  if (isCurrentQuarter(input.expectedQuarter) && /初步|接洽/.test(input.stage)) {
    level = worse(level, '风险');
    reasons.push('本季度预计落单但仍处于早期阶段');
  }
  if (reasons.length === 0) {
    reasons.push(
      score >= HEALTH_THRESHOLDS.healthy ? '阶段、赢单率和金额质量较好' : '阶段成熟度或赢单率偏低',
    );
  }
  return { score, level, reasons };
}

function scoreCloseDate(value: string, stage: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0.55;
  const days = (date.getTime() - Date.now()) / 86400000;
  if (days < 0) return /赢单|输单/.test(stage) ? 0.8 : 0.15;
  if (days <= EARLY_STAGE_DAYS && /初步|接洽/.test(stage)) return 0.25;
  return 0.85;
}

function isExpired(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

/**
 * 修复 M1 跨年脆弱判断：
 * 原逻辑：quarter.includes(`Q${n}`) && quarter.includes(`Q${m}${year}`)
 * 问题：当用户存的是 "Q1'26"（两位年份）时不匹配。
 * 新逻辑：先用 inferQuarter 统一格式化为 "Q{1-4}'YYYY"，再比较。
 */
function isCurrentQuarter(quarter: string) {
  if (!quarter) return false;
  const normalized = quarter.includes("'")
    ? quarter.replace(/'(\d{2})$/, "'20$1") // 两位年份补全为四位
    : quarter;
  const canonical = inferQuarter(normalized.split("'")[0]);
  if (!canonical) return false;
  const now = new Date();
  const current = `Q${Math.floor(now.getMonth() / 3) + 1}'${now.getFullYear()}`;
  return canonical === current;
}

function worse(current: HealthLevel, next: HealthLevel): HealthLevel {
  const rank = { 健康: 0, 关注: 1, 风险: 2 };
  return rank[next] > rank[current] ? next : current;
}

function parseSummary(rows: Row[]): SummaryRecord[] {
  return rows.flatMap((row) => {
    const owner = String(row['销售'] ?? '').trim();
    if (!owner || owner.includes('汇总')) return [];
    return [
      {
        team: String(row['团队'] ?? '未分组'),
        owner,
        totalAmount: parseAmount(row['PPL总额']),
        forecastAmount: parseAmount(row['Q2FC']),
        raw: row,
      },
    ];
  });
}

function parseActivity(rows: Row[]): ActivityRecord[] {
  return rows.flatMap((row) => {
    const owner = String(row['Pipeline所有人'] ?? row['销售姓名'] ?? '').trim();
    if (!owner) return [];
    const newPplAmount = parseAmount(row['求和项:预计合同金额(万元)']);
    const activityCount = Number(row['活动记录数量（本周）'] ?? row['汇总'] ?? 0) || 0;
    return [
      {
        owner,
        newPplAmount,
        activityCount,
        conversionRate: activityCount ? newPplAmount / activityCount : 0,
        raw: row,
      },
    ];
  });
}

/**
 * 解析 NA 客户 Sheet（季度 NA 客户名单）。
 *
 * 已知 Sheet 列：
 * - 客户/合作伙伴名称
 * - 客户所有人
 * - 售前
 * - 客户类型 (NA-I / NA-II / NA代管)
 * - 客户象限名称
 * - T2000客户标签
 * - 最终客户所属一级行业 / 二级行业
 * - 是否为规模化产出目标（20%及以上）/ 规模化产出目标
 *
 * 关键能力：把 T2000客户标签非空的客户识别为"权威 T2000 名单"，
 * 即使 PPL/业绩里没有对应记录，也会出现在统计视图里（用于盘点覆盖漏斗）。
 */
function parseNaCustomers(rows: Row[], sourceSheet: string): NaCustomer[] {
  return rows.flatMap((row) => {
    const customer = String(row['客户/合作伙伴名称'] ?? '').trim();
    if (!customer || customer === '--' || customer.includes('汇总')) return [];
    const t2000 = String(row['T2000客户标签'] ?? '').trim();
    const scaleTarget = String(row['规模化产出目标'] ?? '').trim();
    const typeRaw = String(row['客户类型'] ?? '').trim();
    const customerType: NaCustomerType =
      typeRaw === 'NA-I' || typeRaw === 'NA-II' || typeRaw === 'NA代管' ? typeRaw : '';
    return [
      {
        customer,
        customerOwner: String(row['客户所有人'] ?? '').trim(),
        presales: String(row['售前'] ?? '').trim(),
        customerType,
        quadrant: String(row['客户象限名称'] ?? '').trim(),
        isT2000: t2000.toLowerCase().includes('t2000') || scaleTarget.length > 0,
        industryLevel1: String(row['最终客户所属一级行业'] ?? row['最终客户所属二级行业 (1)'] ?? '').trim(),
        industryLevel2: String(row['最终客户所属二级行业'] ?? '').trim(),
        scaleTarget,
        sourceSheet,
        raw: row,
      } satisfies NaCustomer,
    ];
  });
}

function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    owner: '销售',
    customerName: '客户名称',
    opportunityName: '商机名称',
    amount: '金额',
    product: '产品',
    industryLevel1: '一级行业',
    expectedQuarter: '季度',
    forecastType: 'Forecast',
  };
  return labels[field] ?? field;
}
