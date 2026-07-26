import { describe, expect, it } from 'vitest';
import { render, screen } from '../../test/testUtils';
import { KeyCustomerKpis } from '../keyCustomers/KeyCustomerKpis';
import type { KeyCustomerAnalysis } from '../../lib/customerAnalyzer';

describe('KeyCustomerKpis', () => {
  const baseAnalysis: KeyCustomerAnalysis = {
    inputNames: ['客户A', '客户B'],
    matchResults: [],
    unmatchedInputs: [],
    matchedPplRows: [],
    kpis: {
      inputCustomerCount: 2,
      matchedCustomerCount: 1,
      opportunityCount: 5,
      totalAmount: 100,
      weightedWinRate: 0.5,
      forecastAmount: 30,
      riskCount: 1,
      activityCount: 3,
      activityNote: '',
    },
    chartData: {
      customerAmountRank: [],
      customerCountRank: [],
      productAmount: [],
      ownerAmount: [],
      stageAmount: [],
    },
  };

  it('should_render_eight_kpi_labels', () => {
    render(<KeyCustomerKpis analysis={baseAnalysis} />);
    expect(screen.getByText('输入客户数')).toBeInTheDocument();
    expect(screen.getByText('已匹配客户数')).toBeInTheDocument();
    expect(screen.getByText('商机数')).toBeInTheDocument();
    expect(screen.getByText('商机总金额')).toBeInTheDocument();
    expect(screen.getByText('加权赢单率')).toBeInTheDocument();
    expect(screen.getByText('Forecast 金额')).toBeInTheDocument();
    expect(screen.getByText('风险商机数')).toBeInTheDocument();
    expect(screen.getByText('活动记录数')).toBeInTheDocument();
  });

  it('should_render_fallback_text_when_activity_count_is_null', () => {
    render(
      <KeyCustomerKpis
        analysis={{
          ...baseAnalysis,
          kpis: { ...baseAnalysis.kpis, activityCount: null, activityNote: '当前活动记录无客户维度，暂不统计' },
        }}
      />,
    );
    expect(screen.getByText('暂无客户维度')).toBeInTheDocument();
  });
});