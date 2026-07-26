import type {
  KeyProjectImportCheck,
  KeyProjectRecord,
  KeyProjectSourceFile,
  SalesPerformanceImportCheck,
  SalesPerformanceRecord,
  SalesPerformanceSourceFile,
} from './types';
import {
  displayText,
  fileDigest,
  mapFields,
  newId,
  normalizeText,
  parseAmountAsWan,
  parseConfirmationDate,
  readString,
  readWorkbook,
  workbookRows,
  type Row,
} from './utils';

const PERFORMANCE_ALIASES = {
  salesperson: ['销售员', '销售人员', '销售姓名', '销售负责人', '销售代表', '客户经理', '负责人', '项目负责人', 'Pipeline所有人'],
  customerName: ['最终用户', '最终客户', '客户名称', '客户', '最终用户名称'],
  projectName: ['项目名称', '商机名称', '商机项目名称', '机会点名称', '项目全称'],
  contractNumber: ['合同编号', '合同号', '合同编码', '订单编号'],
  confirmationDate: ['业绩确认月', '确认月份', '业绩确认月份', '确认月', '业绩确认日期', '确认日期'],
  confirmationStatus: ['确认状态', '业绩状态', '状态'],
  orderAmount: ['合同总额', '合同金额', '合同总价', '下单金额', '订单金额', '已下单金额'],
  salesGrossProfit: ['销售毛利（含激励）', '销售毛利(含激励)', '销售毛利', '个人毛利'],
  productLevel1: ['一级产品分类', '一级分类', '产品一级分类', '产品大类'],
  productLevel2: ['二级产品分类', '二级分类', '产品二级分类', '二级产品线'],
  productLevel3: ['三级产品分类', '三级分类', '产品三级分类'],
  productName: ['产品名称', '产品', '产品线'],
  customerType: ['业绩订单类型', '客户类型', '新购/增购/续费', '购买类型', '业务类型'],
  industry: ['行业', '一级行业', '最终客户所属一级行业', '客户行业'],
} as const;

const KEY_PROJECT_ALIASES = {
  projectName: ['重点项目名称', '项目名称', '商机名称', '商机项目名称', '项目全称'],
  customerName: ['客户名称', '最终用户', '最终客户', '客户'],
  owner: ['负责人', '销售人员', '销售姓名', '销售', '项目负责人'],
  targetAmount: ['目标金额', '目标下单金额', '计划金额', '预计金额'],
  targetGrossProfit: ['目标毛利', '目标销售毛利', '计划毛利'],
  productCategory: ['产品分类', '产品', '产品线', '一级产品分类'],
  industry: ['行业', '一级行业', '客户行业'],
  note: ['备注', '说明'],
} as const;

