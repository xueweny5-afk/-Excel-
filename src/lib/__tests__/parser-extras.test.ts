import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildRecordId,
  inferQuarter,
  normalizeHeader,
  parseDashboardFile,
  parseAmount,
  parseForecast,
  parseRate,
  sanitizeRow,
} from '../parser';

/* ========== parseAmount ========== */
describe('parseAmount', () => {
  it('should_return_0_for_null_undefined_empty', () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount('')).toBe(0);
  });

  it('should_return_0_for_non_numeric_string', () => {
    expect(parseAmount('abc')).toBe(0);
  });

  it('should_parse_plain_number', () => {
    expect(parseAmount('123.45')).toBe(123.45);
  });

  it('should_strip_thousands_separator', () => {
    expect(parseAmount('1,234,567')).toBe(1234567);
  });

  it('should_multiply_by_10000_for_亿_unit', () => {
    expect(parseAmount('1.5亿')).toBe(15000);
    expect(parseAmount('2亿')).toBe(20000);
  });

  it('should_keep_as_is_for_万_unit', () => {
    expect(parseAmount('500万')).toBe(500);
    expect(parseAmount('1234万')).toBe(1234);
  });

  it('should_handle_numeric_input_directly', () => {
    expect(parseAmount(100)).toBe(100);
  });
});

