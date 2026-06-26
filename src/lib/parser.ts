import * as XLSX from 'xlsx';
import type {
  ActivityRecord,
  DashboardData,
  ForecastType,
  HealthLevel,
  PPLRecord,
  SummaryRecord,
} from '../domain';
import { PPL_FIELD_ALIASES, REQUIRED_PPL_FIELDS } from '../fieldAliases';

type Row = Record<string, unknown>;

// ========== 文件/Sheet 安全边界 ==========
const MAX_FILE_SIZE = 20 * 1024 * 1024;
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
/** 各销售阶段对应的成熟度权重（0-1） */
const STAGE_WEIGHTS: Record<string, number> = {
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
/** 单元格最大长度（防止恶意超长字符串污染内存） */
const MAX_CELL_LENGTH = 10000;

/**
 * PPLRecord.id 计数种子。
 * 用稳定的 rowNumber + 业务字段组合，避免按 index 漂移导致 React 重渲染错乱。
 */
const ID_SEPARATOR = '|';

// ========== 入口 ==========
export async function parseDashboardFile(file: File): Promise<DashboardData> {
  validateFile(file);
  const workbook = XLSX.read(await file.arrayBuffer(), {
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

  const pplSheetName = findSheet(workbook.SheetNames, ['PPL明细', 'PPL', 'Pipeline']);
  const summarySheetName = findSheet(workbook.SheetNames, ['数据汇总', '汇总']);
  const activitySheetName = findSheet(workbook.SheetNames, ['新增PPL+活动记录', '活动记录', '新增PPL']);

  const pplRows = pplSheetName ? sheets[pplSheetName] : [];
  const fieldMap = mapFields(pplRows[0] ?? {});
  const missingFields = REQUIRED_PPL_FIELDS.filter((field) => !fieldMap[field]);
  const warnings: string[] = [];
  let skippedRows = 0;

  const ppl = pplRows.flatMap((row, index) => {
    const record = normalizePpl(row, fieldMap, index, warnings);
    if (!record) {
      skippedRows += 1;
      return [];
    }
    return [record];
  });

  const summary = summarySheetName ? parseSummary(sheets[summarySheetName]) : [];
  const activity = activitySheetName ? parseActivity(sheets[activitySheetName]) : [];

  return {
    ppl,
    summary,
    activity,
    report: {
      fileName: file.name,
      importedAt: new Date().toLocaleString('zh-CN'),
      pplRows: ppl.length,
      summaryRows: summary.length,
      activityRows: activity.length,
      skippedRows,
      detectedFields: Object.keys(fieldMap).map((key) => `${fieldLabel(key)}：${fieldMap[key]}`),
      missingFields: missingFields.map(fieldLabel),
      warnings: Array.from(new Set(warnings)).slice(0, 12),
    },
  };
}

function validateFile(file: File) {
  const allowed = ['.xlsx', '.xls', '.csv'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowed.includes(ext)) throw new Error('仅支持 .xlsx / .xls / .csv 文件。');
  if (file.size > MAX_FILE_SIZE) throw new Error('文件超过 20MB，请拆分后再导入。');
  // MIME 类型二次校验（防御文件名伪装）
  const allowedMimePrefixes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml',
    'application/vnd.ms-excel',
    'text/csv',
    'application/octet-stream', // 浏览器对部分 xlsx 返回 generic
  ];
  if (file.type && !allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix))) {
    throw new Error(`文件 MIME 类型不合法：${file.type}，请确认是 Excel/CSV 文件。`);
  }
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

function mapFields(row: Row) {
  const headers = Object.keys(row);
  return Object.entries(PPL_FIELD_ALIASES).reduce<Record<string, string>>((acc, [field, aliases]) => {
    const match = headers.find((header) =>
      aliases.some((alias) => normalizeHeader(header) === normalizeHeader(alias)),
    );
    if (match) acc[field] = match;
    return acc;
  }, {});
}

export function normalizeHeader(value: string) {
  return value.replace(/\s/g, '').toLowerCase();
}

function normalizePpl(
  row: Row,
  fieldMap: Record<string, string>,
  rowNumber: number,
  warnings: string[],
): PPLRecord | null {
  const owner = readString(row, fieldMap.owner);
  const customerName = readString(row, fieldMap.customerName);
  const opportunityName = readString(row, fieldMap.opportunityName);
  const amount = parseAmount(row[fieldMap.amount]);
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
    product: readString(row, fieldMap.product) || '未分类产品',
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
  if (text.includes('commit') || text.includes('是') || text.includes('确认')) return 'Commit';
  if (text.includes('best')) return 'Best Case';
  if (text.includes('pipeline') || text.includes('争取')) return 'Pipeline';
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
