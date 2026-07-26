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
              {columns.map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 80).map((row, index) => (
              // 没有稳定的 row.id，回退用 index + 第一列值拼接作为 key
              <tr key={buildRowKey(row.raw, columns, index)}>
                {Object.values(row.raw)
                  .slice(0, 10)
                  .map((value, idx) => (
                    <td key={`${columns[idx] ?? idx}`}>{String(value ?? '')}</td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * 构造稳定的 React key：优先用第一列值拼接 index，没有时回退纯 index。
 * 简单表格没有 row.id，用行内容做 key 能避免插入/删除导致 DOM 错位。
 */
function buildRowKey(raw: Record<string, unknown>, columns: string[], index: number): string {
  const firstCol = columns[0];
  const firstVal = firstCol ? String(raw[firstCol] ?? '') : '';
  return firstVal ? `${firstVal}-${index}` : `row-${index}`;
}