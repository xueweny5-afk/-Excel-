import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  type Table,
  useReactTable,
} from '@tanstack/react-table';
import type { PPLRecord } from '../../domain';
import { aggregatePpl, exportAggregationCsv, exportCsv } from '../../lib/analyzer';
import type { AggregatedPplRow } from '../../lib/analyzer';
import { formatMoney, formatPercent } from '../../lib/formatters';
import { DetailDrawer } from './DetailDrawer';

type Mode = 'aggregate' | 'detail';

/** PPL 明细/聚合切换表格 */
export function PplTable({ rows }: { rows: PPLRecord[] }) {
  const [mode, setMode] = useState<Mode>('aggregate');
  const [selected, setSelected] = useState<PPLRecord | null>(null);

  function switchMode(next: Mode) {
    // M3 修复：切换模式时清空已选中行，避免详情面板显示错误的行
    setMode(next);
    setSelected(null);
  }

  function handleExport() {
    if (mode === 'aggregate') {
      exportAggregationCsv(aggregatePpl(rows));
    } else {
      exportCsv(rows);
    }
  }

  return (
    <section className="table-panel">
      <div className="section-title">
        <div className="table-heading">
          <h2>{mode === 'aggregate' ? 'PPL 聚合统计' : 'PPL 明细表'}</h2>
          <span>
            {mode === 'aggregate'
              ? `${aggregatePpl(rows).length} 组 / ${rows.length} 条明细`
              : `${rows.length} 条明细`}
          </span>
        </div>
        <div className="table-actions">
          <div className="segment">
            <button className={mode === 'aggregate' ? 'active' : ''} onClick={() => switchMode('aggregate')}>
              聚合统计
            </button>
            <button className={mode === 'detail' ? 'active' : ''} onClick={() => switchMode('detail')}>
              明细数据
            </button>
          </div>
          <button className="button primary" onClick={handleExport}>
            <Download size={16} />
            导出当前结果
          </button>
        </div>
      </div>
      {mode === 'aggregate' ? (
        <AggregateTable rows={rows} />
      ) : (
        <DetailTable rows={rows} onSelect={setSelected} />
      )}
      {selected && <DetailDrawer row={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

/* ========== 子组件：聚合统计表 ========== */
function AggregateTable({ rows }: { rows: PPLRecord[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'totalAmount', desc: true }]);
  const data = useMemo(() => aggregatePpl(rows), [rows]);

  const columns = useMemo<ColumnDef<AggregatedPplRow>[]>(
    () => [
      { accessorKey: 'customerName', header: '客户名称' },
      { accessorKey: 'industryLevel1', header: '一级行业' },
      { accessorKey: 'product', header: '产品' },
      { accessorKey: 'stage', header: '销售阶段' },
      { accessorKey: 'owners', header: '销售' },
      { accessorKey: 'opportunityCount', header: '商机数' },
      {
        accessorKey: 'totalAmount',
        header: '金额合计(万元)',
        cell: (info) => formatMoney(Number(info.getValue())),
      },
      {
        accessorKey: 'weightedWinRate',
        header: '加权赢单率',
        cell: (info) => formatPercent(Number(info.getValue())),
      },
      {
        accessorKey: 'forecastAmount',
        header: 'Forecast金额(万元)',
        cell: (info) => formatMoney(Number(info.getValue())),
      },
      { accessorKey: 'riskCount', header: '风险数' },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return <TableBody table={table} />;
}

/* ========== 子组件：明细表 ========== */
function DetailTable({ rows, onSelect }: { rows: PPLRecord[]; onSelect: (row: PPLRecord) => void }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<PPLRecord>[]>(
    () => [
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
      {
        accessorKey: 'healthLevel',
        header: '健康度',
        cell: (info) => <span className={`health ${info.getValue()}`}>{String(info.getValue())}</span>,
      },
      { accessorKey: 'status', header: '状态' },
    ],
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return <TableBody table={table} onRowClick={onSelect} />;
}

/**
 * 共享表格渲染器：消除两个子组件的重复 JSX。
 * 泛型 T 仅用于 cell context 类型推断，渲染时统一为 any。
 */

function TableBody<T>({ table, onRowClick }: { table: Table<T>; onRowClick?: (row: T) => void }) {
  return (
    <>
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
              <tr key={row.id} onClick={onRowClick ? () => onRowClick(row.original) : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          上一页
        </button>
        <span>
          第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
        </span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          下一页
        </button>
      </div>
    </>
  );
}
