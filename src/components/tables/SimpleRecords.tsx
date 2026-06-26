interface SimpleRecordsProps {
  title: string;
  rows: Array<{ raw: Record<string, unknown> }>;
}

/** 简化表格：直接展示 raw 字段（用于数据汇总、活动记录 Tab） */
export function SimpleRecords({ title, rows }: SimpleRecordsProps) {
  const firstRow = rows[0];
  const columns = firstRow ? Object.keys(firstRow.raw).slice(0, 10) : [];
  return (
    <section className="table-panel">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{rows.length} 行</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((key) => <th key={key}>{key}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 80).map((row, index) => (
              <tr key={index}>
                {Object.values(row.raw).slice(0, 10).map((value, idx) => (
                  <td key={idx}>{String(value ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}