import { describe, expect, it } from 'vitest';
import type { DashboardData } from '../../domain';
import { analyzePresalesDashboard } from '../presalesMetrics';

describe('analyzePresalesDashboard', () => {
  it('should_calculate_profit_and_order_metrics_from_performance_rows', () => {
    const data: DashboardData = {
      ppl: [
        {
          id: '1',
          owner: '张三',
          customerName: '南京证券股份有限公司',
          opportunityName: 'AI XDR 项目',
          industryLevel1: '金融',
          t2000CustomerTag: 'T2000',
          product: 'AI XDR',
          amount: 1200,
          stage: '项目立项',
          status: '进行中',
          winRate: 0.6,
          forecastType: 'Commit',
          expectedQuarter: "Q3'2026",
          healthScore: 0.8,
          healthLevel: '健康',
          healthReasons: [],
          raw: { T2000客户标签: '是' },
        },
        {
          id: '2',
          owner: '张三',
          customerName: '普通客户',
          opportunityName: '普通项目',
          industryLevel1: '企业',
          t2000CustomerTag: '',
          product: '其他产品',
          amount: 800,
          stage: '项目立项',
          status: '进行中',
          winRate: 0.6,
          forecastType: 'Commit',
          expectedQuarter: "Q3'2026",
          healthScore: 0.8,
          healthLevel: '健康',
          healthReasons: [],
          raw: { T2000: '是' },
        },
      ],
      summary: [],
      activity: [],
      performance: [
        {
          customerName: '南京证券股份有限公司',
          productName: 'AI XDR',
          productLevel2: '联动防御系统',
          productLevel3: '',
          orderAmount: 420,
          contractAmount: 500,
          salesGrossProfit: 700,
          performanceGrossProfit: 680,
          finalPerformance: 500,
          isT2000: true,
          raw: {},
        },
      ],
      report: {
        fileName: 'test.xlsx',
        importedAt: '-',
        pplRows: 1,
        summaryRows: 0,
        activityRows: 0,
        performanceRows: 1,
        skippedRows: 0,
        detectedFields: [],
        missingFields: [],
        warnings: [],
      },
    };

    const analysis = analyzePresalesDashboard(data);

    expect(analysis.kpis.profitAmount).toBe(700);
    expect(analysis.kpis.profitRate).toBe(1);
    expect(analysis.kpis.orderAmount).toBe(420);
    expect(analysis.kpis.t2000OpportunityAmount).toBe(1200);
    expect(analysis.targetMetrics.find((item) => item.key === 't2000Coverage')?.actual).toBe(1);
    expect(analysis.targetMetrics.find((item) => item.key === 't2000Order')?.actual).toBe(420);
    expect(analysis.targetMetrics.find((item) => item.key === 'aiXdrOrder')?.actual).toBe(420);
    expect(analysis.productLines.find((item) => item.key === 'aiXdr')?.orderAmount).toBe(420);
  });

  it('should_classify_product_line_by_chinese_product_level2_not_word_boundary', () => {
    // 回归：JS \b 不支持中文边界，"云安全"/"终端安全" 必须按产品二级分类直判，不能依赖 \b 云安全 \b
    // 同时 DS 的 \bds\b 无法匹配 normalize 后的"dsv20.0"
    const data: DashboardData = {
      ppl: [
        // PPL：产品二级分类在 raw['二级分类']（与 industryLevel2 不同）
        { id: '1', owner: 'a', customerName: 'A', opportunityName: 'A', industryLevel1: '企业',
          product: 'DS V20.0 有代理客户端防病毒模块', amount: 100, stage: '1.提出需求', status: 'x',
          winRate: 0.3, forecastType: 'Pipeline', expectedQuarter: "Q3'2026", healthScore: 0.5,
          healthLevel: '关注', healthReasons: [], raw: { 二级分类: '云安全' } },
        { id: '2', owner: 'a', customerName: 'B', opportunityName: 'B', industryLevel1: '企业',
          product: 'TrustOne-PC 病毒防护', amount: 200, stage: '1.提出需求', status: 'x',
          winRate: 0.3, forecastType: 'Pipeline', expectedQuarter: "Q3'2026", healthScore: 0.5,
          healthLevel: '关注', healthReasons: [], raw: { 二级分类: '终端安全' } },
        { id: '3', owner: 'a', customerName: 'C', opportunityName: 'C', industryLevel1: '企业',
          product: '联动防御系统某模块', amount: 300, stage: '1.提出需求', status: 'x',
          winRate: 0.3, forecastType: 'Commit', expectedQuarter: "Q3'2026", healthScore: 0.5,
          healthLevel: '关注', healthReasons: [], raw: { 二级分类: '联动防御系统' } },
      ],
      summary: [],
      activity: [],
      performance: [
        // 业绩：productLevel2 直接用
        { customerName: 'A', productName: 'DS V20.0', productLevel2: '云安全', productLevel3: '云主机防护',
          orderAmount: 50, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
        { customerName: 'B', productName: 'TrustOne-PC', productLevel2: '终端安全', productLevel3: '端点安全管理',
          orderAmount: 30, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
        // "终端防病毒"三级分类的产品名不含 trustone 关键词，但二级分类是终端安全 → 应归 trustOne
        { customerName: 'B', productName: 'PC 病毒防护', productLevel2: '终端安全', productLevel3: '终端防病毒',
          orderAmount: 1, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
      ],
      report: { fileName: 't.xlsx', importedAt: '-', pplRows: 3, summaryRows: 0, activityRows: 0,
        performanceRows: 3, skippedRows: 0, detectedFields: [], missingFields: [], warnings: [] },
    };

    const analysis = analyzePresalesDashboard(data);

    // PPL：云安全 → DS，终端安全 → TrustOne，产品名含 ai xdr → AI XDR
    expect(analysis.productLines.find((l) => l.key === 'ds')?.opportunityAmount).toBe(100);
    expect(analysis.productLines.find((l) => l.key === 'trustOne')?.opportunityAmount).toBe(200);
    expect(analysis.productLines.find((l) => l.key === 'aiXdr')?.opportunityAmount).toBe(300);
    // 业绩：同上，且"终端防病毒"行也归 trustOne（按二级分类）
    expect(analysis.productLines.find((l) => l.key === 'ds')?.orderAmount).toBe(50);
    expect(analysis.productLines.find((l) => l.key === 'trustOne')?.orderAmount).toBe(31);
    expect(analysis.productLines.find((l) => l.key === 'aiXdr')?.orderAmount).toBe(0);
  });

  it('should_NOT_classify_performance_records_by_product_name_when_level2_is_other_category', () => {
    // 回归：业绩明细中"身份安全"二级分类下的产品即使名称含"TrustOne"或"零信任"，
    // 也不应被归到三大产品线（DS/TrustOne/AI XDR）。周报口径只认 云安全/终端安全/联动防御系统。
    const data: DashboardData = {
      ppl: [],
      summary: [],
      activity: [],
      performance: [
        // 身份安全 + 零信任 → 不归 Trustone（周报口径）
        { customerName: 'A', productName: '零信任安全网关', productLevel2: '身份安全', productLevel3: '零信任',
          orderAmount: 100, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
        // 身份安全 + TrustOne → 不归 Trustone（周报口径）
        { customerName: 'B', productName: 'TrustOne 终端准入', productLevel2: '身份安全', productLevel3: '终端准入',
          orderAmount: 50, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
        // 数据安全 + DSOP → 不归 DS（周报口径）
        { customerName: 'C', productName: 'DSOP-S5000', productLevel2: '数据安全', productLevel3: '数据脱敏',
          orderAmount: 200, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
        // 安全管理 + AIRDS → 不归 DS（周报口径）
        { customerName: 'D', productName: 'AIRDS-200', productLevel2: '安全管理', productLevel3: '态势感知',
          orderAmount: 80, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
        // 安全服务 + 云主机 → 不归 DS（周报口径：安全服务类不归三大产品线）
        { customerName: 'E', productName: '云主机防护服务', productLevel2: '安全服务', productLevel3: '云主机防护',
          orderAmount: 60, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
        // 但"云安全" / "终端安全" / "联动防御系统" 必须正确归类
        { customerName: 'F', productName: 'DS V20', productLevel2: '云安全', productLevel3: '',
          orderAmount: 30, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
        { customerName: 'G', productName: 'TrustOne-PC', productLevel2: '终端安全', productLevel3: '',
          orderAmount: 20, contractAmount: 0, salesGrossProfit: 0, performanceGrossProfit: 0,
          finalPerformance: 0, isT2000: false, raw: {} },
      ],
      report: { fileName: 't.xlsx', importedAt: '-', pplRows: 0, summaryRows: 0, activityRows: 0,
        performanceRows: 7, skippedRows: 0, detectedFields: [], missingFields: [], warnings: [] },
    };

    const analysis = analyzePresalesDashboard(data);

    // 只有 cloud/terminal/联动 类的 50 万订单进三大产品线，其它不进
    expect(analysis.productLines.find((l) => l.key === 'ds')?.orderAmount).toBe(30);
    expect(analysis.productLines.find((l) => l.key === 'trustOne')?.orderAmount).toBe(20);
    expect(analysis.productLines.find((l) => l.key === 'aiXdr')?.orderAmount).toBe(0);
  });

  it('should_aggregate_t2000_order_from_ppl_whitelist_when_performance_isT2000_missing', () => {
    // 周报口径：T2000 订单金额 = PPL 中打了 T2000 标签的客户名单 ∩ 业绩明细.最终用户 → 下单金额合计。
    // 当业绩明细的"客户是否T2000"字段为空/未填（参考文件中大部分 T2000 客户都是这种情况），
    // 仍然要能从 PPL 的 T2000 客户名单反向匹配业绩的下单金额。
    const data: DashboardData = {
      ppl: [
        // T2000 客户 A：在 PPL 中打了标签，但业绩明细没填 isT2000
        { id: '1', owner: '张磊', customerName: '客户A股份有限公司', opportunityName: 'A 项目',
          industryLevel1: '金融', t2000CustomerTag: 'T2000', product: 'DS V20',
          amount: 800, stage: '方案评估', status: '推进', winRate: 0.5,
          forecastType: 'Commit', expectedQuarter: "Q3'2026", healthScore: 0.7,
          healthLevel: '健康', healthReasons: [], raw: { T2000客户标签: 'T2000' } },
        // T2000 客户 B：简写在 PPL（"客户B"），全写在业绩（"客户B股份有限公司"）
        { id: '2', owner: '张磊', customerName: '客户B', opportunityName: 'B 项目',
          industryLevel1: '企业', t2000CustomerTag: 'T2000', product: 'TrustOne',
          amount: 500, stage: '招标采购', status: '推进', winRate: 0.8,
          forecastType: 'Commit', expectedQuarter: "Q3'2026", healthScore: 0.8,
          healthLevel: '健康', healthReasons: [], raw: { T2000客户标签: 'T2000' } },
        // 非 T2000 客户 C：PPL 没打标签，业绩有 100 万订单——不应计入 T2000 订单
        { id: '3', owner: '李四', customerName: '普通客户C', opportunityName: 'C 项目',
          industryLevel1: '政府', t2000CustomerTag: '', product: '其他',
          amount: 300, stage: '需求确认', status: '推进', winRate: 0.4,
          forecastType: 'Pipeline', expectedQuarter: "Q3'2026", healthScore: 0.5,
          healthLevel: '关注', healthReasons: [], raw: {} },
      ],
      summary: [],
      activity: [],
      performance: [
        // T2000 客户 A 在业绩里没填 isT2000，但业绩有 100 万订单 → 应计入
        { customerName: '客户A股份有限公司', productName: 'DS V20',
          productLevel2: '云安全', productLevel3: '',
          orderAmount: 100, contractAmount: 0, salesGrossProfit: 0,
          performanceGrossProfit: 0, finalPerformance: 0,
          isT2000: false, // ← 关键：业绩里没填 T2000
          raw: {} },
        // T2000 客户 B 在业绩里全称，订单 50 万
        { customerName: '客户B股份有限公司', productName: 'TrustOne-PC',
          productLevel2: '终端安全', productLevel3: '',
          orderAmount: 50, contractAmount: 0, salesGrossProfit: 0,
          performanceGrossProfit: 0, finalPerformance: 0,
          isT2000: false,
          raw: {} },
        // T2000 客户 B 还有第二笔订单 30 万（同一客户累加）
        { customerName: '客户B股份有限公司', productName: 'TrustOne-Server',
          productLevel2: '终端安全', productLevel3: '',
          orderAmount: 30, contractAmount: 0, salesGrossProfit: 0,
          performanceGrossProfit: 0, finalPerformance: 0,
          isT2000: false,
          raw: {} },
        // 非 T2000 客户 C 业绩 100 万 → 不应计入 T2000 订单
        { customerName: '普通客户C', productName: '其他',
          productLevel2: '其他', productLevel3: '',
          orderAmount: 100, contractAmount: 0, salesGrossProfit: 0,
          performanceGrossProfit: 0, finalPerformance: 0,
          isT2000: false,
          raw: {} },
      ],
      report: {
        fileName: 't.xlsx', importedAt: '-', pplRows: 3, summaryRows: 0, activityRows: 0,
        performanceRows: 4, skippedRows: 0, detectedFields: [], missingFields: [], warnings: [],
      },
    };

    const analysis = analyzePresalesDashboard(data);

    // T2000 订单 = 100（A）+ 50（B）+ 30（B）= 180
    // 非 T2000 客户 C 的 100 万订单不计入
    expect(analysis.targetMetrics.find((m) => m.key === 't2000Order')?.actual).toBe(180);
    // T2000 商机金额：PPL 中两个 T2000 客户的 amount 合计 800 + 500 = 1300
    expect(analysis.targetMetrics.find((m) => m.key === 't2000Opportunity')?.actual).toBe(1300);
    // T2000 覆盖：PPL 中 2 个 T2000 客户（去重）
    expect(analysis.targetMetrics.find((m) => m.key === 't2000Coverage')?.actual).toBe(2);
  });
});
