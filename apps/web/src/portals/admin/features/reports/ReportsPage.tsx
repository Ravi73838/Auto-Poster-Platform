import React, { useState, useEffect } from 'react';
import { Download, FileText, Plus, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { useApiClient } from '../../../../shared/lib/api';

interface ExportJob {
  id: string;
  reportType: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'EXPIRED';
  format: string;
  rowCount: number | null;
  fileSizeBytes: number | null;
  downloadUrl?: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export function AdminReportsPage() {
  const client = useApiClient();
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportType, setReportType] = useState('DRIVERS');
  const [requesting, setRequesting] = useState(false);

  const loadExports = async () => {
    try {
      setLoading(true);
      const res = await client.adminListExports();
      setJobs(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load export jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExports();
  }, []);

  const handleRequestExport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRequesting(true);
      await client.adminRequestExport({
        reportKey: reportType,
      });
      setIsModalOpen(false);
      await loadExports();
    } catch (err: any) {
      alert(err?.message || 'Failed to request export job');
    } finally {
      setRequesting(false);
    }
  };

  const handleDownload = (jobId: string) => {
    // Direct browser navigation to download endpoint with token
    window.open(`/api/v1/admin/reports/exports/${jobId}/download`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Reports & Compliance Data Exports"
          description="Generate and download secure CSV exports for accounting, tax filings, and fleet analytics."
        />
        <div className="flex items-center gap-2">
          <button
            onClick={loadExports}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
            title="Refresh exports list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Export</span>
          </button>
        </div>
      </div>

      {/* Export Jobs List */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border bg-surfaceAlt/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-textPrimary">Recent Export Downloads</h3>
          <span className="text-xs text-textSecondary">{jobs.length} jobs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surfaceAlt text-textSecondary border-b border-border uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">Report Category</th>
                <th className="px-5 py-3">Format</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Total Rows</th>
                <th className="px-5 py-3">File Size</th>
                <th className="px-5 py-3">Requested At</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-textPrimary">
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-textSecondary">
                    Loading export jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-textSecondary">
                    No reports generated yet. Click "Generate New Export" above to create one.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surfaceAlt/40 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-textPrimary">
                      {job.reportType}
                    </td>
                    <td className="px-5 py-3.5 font-mono">{job.format}</td>
                    <td className="px-5 py-3.5">
                      {job.status === 'DONE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success">
                          <CheckCircle2 className="w-3 h-3" /> READY
                        </span>
                      )}
                      {job.status === 'RUNNING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                          <RefreshCw className="w-3 h-3 animate-spin" /> RUNNING
                        </span>
                      )}
                      {job.status === 'QUEUED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surfaceAlt text-textSecondary">
                          <Clock className="w-3 h-3" /> QUEUED
                        </span>
                      )}
                      {job.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-danger/10 text-danger" title={job.errorMessage || 'Export failed'}>
                          <XCircle className="w-3 h-3" /> FAILED
                        </span>
                      )}
                      {job.status === 'EXPIRED' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surfaceAlt text-textSecondary">
                          EXPIRED
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {job.rowCount !== null ? job.rowCount.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      {job.fileSizeBytes
                        ? `${(job.fileSizeBytes / 1024).toFixed(1)} KB`
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-textSecondary">
                      {new Date(job.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {job.status === 'DONE' ? (
                        <button
                          onClick={() => handleDownload(job.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-white hover:bg-primary/90 font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      ) : (
                        <span className="text-textSecondary text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Export Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleRequestExport}
            className="bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 text-textPrimary animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="text-base font-bold">Generate CSV Export</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-textSecondary mb-1.5 font-medium">
                  Select Dataset / Report Type
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-textPrimary outline-none focus:border-primary text-xs"
                >
                  <option value="DRIVERS">Drivers & Vehicle Profiles</option>
                  <option value="CAMPAIGNS">Campaigns & Budgets</option>
                  <option value="ASSIGNMENTS">Assignments & Daily Performance</option>
                  <option value="PAYMENTS">Inbound Payments & Gateway Transactions</option>
                  <option value="PAYOUTS">Driver Payout Batches & Allowances</option>
                  <option value="AUDIT_LOGS">Security & Administrative Audit Logs</option>
                </select>
              </div>

              <div className="p-3 bg-surfaceAlt/40 rounded-lg border border-border text-textSecondary space-y-1">
                <span className="font-semibold block text-textPrimary">Export Notice:</span>
                <p>
                  Export files are streamed and signed securely with a 24-hour expiration link.
                  Personally identifiable columns are logged in the audit trail.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surfaceAlt text-textPrimary hover:bg-border font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={requesting}
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 font-medium transition-colors disabled:opacity-50"
              >
                {requesting ? 'Queuing Export...' : 'Queue Export'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
