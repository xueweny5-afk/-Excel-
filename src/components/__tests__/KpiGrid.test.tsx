import { describe, expect, it } from 'vitest';
import { render, screen } from '../../test/testUtils';
import { KpiGrid } from '../kpi/KpiGrid';
import type { KPISummary } from '../../lib/analyzer';

describe('KpiGrid', () => {
  const kpis: KPISummary = {
    opportunityCount: 1234,
    totalAmount: 5678,
    customerCount: 89,
    weightedWinRate: 0.356,
    forecastAmount: 1500,
    riskCount: 12,
  };

  it('should_render_all_six_kpi_labels', () => {
    render(<KpiGrid kpis={kpis} />);
    expect(screen.getByText('商机总金额')).toBeInTheDocument();
    expect(screen.getByText('商机数量')).toBeInTheDocument();
    expect(screen.getByText('客户数量')).toBeInTheDocument();
    expect(screen.getByText('加权赢单率')).toBeInTheDocument();
    expect(screen.getByText('Forecast 金额')).toBeInTheDocument();
    expect(screen.getByText('风险商机')).toBeInTheDocument();
  });

  it('should_format_amount_with_万元_unit', () => {
    render(<KpiGrid kpis={kpis} />);
    expect(screen.getByText('5,678 万元')).toBeInTheDocument();
  });

  it('should_format_opportunity_count_with_thousands_separator', () => {
    render(<KpiGrid kpis={kpis} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('should_render_win_rate_as_percent', () => {
    render(<KpiGrid kpis={kpis} />);
    // 0.356 → 36% （formatPercent 取整）
    expect(screen.getByText('36%')).toBeInTheDocument();
  });

  it('should_handle_zero_values', () => {
    const zero: KPISummary = {
      opportunityCount: 0,
      totalAmount: 0,
      customerCount: 0,
      weightedWinRate: 0,
      forecastAmount: 0,
      riskCount: 0,
    };
    render(<KpiGrid kpis={zero} />);
    // 商机总金额 与 Forecast 金额 都是 0 万元 → 用 getAllByText
    expect(screen.getAllByText('0 万元')).toHaveLength(2);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});