import { useMemo, useState } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import type { PPLRecord } from '../../domain';
import { formatMoney, formatPercent } from '../../lib/formatters';

interface KeyCustomerDetailTableProps {
  rows: PPLRecord[];
}

/** 重点客户商机明细表 */
export function KeyCustomerDetailTable({ rows }: KeyCustomerDetailTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<PPLRecord>[]>(() => [
    { accessorKey: 'owner', header: '销售' },
    { accessorKey: 'customerName', header: '客户名称' },
    { accessorKey: 'opportunityName', header: '商机名称' },
    { accessorKey: 'industryLevel1', header: '一级行业' },
    { accessorKey: 'product', header: '产品' },
    { accessorKey: 'amount', header: '金额(万元)', cell: (info) => formatMoney(Number(info.getValue())) },
    { accessorKey: 'stage', header: '销售阶段' },
    { accessorKey: 'winRate', header: '赢单率', cell: (info) => formatPercent(Number(info.getValue())) },
    { accessorKey: 'forecastType', header: 'Forecast' },
    { accessorKey: 'expectedQuarter', header: '季度' },
    { accessorKey: 'healthLevel', header: '健康度', cell: (info) => <span className={`health ${info.getValue()}`}>{String(info.getValue())}</span> },
    { accessorKey: 'status', header: '状态' },
  ], []);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <section className="table-panel">
      <div className="section-title">
        <h2>重点客户商机明细</h2>
        <span>{rows.length} 条明细</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>上一页</button>
        <span>第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>下一页</button>
      </div>
    </section>
  );
}