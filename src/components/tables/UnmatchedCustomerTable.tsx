interface UnmatchedCustomerTableProps {
  customers: string[];
}

/** 未匹配客户表：展示输入但未匹配 PPL 的客户 */
export function UnmatchedCustomerTable({ customers }: UnmatchedCustomerTableProps) {
  return (
    <section className="table-panel unmatched-table-panel">
      <div className="section-title">
        <div className="table-heading">
          <h2>未匹配客户</h2>
          <span>{customers.length} 个输入客户未匹配到 PPL 客户名称</span>
        </div>
      </div>
      <div className="table-wrap unmatched-table-wrap">
        <table className="unmatched-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>输入客户</th>
              <th>匹配状态</th>
              <th>处理建议</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, index) => (
              <tr key={customer}>
                <td>{index + 1}</td>
                <td>{customer}</td>
                <td><span className="match-status failed">未匹配</span></td>
                <td>检查客户全称，或补充客户别名后重新分析</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}