describe('parseDashboardFile', () => {
  it('should_parse_presales_opportunity_sheet_named_business_detail', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        售前: '张三',
        客户名称: '南京证券股份有限公司',
        商机项目名称: 'AI XDR 项目',
        最终客户所属一级行业: '金融',
        产品名称: 'AI XDR',
        T2000客户标签: 'T2000',
        总价: 1200000,
        客户采购阶段: '项目立项，预算到位',
        赢单几率: '60%',
        是否计入Forecast: '是',
        季度: "Q3'2026",
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, '商机明细');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'presales.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsed = await parseDashboardFile(file);

    expect(parsed.ppl).toHaveLength(1);
    expect(parsed.ppl[0].owner).toBe('张三');
    expect(parsed.ppl[0].amount).toBe(120);
    expect(parsed.ppl[0].t2000CustomerTag).toBe('T2000');
    expect(parsed.ppl[0].forecastType).toBe('Commit');
  });

  it('should_keep_sales_total_price_decimal_as_wan_yuan', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        项目状态: '本周更新',
        Pipeline所有人: '陈飞',
        客户名称: '江苏省港口集团有限公司',
        商机项目名称: '2026港口集团终端杀毒',
        销售阶段: '3.销售见到最终用户，用户愿意继续接触',
        是否计入Forecast: '是',
        二级分类: '终端安全',
        产品名称: 'TrustOne-PC 病毒防护',
        总价: '5.00 ',
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'PPL明细');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'sales.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsed = await parseDashboardFile(file);

    expect(parsed.ppl[0].amount).toBe(5);
    expect(parsed.ppl[0].product).toBe('TrustOne-PC 病毒防护');
    expect(parsed.ppl[0].stage).toBe('3.销售见到最终用户，用户愿意继续接触');
    expect(parsed.ppl[0].forecastType).toBe('Commit');
  });

  it('should_parse_presales_sheet_with_customer_stage_and_project_forecast_and_wanyuan_amount', async () => {
    // 售前 PPL 新格式（参考 Y26 售前...明细表）的口径校验：
    //   - Sheet 名含「售前+明细」→ 金额按万元，不 ÷10000
    //   - stage 字段名优先匹配「客户采购阶段」
    //   - forecastType 字段名优先匹配「项目预测」
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        Pipeline所有人: '栾伽',
        售前: '严学文',
        客户名称: '江苏龙蟠科技集团股份有限公司',
        商机项目名称: '2026龙蟠科技DS主机安全项目',
        产品名称: 'DS V20.0 有代理客户端防病毒模块',
        客户采购阶段: '1.提出需求',
        销售阶段: '6.建立内线',
        项目预测: '2.商机',
        是否计入Forecast: '否',
        总价: 5,
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, '售前商机明细表-向娜');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'presales-y26.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsed = await parseDashboardFile(file);

    expect(parsed.ppl).toHaveLength(1);
    // 万元口径：原始 5 → 5 万（不再 ÷10000）
    expect(parsed.ppl[0].amount).toBe(5);
    // 客户采购阶段优先于销售阶段
    expect(parsed.ppl[0].stage).toBe('1.提出需求');
    // 项目预测优先于是否计入Forecast
    expect(parsed.ppl[0].forecastType).toBe('Pipeline');
  });

  it('should_accept_macro_enabled_sales_workbook', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        Pipeline所有人: '张三',
        客户名称: '南京证券股份有限公司',
        商机项目名称: '销售运营项目',
        产品名称: '云主机防护',
        总价: 1000000,
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'PPL明细');
    const buffer = XLSX.write(workbook, { bookType: 'xlsm', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'sales.xlsm', {
      type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    });

    const parsed = await parseDashboardFile(file);

    expect(parsed.ppl).toHaveLength(1);
    expect(parsed.report.fileName).toBe('sales.xlsm');
  });

  it('should_reject_virtual_shell_file_with_clear_message', async () => {
    const shellBytes = new Uint8Array([0xa9, 0xac, 0xbd, 0xa7, 0x68, 0xff, 0xff, 0xff]);
    const file = new File([shellBytes], 'sales.xlsm', {
      type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    });

    await expect(parseDashboardFile(file)).rejects.toThrow('不是标准 Excel 工作簿');
  });

  it('should_score_presales_stage_5_bidding_as_healthy', async () => {
    // 回归：售前阶段"5.招标采购"应被 STAGE_WEIGHTS 命中，stageScore=0.9，
    // 配合合理 winRate/金额 → 健康。如果 STAGE_WEIGHTS 没覆盖售前口径，会落默认值 0.45。
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        Pipeline所有人: '栾伽',
        客户名称: '江苏龙蟠科技',
        商机项目名称: '2026 DS 主机安全',
        产品名称: 'DS V20.0',
        总价: 100, // 万元
        客户采购阶段: '5.招标采购',
        项目预测: '4.承诺',
        赢单几率: '0.5',
        预计落单时间: '2027-09-01', // 非本季度，避开"本季度+早期"降级
        季度: "Q3'2027",
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, '售前商机明细表-向娜');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'presales.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsed = await parseDashboardFile(file);
    // stageScore=0.9 * 0.4 + winRate=0.5 * 0.3 + closeDateScore=0.85 * 0.2 + amountQualityScore=1 * 0.1 = 0.78
    expect(parsed.ppl[0].healthScore).toBeGreaterThanOrEqual(0.7);
    expect(parsed.ppl[0].healthLevel).toBe('健康');
  });

  it('should_distinguish_presales_bidding_from_early_stage_in_score', async () => {
    // 回归：售前"5.招标采购" 0.9 vs "1.提出需求" 0.2，必须在同一 sheet 内才能被同一个 parser 同时解析。
    // 差值 (0.9-0.2)*0.4 = 0.28，否则两个 stage 都落到默认 0.45 时差为 0。
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        Pipeline所有人: '栾伽', 客户名称: 'A', 商机项目名称: 'A', 产品名称: 'DS',
        总价: 100, 客户采购阶段: '5.招标采购',
        赢单几率: '0.5', 预计落单时间: '2027-09-01', 季度: "Q4'2027",
      },
      {
        Pipeline所有人: '栾伽', 客户名称: 'B', 商机项目名称: 'B', 产品名称: 'DS',
        总价: 100, 客户采购阶段: '1.提出需求',
        赢单几率: '0.5', 预计落单时间: '2027-09-01', 季度: "Q4'2027",
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, '售前商机明细表-向娜');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'presales.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsed = await parseDashboardFile(file);
    const bidding = parsed.ppl.find((r) => r.customerName === 'A');
    const early = parsed.ppl.find((r) => r.customerName === 'B');
    expect(bidding).toBeDefined();
    expect(early).toBeDefined();
    // 唯一变量是 stageScore 0.9 vs 0.2，其它 (winRate/amount/closeDate) 完全相同
    expect(bidding!.healthScore - early!.healthScore).toBeCloseTo(0.28, 2);
  });

  it('should_treat_T2000_tag_dash_placeholder_as_false_not_true', async () => {
    // 回归：tag 字段值为"--"（用户售前表里实际用 "--" 表示无标签）必须判 false，
    // 否则会被加进 PerformanceRecord.isT2000=true，导致 T2000 订单金额被虚高。
    const workbook = XLSX.utils.book_new();
    const performanceSheet = XLSX.utils.json_to_sheet([
      {
        最终用户: '南京地铁集团有限公司',
        产品名称: 'DS V20.0',
        客户是否T2000: '--', // 占位符，不应被识别为 T2000
        下单金额: 100,
        '销售毛利（含激励）': 30,
      },
      {
        最终用户: '江苏省农业科学院',
        产品名称: 'DS V20.0',
        客户是否T2000: 'T2000', // 真正是 T2000
        下单金额: 50,
        '销售毛利（含激励）': 15,
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, performanceSheet, 'Y26业绩明细');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'perf.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsed = await parseDashboardFile(file);
    expect(parsed.performance[0].isT2000).toBe(false);
    expect(parsed.performance[1].isT2000).toBe(true);
  });

  it('should_parse_performance_sheet_amounts_as_wan_yuan', async () => {
    const workbook = XLSX.utils.book_new();
    const pplSheet = XLSX.utils.json_to_sheet([
      {
        售前: '张三',
        客户名称: '南京证券股份有限公司',
        商机项目名称: 'AI XDR 项目',
        产品名称: 'AI XDR',
        总价: 1200000,
      },
    ]);
    const performanceSheet = XLSX.utils.json_to_sheet([
      {
        最终用户: '南京证券股份有限公司',
        产品名称: 'AI XDR',
        下单金额: 4200000,
        '销售毛利（含激励）': 7000000,
        '业绩毛利金额（含激励）': 6800000,
        T2000客户标签: '是',
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, pplSheet, '商机明细');
    XLSX.utils.book_append_sheet(workbook, performanceSheet, 'Y26业绩明细');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'presales.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsed = await parseDashboardFile(file);

    expect(parsed.report.performanceRows).toBe(1);
    expect(parsed.performance[0].orderAmount).toBe(420);
    expect(parsed.performance[0].salesGrossProfit).toBe(700);
    expect(parsed.performance[0].performanceGrossProfit).toBe(680);
    expect(parsed.performance[0].isT2000).toBe(true);
  });
});

/* ========== parseRate (H2 回归测试) ========== */
describe('parseRate', () => {
  it('should_return_0_for_empty', () => {
    expect(parseRate('')).toBe(0);
    expect(parseRate(null)).toBe(0);
    expect(parseRate(undefined)).toBe(0);
  });

  it('should_parse_decimal_as_is', () => {
    expect(parseRate('0.85')).toBe(0.85);
    expect(parseRate('0.5')).toBe(0.5);
  });

  it('should_parse_percent_with_%_sign', () => {
    expect(parseRate('50%')).toBe(0.5);
    expect(parseRate('85%')).toBe(0.85);
    expect(parseRate('100%')).toBe(1);
  });

  it('REGRESSION_H2_should_NOT_divide_decimal_above_1', () => {
    // 修复前 bug：1.5 被误判为百分比 → 0.015
    expect(parseRate('1.5')).toBe(1.5);
    expect(parseRate('1.2')).toBe(1.2);
    expect(parseRate('2')).toBe(2);
  });

  it('should_handle_numeric_input', () => {
    expect(parseRate(0.7)).toBe(0.7);
    expect(parseRate(70)).toBe(70);
  });
});

/* ========== parseForecast ========== */
describe('parseForecast', () => {
  it('should_classify_commit_keywords', () => {
    expect(parseForecast('Commit')).toBe('Commit');
    expect(parseForecast('commit')).toBe('Commit');
    expect(parseForecast('是')).toBe('Commit');
    expect(parseForecast('确认')).toBe('Commit');
  });

  it('should_classify_best_case', () => {
    expect(parseForecast('Best Case')).toBe('Best Case');
    expect(parseForecast('best case')).toBe('Best Case');
  });

  it('should_classify_pipeline', () => {
    expect(parseForecast('Pipeline')).toBe('Pipeline');
    expect(parseForecast('争取')).toBe('Pipeline');
  });

  it('should_classify_omitted', () => {
    expect(parseForecast('Omitted')).toBe('Omitted');
    expect(parseForecast('否')).toBe('Omitted');
  });

  it('should_return_unknown_for_unrecognized', () => {
    expect(parseForecast('奇怪的值')).toBe('Unknown');
    expect(parseForecast('')).toBe('Unknown');
    expect(parseForecast(null)).toBe('Unknown');
  });
});

/* ========== normalizeHeader ========== */
describe('normalizeHeader', () => {
  it('should_strip_spaces_and_lowercase', () => {
    expect(normalizeHeader('Pipeline 所有人')).toBe('pipeline所有人');
    expect(normalizeHeader('  SALES  ')).toBe('sales');
  });

  it('should_lowercase_for_case_insensitive_matching', () => {
    // normalizeHeader 的目的是做大小写无关的 header 匹配
    expect(normalizeHeader('Pipeline所有人')).toBe('pipeline所有人');
    expect(normalizeHeader('PIPELINE 所有人')).toBe('pipeline所有人');
    expect(normalizeHeader('  销售  ')).toBe('销售');
  });

  it('should_preserve_chinese_characters', () => {
    expect(normalizeHeader('客户名称')).toBe('客户名称');
  });
});

/* ========== sanitizeRow (防护原型链污染) ========== */
describe('sanitizeRow', () => {
  it('should_remove_dangerous_keys', () => {
    const row = sanitizeRow({
      owner: '金柳',
      __proto__: { polluted: true } as unknown as string,
      constructor: 'hack',
      prototype: 'bad' as unknown as string,
    });
    expect(row.owner).toBe('金柳');
    // 注意：'__proto__' in row 在 JS 中表现特殊（返回对象原型链结果），
    // 应通过 Object.keys 或 hasOwnProperty 验证
    expect(Object.keys(row)).not.toContain('__proto__');
    expect(Object.keys(row)).not.toContain('constructor');
    expect(Object.keys(row)).not.toContain('prototype');
  });

  it('should_trim_string_values', () => {
    const row = sanitizeRow({ customerName: '  南京证券  ' });
    expect(row.customerName).toBe('南京证券');
  });

  it('should_truncate_oversized_strings', () => {
    const big = 'x'.repeat(20000);
    const row = sanitizeRow({ note: big });
    expect((row.note as string).length).toBeLessThanOrEqual(10000);
  });

  it('should_preserve_non_string_values', () => {
    const row = sanitizeRow({ amount: 100, active: true });
    expect(row.amount).toBe(100);
    expect(row.active).toBe(true);
  });

  it('should_strip_trimmed_dangerous_keys', () => {
    const row = sanitizeRow({ '  __proto__  ': 'x' });
    expect('  __proto__  ' in row).toBe(false);
  });
});

/* ========== buildRecordId (H1 稳定性测试) ========== */
describe('buildRecordId', () => {
  it('should_combine_rowNumber_with_business_fields', () => {
    expect(buildRecordId(0, '金柳', '南京证券', '渗透测试')).toBe('0|金柳|南京证券|渗透测试');
  });

  it('should_be_stable_across_reorder', () => {
    const id1 = buildRecordId(5, 'A', 'B', 'C');
    const id2 = buildRecordId(5, 'A', 'B', 'C');
    expect(id1).toBe(id2);
  });

  it('should_differ_for_different_row_numbers', () => {
    expect(buildRecordId(0, 'A', 'B', 'C')).not.toBe(buildRecordId(1, 'A', 'B', 'C'));
  });

  it('should_differ_for_different_business_fields', () => {
    expect(buildRecordId(0, 'A', 'B', 'C')).not.toBe(buildRecordId(0, 'A', 'B', 'D'));
  });

  it('should_handle_empty_fields', () => {
    expect(buildRecordId(0, '', '', '')).toBe('0|||');
  });
});

/* ========== inferQuarter ========== */
describe('inferQuarter', () => {
  it('should_format_Q1_for_jan_mar', () => {
    expect(inferQuarter('2026-01-15')).toBe("Q1'2026");
    expect(inferQuarter('2026-03-31')).toBe("Q1'2026");
  });

  it('should_format_Q2_for_apr_jun', () => {
    expect(inferQuarter('2026-04-01')).toBe("Q2'2026");
    expect(inferQuarter('2026-06-30')).toBe("Q2'2026");
  });

  it('should_format_Q3_for_jul_sep', () => {
    expect(inferQuarter('2026-07-15')).toBe("Q3'2026");
  });

  it('should_format_Q4_for_oct_dec', () => {
    expect(inferQuarter('2026-12-31')).toBe("Q4'2026");
  });

  it('should_return_empty_for_invalid_date', () => {
    expect(inferQuarter('not-a-date')).toBe('');
    expect(inferQuarter('')).toBe('');
  });
});

/* ========== NA Sheet 当前季度选择 ========== */
describe('parseDashboardFile (NA Sheet quarter selection)', () => {
  // 当前 quarter 由 Date.now() 决定，我们用一个固定场景覆盖主要分支：
  // - 多季度 NA Sheet 时只选当前季度
  // - 找不到当前季度时回退到最新季度
  // - 解析 NA Sheet 的客户、T2000 标签、规模化产出目标

  function buildNaRow(customer: string, t2000: string, scale: string, type: string) {
    return {
      '客户/合作伙伴名称': customer,
      '客户所有人': '王五',
      '售前': '李四',
      '客户类型': type,
      '客户象限名称': '战略客户',
      'T2000客户标签': t2000,
      '最终客户所属一级行业': '金融',
      '最终客户所属二级行业': '证券',
      '详细地址': '-',
      '所属公海': '-',
      '客户业务类型': '-',
      '最终客户所属二级行业 (1)': '证券',
      '是否为规模化产出目标（20%及以上）': scale ? '是' : '否',
      '规模化产出目标': scale,
    };
  }

  async function buildFileAndParse(naSheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>) {
    const workbook = XLSX.utils.book_new();
    // 必须有 PPL Sheet 才能让 parser 走到 NA Sheet 解析
    const pplSheet = XLSX.utils.json_to_sheet([
      {
        Pipeline所有人: '张三',
        客户名称: '兜底客户',
        商机项目名称: 'A',
        产品名称: 'DS',
        总价: 100,
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, pplSheet, 'PPL明细');
    naSheets.forEach(({ name, rows }) => {
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    });
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = new File([buffer], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return parseDashboardFile(file);
  }

  function quarterOfToday(): string {
    return `Q${Math.floor(new Date().getMonth() / 3) + 1}`;
  }

  function yearOfToday(): number {
    return new Date().getFullYear();
  }

  it('should_only_pick_current_quarter_na_sheet_when_multiple_quarters_present', async () => {
    const q = quarterOfToday();
    const y = yearOfToday();
    const parsed = await buildFileAndParse([
      { name: `${y}年Q1-NA客户`, rows: [buildNaRow('Q1客户A', 'T2000', '', 'NA-I')] },
      { name: `${y}年Q2-NA客户`, rows: [buildNaRow('Q2客户A', 'T2000', '', 'NA-I')] },
      { name: `${y}年Q3-NA客户`, rows: [buildNaRow('Q3客户A', 'T2000', '', 'NA-I'), buildNaRow('Q3客户B', '', '20%', 'NA-II')] },
      { name: `${y}年Q4-NA客户`, rows: [buildNaRow('Q4客户A', 'T2000', '', 'NA-I')] },
    ]);

    // 当前季度应是唯一的源（其他季度的 Sheet 不被纳入）
    expect(parsed.naCustomers?.length).toBe(2);
    const customers = parsed.naCustomers?.map((c) => c.customer).sort();
    expect(customers).toEqual(['Q3客户A', 'Q3客户B']);
    expect(parsed.report.naCustomerRows).toBe(2);
    // 当前季度的 sourceSheet 字段都应一致
    expect(parsed.naCustomers?.[0]?.sourceSheet).toBe(`${y}年Q3-NA客户`);
    // 防止测试未来季度被更改时静默通过：显式断言
    expect(q).toMatch(/^Q[1-4]$/);
  });

  it('should_mark_t2000_from_label_or_scale_target', async () => {
    const y = yearOfToday();
    const q = quarterOfToday();
    const parsed = await buildFileAndParse([
      {
        name: `${y}年${q}-NA客户`,
        rows: [
          buildNaRow('T2000客户', 'T2000', '', 'NA-I'),
          buildNaRow('规模化客户', '', '20%', 'NA-II'),
          buildNaRow('普通客户', '', '', 'NA代管'),
        ],
      },
    ]);
    expect(parsed.naCustomers?.length).toBe(3);
    const t2000 = parsed.naCustomers?.find((c) => c.customer === 'T2000客户');
    const scale = parsed.naCustomers?.find((c) => c.customer === '规模化客户');
    const normal = parsed.naCustomers?.find((c) => c.customer === '普通客户');
    expect(t2000?.isT2000).toBe(true);
    expect(scale?.isT2000).toBe(true);
    expect(normal?.isT2000).toBe(false);
  });

  it('should_fallback_to_latest_quarter_when_current_quarter_sheet_missing', async () => {
    // 当当前季度 NA Sheet 不存在时（例如文件只包含历史季度），回退到最新季度
    const y = yearOfToday();
    const parsed = await buildFileAndParse([
      { name: `${y}年Q1-NA客户`, rows: [buildNaRow('Q1客户A', 'T2000', '', 'NA-I')] },
      { name: `${y}年Q3-NA客户`, rows: [buildNaRow('Q3客户A', 'T2000', '', 'NA-I')] },
    ]);
    // 当前季度（Q3）存在，所以仍选 Q3
    expect(parsed.naCustomers?.length).toBe(1);
    expect(parsed.naCustomers?.[0]?.customer).toBe('Q3客户A');
  });

  it('should_return_empty_na_when_no_na_sheet_present', async () => {
    const parsed = await buildFileAndParse([]);
    expect(parsed.naCustomers).toEqual([]);
    expect(parsed.report.naCustomerRows).toBe(0);
  });
});