export async function parsePerformanceFile(file: File, existingDigests: Set<string>) {
  const digest = await fileDigest(file);
  const fileId = newId('perf-file');
  if (existingDigests.has(digest)) {
    return {
      sourceFile: duplicateSource(fileId, file, digest),
      records: [],
      check: duplicateCheck(fileId, file.name),
    };
  }

  const workbook = await readWorkbook(file);
  const sheets = workbookRows(workbook);
  const selected = sheets
    .map((sheet) => ({ ...sheet, fieldMap: mapFields(sheet.rows[0] ?? {}, PERFORMANCE_ALIASES) }))
    .sort((a, b) => Object.keys(b.fieldMap).length - Object.keys(a.fieldMap).length)[0];
  const fieldMap = selected?.fieldMap ?? {};
  const missingFields = requiredPerformanceFields(fieldMap);
  const rawRows = selected?.rows ?? [];
  if (!selected || missingFields.length > 0) {
    return {
      sourceFile: {
        id: fileId,
        name: file.name,
        digest,
        importedAt: new Date().toLocaleString('zh-CN'),
        salesperson: salespersonFromFileName(file.name),
        rawRowCount: rawRows.length,
        includedRowCount: 0,
        excludedRowCount: rawRows.length,
        status: '缺少字段',
        message: `缺少字段：${missingFields.join('、')}`,
      } satisfies SalesPerformanceSourceFile,
      records: [],
      check: {
        fileId,
        fileName: file.name,
        sheetName: selected?.sheetName ?? '-',
        rawRows: rawRows.length,
        includedRows: 0,
        excludedRows: rawRows.length,
        confirmedRows: 0,
        pendingRows: 0,
        missingDateRows: 0,
        invalidAmountRows: 0,
        emptyContractRows: 0,
        negativeAmountRows: 0,
        duplicateRows: 0,
        missingFields,
        warnings: ['文件未纳入统计。'],
      } satisfies SalesPerformanceImportCheck,
    };
  }

  const fallbackYear = inferYearFromName(file.name);
  const salespersonFallback = salespersonFromFileName(file.name);
  const records = rawRows.flatMap((row, index) =>
    normalizePerformanceRow(row, index + 2, fileId, file.name, selected.sheetName, fieldMap, salespersonFallback, fallbackYear),
  );
  markDuplicateRows(records);
  const includedRows = records.filter((row) => row.included && row.duplicateStatus === '正常').length;
  const excludedRows = records.length - includedRows;
  const sourceFile: SalesPerformanceSourceFile = {
    id: fileId,
    name: file.name,
    digest,
    importedAt: new Date().toLocaleString('zh-CN'),
    salesperson: salespersonFallback,
    rawRowCount: rawRows.length,
    includedRowCount: includedRows,
    excludedRowCount: excludedRows,
    status: '正常',
  };
  return {
    sourceFile,
    records,
    check: buildPerformanceCheck(sourceFile, selected.sheetName, records, []),
  };
}

export async function parseKeyProjectFile(file: File, existingDigests: Set<string>) {
  const digest = await fileDigest(file);
  const fileId = newId('key-project-file');
  if (existingDigests.has(digest)) {
    return {
      sourceFile: {
        id: fileId,
        name: file.name,
        digest,
        importedAt: new Date().toLocaleString('zh-CN'),
        rawRowCount: 0,
        includedRowCount: 0,
        status: '重复文件',
        message: '该重点项目表已经导入，本次未重复添加。',
      } satisfies KeyProjectSourceFile,
      projects: [],
      check: {
        fileId,
        fileName: file.name,
        sheetName: '-',
        rawRows: 0,
        includedRows: 0,
        missingFields: [],
        warnings: ['重复文件，未导入。'],
      } satisfies KeyProjectImportCheck,
    };
  }
  const workbook = await readWorkbook(file);
  const sheets = workbookRows(workbook);
  const selected = sheets
    .map((sheet) => ({ ...sheet, fieldMap: mapFields(sheet.rows[0] ?? {}, KEY_PROJECT_ALIASES) }))
    .sort((a, b) => Object.keys(b.fieldMap).length - Object.keys(a.fieldMap).length)[0];
  const fieldMap = selected?.fieldMap ?? {};
  const missingFields = ['重点项目名称', '客户名称'].filter((label) =>
    label === '重点项目名称' ? !fieldMap.projectName : !fieldMap.customerName,
  );
  const rawRows = selected?.rows ?? [];
  if (!selected || missingFields.length > 0) {
    return {
      sourceFile: {
        id: fileId,
        name: file.name,
        digest,
        importedAt: new Date().toLocaleString('zh-CN'),
        rawRowCount: rawRows.length,
        includedRowCount: 0,
        status: '缺少字段',
        message: `缺少字段：${missingFields.join('、')}`,
      } satisfies KeyProjectSourceFile,
      projects: [],
      check: {
        fileId,
        fileName: file.name,
        sheetName: selected?.sheetName ?? '-',
        rawRows: rawRows.length,
        includedRows: 0,
        missingFields,
        warnings: ['重点项目表未纳入对比。'],
      } satisfies KeyProjectImportCheck,
    };
  }
  const projects = rawRows.flatMap((row, index) => {
    const projectName = readString(row, fieldMap.projectName);
    const customerName = readString(row, fieldMap.customerName);
    if (!projectName && !customerName) return [];
    return [
      {
        id: newId('key-project'),
        sourceFileId: fileId,
        sourceFileName: file.name,
        sourceSheetName: selected.sheetName,
        sourceRowNumber: index + 2,
        projectName: projectName || '未填写项目',
        customerName: customerName || '未填写客户',
        owner: readString(row, fieldMap.owner),
        targetAmount: parseAmountAsWan(row[fieldMap.targetAmount ?? ''], fieldMap.targetAmount),
        targetGrossProfit: parseAmountAsWan(row[fieldMap.targetGrossProfit ?? ''], fieldMap.targetGrossProfit),
        productCategory: readString(row, fieldMap.productCategory),
        industry: readString(row, fieldMap.industry),
        note: readString(row, fieldMap.note),
        raw: row,
      } satisfies KeyProjectRecord,
    ];
  });
  return {
    sourceFile: {
      id: fileId,
      name: file.name,
      digest,
      importedAt: new Date().toLocaleString('zh-CN'),
      rawRowCount: rawRows.length,
      includedRowCount: projects.length,
      status: '正常',
    } satisfies KeyProjectSourceFile,
    projects,
    check: {
      fileId,
      fileName: file.name,
      sheetName: selected.sheetName,
      rawRows: rawRows.length,
      includedRows: projects.length,
      missingFields: [],
      warnings: optionalProjectWarnings(fieldMap),
    } satisfies KeyProjectImportCheck,
  };
}

