import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns,
  Download,
  Bookmark,
  Plus,
  Trash2,
  Check,
  Search,
} from 'lucide-react';
import { useApiClient } from '../../../shared/lib/api';

export interface AdminColumn<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  defaultVisible?: boolean;
}

export interface AdminDataTableProps<T extends { id: string }> {
  tableId: string;
  columns: AdminColumn<T>[];
  data: T[];
  totalCount?: number;
  loading?: boolean;
  emptyMessage?: string;
  onExport?: () => void;
  onRowClick?: (row: T) => void;
  bulkActions?: (selectedIds: string[], clearSelection: () => void) => React.ReactNode;
}

export function AdminDataTable<T extends { id: string }>({
  tableId,
  columns,
  data,
  totalCount,
  loading = false,
  emptyMessage = 'No records found',
  onExport,
  onRowClick,
  bulkActions,
}: AdminDataTableProps<T>) {
  const client = useApiClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const sort = searchParams.get('sort') || '';
  const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
  const query = searchParams.get('q') || '';

  // Local state
  const [searchInputValue, setSearchInputValue] = useState(query);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [visibleColIds, setVisibleColIds] = useState<Set<string>>(() => {
    return new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.id));
  });
  const [isColPickerOpen, setIsColPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Saved views state
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState('');
  const [isSavingView, setIsSavingView] = useState(false);

  // Load saved views
  useEffect(() => {
    client
      .adminListSavedViews(tableId)
      .then((res: any) => {
        setSavedViews(Array.isArray(res) ? res : res?.savedViews || []);
      })
      .catch(() => {
        // Silently catch if not supported or error
      });
  }, [client, tableId]);

  // Sync search input with URL
  useEffect(() => {
    setSearchInputValue(query);
  }, [query]);

  const updateParam = (key: string, val: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val === null || val === '') {
        next.delete(key);
      } else {
        next.set(key, val);
      }
      if (key !== 'page') {
        next.set('page', '1');
      }
      return next;
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('q', searchInputValue.trim() || null);
  };

  const handleSort = (colId: string) => {
    if (sort === colId) {
      if (sortDir === 'asc') {
        updateParam('sortDir', 'desc');
      } else {
        // Toggle off
        updateParam('sort', null);
        updateParam('sortDir', null);
      }
    } else {
      updateParam('sort', colId);
      updateParam('sortDir', 'asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length && data.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((r) => r.id)));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visibleColumns = useMemo(
    () => columns.filter((col) => visibleColIds.has(col.id)),
    [columns, visibleColIds]
  );

  const toggleColumn = (id: string) => {
    setVisibleColIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApplyView = (view: any) => {
    setActiveViewId(view.id);
    const filters = view.filters || {};
    if (filters.columns && Array.isArray(filters.columns)) {
      setVisibleColIds(new Set(filters.columns));
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (filters.sortColumn) next.set('sort', filters.sortColumn);
      if (filters.sortDirection) next.set('sortDir', filters.sortDirection);
      if (filters.pageSize) next.set('limit', String(filters.pageSize));
      return next;
    });
  };

  const handleSaveView = async () => {
    if (!newViewName.trim()) return;
    try {
      const res = await client.adminCreateSavedView({
        pageKey: tableId,
        name: newViewName.trim(),
        filters: {
          columns: Array.from(visibleColIds),
          sortColumn: sort || undefined,
          sortDirection: sortDir,
          pageSize: limit,
        },
      });
      setSavedViews((prev) => [...prev, res]);
      setActiveViewId(res.id);
      setNewViewName('');
      setIsSavingView(false);
    } catch (err) {
      console.error('Failed to save view:', err);
    }
  };

  const handleDeleteView = async (viewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await client.adminDeleteSavedView(viewId);
      setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
      if (activeViewId === viewId) setActiveViewId(null);
    } catch (err) {
      console.error('Failed to delete view:', err);
    }
  };

  const totalPages = totalCount ? Math.ceil(totalCount / limit) : Math.ceil(data.length / limit) || 1;
  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < data.length;

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Saved views, Search, Density, Columns, Export */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3 border border-border rounded-xl">
        {/* Left: Saved Views & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Views bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => {
                setActiveViewId(null);
                setVisibleColIds(new Set(columns.map((c) => c.id)));
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeViewId === null
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-textSecondary hover:bg-surfaceAlt'
              }`}
            >
              Default
            </button>
            {savedViews.map((v) => (
              <div
                key={v.id}
                onClick={() => handleApplyView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                  activeViewId === v.id
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-surfaceAlt text-textSecondary border-border hover:text-textPrimary'
                }`}
              >
                <span>{v.name}</span>
                <button
                  onClick={(e) => handleDeleteView(v.id, e)}
                  className="hover:text-danger p-0.5 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {isSavingView ? (
              <div className="flex items-center gap-1 bg-surfaceAlt px-2 py-1 rounded-lg border border-border">
                <input
                  type="text"
                  placeholder="View name..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="bg-transparent text-xs text-textPrimary outline-none w-24"
                  autoFocus
                />
                <button
                  onClick={handleSaveView}
                  className="text-success hover:text-success/80 p-0.5"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsSavingView(false)}
                  className="text-textSecondary hover:text-textPrimary p-0.5 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSavingView(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
                title="Save current columns & filters as view"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save View</span>
              </button>
            )}
          </div>

          {/* Quick Filter / Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-textSecondary absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter list..."
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-surfaceAlt border border-border text-xs text-textPrimary placeholder:text-textSecondary outline-none focus:border-primary w-40 md:w-56"
            />
          </form>
        </div>

        {/* Right: Density, Column Chooser, Export */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {/* Density toggle */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-surfaceAlt text-xs">
            <button
              onClick={() => setDensity('comfortable')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                density === 'comfortable' ? 'bg-surface shadow-xs text-textPrimary' : 'text-textSecondary'
              }`}
              title="Comfortable row padding"
            >
              Comfort
            </button>
            <button
              onClick={() => setDensity('compact')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                density === 'compact' ? 'bg-surface shadow-xs text-textPrimary' : 'text-textSecondary'
              }`}
              title="Compact row padding"
            >
              Compact
            </button>
          </div>

          {/* Column Picker */}
          <div className="relative">
            <button
              onClick={() => setIsColPickerOpen(!isColPickerOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Columns</span>
            </button>
            {isColPickerOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl p-2 z-30 space-y-1 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-bold uppercase tracking-wider text-textSecondary px-2 py-1 border-b border-border mb-1">
                  Visible Columns
                </div>
                {columns.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surfaceAlt text-xs cursor-pointer text-textPrimary"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColIds.has(col.id)}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span>{col.header}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export Button */}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
              title="Export to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedIds.size > 0 && bulkActions && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">{selectedIds.size} selected</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-textSecondary hover:text-textPrimary underline ml-2"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions(Array.from(selectedIds), () => setSelectedIds(new Set()))}
          </div>
        </div>
      )}

      {/* Table Body */}
      <div className="overflow-x-auto border border-border rounded-xl bg-surface relative">
        {loading && (
          <div className="absolute inset-0 bg-surface/60 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead className="bg-surfaceAlt text-textSecondary border-b border-border uppercase text-xs tracking-wider select-none">
            <tr>
              {/* Select All Checkbox */}
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isPartiallySelected;
                  }}
                  onChange={toggleSelectAll}
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </th>
              {visibleColumns.map((col) => {
                const isSorted = sort === col.id;
                return (
                  <th
                    key={col.id}
                    className={`px-4 py-3 font-semibold ${
                      col.sortable ? 'cursor-pointer hover:text-textPrimary' : ''
                    }`}
                    onClick={() => col.sortable && handleSort(col.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-textSecondary">
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-textPrimary">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="px-6 py-12 text-center text-textSecondary text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const isSelected = selectedIds.has(row.id);
                const pyClass = density === 'compact' ? 'py-2' : 'py-3.5';
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`hover:bg-surfaceAlt/60 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    } ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-4 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectRow(row.id, e as any)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    {visibleColumns.map((col) => (
                      <td key={col.id} className={`px-4 ${pyClass} whitespace-nowrap text-sm`}>
                        {col.cell
                          ? col.cell(row, index)
                          : col.accessorKey
                            ? String(row[col.accessorKey] ?? '')
                            : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-textSecondary px-1">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => updateParam('limit', e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-xs text-textPrimary outline-none"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          {totalCount !== undefined && (
            <span className="ml-2">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} of {totalCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateParam('page', String(page - 1))}
              disabled={page <= 1}
              className="p-1 rounded border border-border bg-surface text-textPrimary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surfaceAlt"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateParam('page', String(page + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded border border-border bg-surface text-textPrimary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surfaceAlt"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
