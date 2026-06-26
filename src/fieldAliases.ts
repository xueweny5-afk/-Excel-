import type { PPLRecord } from './domain';

export const PPL_FIELD_ALIASES: Record<
  keyof Pick<
    PPLRecord,
    | 'owner'
    | 'customerName'
    | 'opportunityName'
    | 'industryLevel1'
    | 'industryLevel2'
    | 'product'
    | 'amount'
    | 'stage'
    | 'status'
    | 'winRate'
    | 'forecastType'
    | 'expectedCloseDate'
    | 'expectedQuarter'
  >,
  string[]
> = {
  owner: ['Pipeline所有人', '销售', '负责人', '商机负责人'],
  customerName: ['客户名称', '客户', '公司名称', '最终客户'],
  opportunityName: ['商机项目名称', '商机名称', '项目名称', '机会点'],
  industryLevel1: ['最终客户所属一级行业', '一级行业', '行业一级', '行业'],
  industryLevel2: ['最终客户所属二级行业', '二级行业'],
  product: ['产品名称', '三级产品分类', '产品', '产品线', '产品类别'],
  amount: ['总价', '金额', '商机金额', '预计金额', 'PPL金额', '预计合同金额(万元)'],
  stage: ['销售阶段', '阶段', '客户采购阶段'],
  status: ['项目状态', '状态', '商机状态'],
  winRate: ['赢单几率', '赢率', 'WinRate', 'win_rate'],
  forecastType: ['项目预测', '是否计入Forecast', 'Forecast', 'FC类型', '预测类型'],
  expectedCloseDate: ['预计落单时间', '预计签单时间', '预计成交日期'],
  expectedQuarter: ['季度', '预计落单季度'],
};

export const REQUIRED_PPL_FIELDS = ['owner', 'customerName', 'opportunityName', 'amount'] as const;
