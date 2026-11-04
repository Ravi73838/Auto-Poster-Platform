import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Eye, Calendar, User, Activity, X } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { AdminDataTable, type AdminColumn } from '../../components/AdminDataTable';
import { useApiClient } from '../../../../shared/lib/api';

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorMobile?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  diff?: any;
  metadata?: any;
  createdAt: string;
}

export function AuditLogPage() {
  const client = useApiClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeDiffLog, setActiveDiffLog] = useState<AuditLogRow | null>(null);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const entityType = searchParams.get('entityType') || '';
  const action = searchParams.get('action') || '';

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.adminListAuditLogs({
        page,
        limit,
        entityType: entityType || undefined,
        action: action || undefined,
      });
      setLogs(res?.items || []);
      setTotal(res?.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [client, page, limit, entityType, action]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const updateFilter = (key: string, val: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) {
        next.set(key, val);
      } else {
        next.delete(key);
      }
      next.set('page', '1');
      return next;
    });
  };

  const columns: AdminColumn<AuditLogRow>[] = [
    {
      id: 'createdAt',
      header: 'Timestamp',
      accessorKey: 'createdAt',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs text-textSecondary">
          {new Date(row.createdAt).toLocaleString('en-IN', {
            dateStyle: 'short',
            timeStyle: 'medium',
          })}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      accessorKey: 'action',
      sortable: true,
      cell: (row) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary font-mono">
          {row.action}
        </span>
      ),
    },
    {
      id: 'entity',
      header: 'Target Entity',
      cell: (row) => (
        <div>
          <span className="font-semibold text-textPrimary text-xs block">
            {row.entityType}
          </span>
          <span className="font-mono text-[11px] text-textSecondary">
            {row.entityId.slice(0, 12)}...
          </span>
        </div>
      ),
    },
    {
      id: 'actor',
      header: 'Operator / Actor',
      cell: (row) => (
        <div>
          <span className="text-xs text-textPrimary block">
            {row.actorMobile || 'System / Auto'}
          </span>
          {row.actorId && (
            <span className="font-mono text-[10px] text-textSecondary">
              {row.actorId.slice(0, 8)}...
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'ipAddress',
      header: 'IP Address',
      accessorKey: 'ipAddress',
      cell: (row) => (
        <span className="font-mono text-xs text-textSecondary">
          {row.ipAddress || '—'}
        </span>
      ),
    },
    {
      id: 'diff',
      header: 'Changes',
      cell: (row) => {
        const hasDiff = row.diff || row.metadata;
        if (!hasDiff) return <span className="text-textSecondary text-xs">—</span>;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDiffLog(row);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surfaceAlt border border-border text-xs text-textPrimary hover:bg-border transition-colors font-medium"
          >
            <Eye className="w-3.5 h-3.5 text-primary" />
            <span>View Diff</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Security & Compliance Audit Trail"
          description="Immutable, tamper-evident log of administrative actions, PII reveals, and role changes."
        />
        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={entityType}
            onChange={(e) => updateFilter('entityType', e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-surface text-xs text-textPrimary outline-none"
          >
            <option value="">All Entities</option>
            <option value="USER">User / Account</option>
            <option value="DRIVER_PROFILE">Driver Profile</option>
            <option value="COMPANY_PROFILE">Company Profile</option>
            <option value="CAMPAIGN">Campaign</option>
            <option value="ASSIGNMENT">Assignment</option>
            <option value="PHOTO">Daily Photo</option>
            <option value="DISPUTE">Dispute</option>
            <option value="SETTING">Setting</option>
            <option value="ROLE">Role / Permission</option>
          </select>
        </div>
      </div>

      <AdminDataTable
        tableId="audit-logs-table"
        columns={columns}
        data={logs}
        totalCount={total}
        loading={loading}
        emptyMessage="No audit log events found matching criteria."
      />

      {/* Shallow Diff Modal */}
      {activeDiffLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-xl w-full p-6 text-textPrimary animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold">Audit Event Inspection</h3>
              </div>
              <button
                onClick={() => setActiveDiffLog(null)}
                className="p-1 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-surfaceAlt/40 rounded-xl border border-border">
                <div>
                  <span className="text-textSecondary block">Action</span>
                  <span className="font-mono font-bold text-primary mt-0.5 block">
                    {activeDiffLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-textSecondary block">Target</span>
                  <span className="font-mono text-textPrimary mt-0.5 block">
                    {activeDiffLog.entityType}: {activeDiffLog.entityId}
                  </span>
                </div>
                <div>
                  <span className="text-textSecondary block">Actor</span>
                  <span className="text-textPrimary mt-0.5 block">
                    {activeDiffLog.actorMobile || activeDiffLog.actorId || 'System'}
                  </span>
                </div>
                <div>
                  <span className="text-textSecondary block">Recorded At</span>
                  <span className="font-mono text-textPrimary mt-0.5 block">
                    {new Date(activeDiffLog.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {activeDiffLog.diff && (
                <div>
                  <h4 className="font-bold text-textPrimary mb-2 uppercase tracking-wider text-[11px]">
                    State Changes (Diff)
                  </h4>
                  <pre className="p-3 bg-surfaceAlt rounded-xl border border-border font-mono text-[11px] overflow-x-auto text-textPrimary">
                    {JSON.stringify(activeDiffLog.diff, null, 2)}
                  </pre>
                </div>
              )}

              {activeDiffLog.metadata && (
                <div>
                  <h4 className="font-bold text-textPrimary mb-2 uppercase tracking-wider text-[11px]">
                    Event Metadata & Context
                  </h4>
                  <pre className="p-3 bg-surfaceAlt rounded-xl border border-border font-mono text-[11px] overflow-x-auto text-textPrimary">
                    {JSON.stringify(activeDiffLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                onClick={() => setActiveDiffLog(null)}
                className="px-4 py-2 rounded-lg bg-surfaceAlt text-textPrimary hover:bg-border font-medium text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