function requiredPerformanceFields(fieldMap: Partial<Record<keyof typeof PERFORMANCE_ALIASES, string>>) {
  const missing: string[] = [];
  if (!fieldMap.customerName) missing.push('最终用户');
  if (!fieldMap.confirmationDate) missing.push('业绩确认月');
  if (!fieldMap.orderAmount && !fieldMap.salesGrossProfit) missing.push('合同总额或销售毛利');
  return missing;
}

function normalizePerformanceRow(
  row: Row,
  sourceRowNumber: number,
  sourceFileId: string,
  sourceFileName: string,
  sourceSheetName: string,
  fieldMap: Partial<Record<keyof typeof PERFORMANCE_ALIASES, string>>,
  salespersonFallback: string,
  fallbackYear?: number,
) {
  const salesperson = readString(row, fieldMap.salesperson) || salespersonFallback;
  const customerName = readString(row, fieldMap.customerName);
  const projectName = readString(row, fieldMap.projectName);
  const contractNumber = readString(row, fieldMap.contractNumber);
  const status = readString(row, fieldMap.confirmationStatus);
  const orderAmount = parseAmountAsWan(row[fieldMap.orderAmount ?? ''], fieldMap.orderAmount);
  const salesGrossProfit = parseAmountAsWan(row[fieldMap.salesGrossProfit ?? ''], fieldMap.salesGrossProfit);
  const date = parseConfirmationDate(row[fieldMap.confirmationDate ?? ''], fallbackYear);
  if (!customerName && !projectName && !contractNumber && !orderAmount && !salesGrossProfit) return [];

  const reasons: string[] = [];
  if (!date.year || !date.month) reasons.push('确认年月为空或无法识别');
  if (!Number.isFinite(orderAmount) || !Number.isFinite(salesGrossProfit)) reasons.push('金额无法解析');
  if (orderAmount === 0 && salesGrossProfit === 0) reasons.push('合同总额和销售毛利均为空或为0');
  const included = reasons.length === 0;

  return [
    {
      id: newId('perf-row'),
      sourceFileId,
      sourceFileName,
      sourceSheetName,
      sourceRowNumber,
      salesperson: salesperson || '未填写销售',
      customerName: customerName || '未填写客户',
      projectName: projectName || '未填写项目',
      contractNumber,
      confirmationYear: date.year,
      confirmationMonth: date.month,
      confirmationDateText: date.text,
      confirmationStatus: status,
      orderAmount,
      salesGrossProfit,
      productLevel1: readString(row, fieldMap.productLevel1) || '未分类',
      productLevel2: readString(row, fieldMap.productLevel2) || '未分类',
      productLevel3: readString(row, fieldMap.productLevel3),
      productName: readString(row, fieldMap.productName) || '未填写产品',
      customerType: readString(row, fieldMap.customerType) || '未分类',
      industry: readString(row, fieldMap.industry) || '未分类',
      included,
      exclusionReason: reasons.join('；'),
      duplicateStatus: '正常',
      raw: row,
    } satisfies SalesPerformanceRecord,
  ];
}

