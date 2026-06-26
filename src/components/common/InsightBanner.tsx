interface InsightBannerProps {
  insights: string[];
}

/** 经营洞察横幅：展示关键统计数据 */
export function InsightBanner({ insights }: InsightBannerProps) {
  return (
    <section className="insight-banner">
      <strong>经营洞察</strong>
      <div>
        {insights.map((insight) => <span key={insight}>{insight}</span>)}
      </div>
    </section>
  );
}