import React from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-textSecondary bg-surface border border-border rounded-xl">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border rounded-xl bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surfaceAlt text-textSecondary border-b border-border uppercase text-xs tracking-wider">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="px-6 py-3 font-semibold">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-textPrimary">
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-surfaceAlt/50 transition-colors">
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="px-6 py-4 whitespace-nowrap">
                  {col.cell
                    ? col.cell(row)
                    : col.accessorKey
                      ? String(row[col.accessorKey] ?? '')
                      : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