function markDuplicateRows(records: SalesPerformanceRecord[]) {
  const seen = new Set<string>();
  records.forEach((record) => {
    const key = [
      record.contractNumber,
      record.projectName,
      record.productName,
      record.customerName,
      record.orderAmount.toFixed(4),
      record.salesGrossProfit.toFixed(4),
    ]
      .map(normalizeText)
      .join('|');
    if (!key.replace(/\|/g, '')) return;
    if (seen.has(key)) {
      record.duplicateStatus = '疑似重复';
      record.included = false;
      record.exclusionReason = record.exclusionReason
        ? `${record.exclusionReason}；疑似重复`
        : '疑似重复';
    } else {
      seen.add(key);
    }
  });
}

function buildPerformanceCheck(
  file: SalesPerformanceSourceFile,
  sheetName: string,
  records: SalesPerformanceRecord[],
  missingFields: string[],
): SalesPerformanceImportCheck {
  const excluded = records.filter((row) => !row.included || row.duplicateStatus === '疑似重复');
  return {
    fileId: file.id,
    fileName: file.name,
    sheetName,
    rawRows: file.rawRowCount,
    includedRows: file.includedRowCount,
    excludedRows: excluded.length,
    confirmedRows: records.filter((row) => isConfirmed(row.confirmationStatus)).length,
    pendingRows: records.filter((row) => !isConfirmed(row.confirmationStatus)).length,
    missingDateRows: records.filter((row) => !row.confirmationYear || !row.confirmationMonth).length,
    invalidAmountRows: records.filter((row) => row.orderAmount === 0 && row.salesGrossProfit === 0).length,
    emptyContractRows: records.filter((row) => !row.contractNumber).length,
    negativeAmountRows: records.filter((row) => row.orderAmount < 0 || row.salesGrossProfit < 0).length,
    duplicateRows: records.filter((row) => row.duplicateStatus === '疑似重复').length,
    missingFields,
    warnings: records.some((row) => row.orderAmount < 0 || row.salesGrossProfit < 0)
      ? ['发现负数金额记录，请确认是否属于冲销或调整。']
      : [],
  };
}

function duplicateSource(id: string, file: File, digest: string): SalesPerformanceSourceFile {
  return {
    id,
    name: file.name,
    digest,
    importedAt: new Date().toLocaleString('zh-CN'),
    salesperson: salespersonFromFileName(file.name),
    rawRowCount: 0,
    includedRowCount: 0,
    excludedRowCount: 0,
    status: '重复文件',
    message: '该文件已经导入，本次未重复添加。',
  };
}

function duplicateCheck(fileId: string, fileName: string): SalesPerformanceImportCheck {
  return {
    fileId,
    fileName,
    sheetName: '-',
    rawRows: 0,
    includedRows: 0,
    excludedRows: 0,
    confirmedRows: 0,
    pendingRows: 0,
    missingDateRows: 0,
    invalidAmountRows: 0,
    emptyContractRows: 0,
    negativeAmountRows: 0,
    duplicateRows: 0,
    missingFields: [],
    warnings: ['重复文件，未导入。'],
  };
}

function isConfirmed(value: string) {
  const text = normalizeText(value);
  return text === '已确认' || text === '确认' || text === 'confirmed';
}

function salespersonFromFileName(fileName: string) {
  return displayText(fileName.replace(/\.[^.]+$/, '')) || '未填写销售';
}

function inferYearFromName(fileName: string) {
  const match = fileName.match(/20\d{2}/);
  return match ? Number(match[0]) : undefined;
}

function optionalProjectWarnings(fieldMap: Partial<Record<keyof typeof KEY_PROJECT_ALIASES, string>>) {
  const warnings: string[] = [];
  if (!fieldMap.targetAmount) warnings.push('未识别目标金额字段，目标金额完成率将按 0 展示。');
  if (!fieldMap.targetGrossProfit) warnings.push('未识别目标毛利字段，目标毛利完成率将按 0 展示。');
  return warnings;
}
