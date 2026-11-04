import { useState, useEffect, useCallback, useRef } from 'react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { Spinner } from '../../../../shared/components/Spinner';
import { useApiClient } from '../../../../shared/lib/api';
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import type { PayoutDto } from '@ap/shared-types';

export function PayoutsPage() {
  const api = useApiClient();
  const [payouts, setPayouts] = useState<PayoutDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPayouts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.listAdminPayouts();
      setPayouts(response.items);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const formatINR = (paiseStr: string) => {
    const rupees = Number(paiseStr) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(rupees);
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      const result = await api.exportPayoutsCsv();
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.batch.batchNumber}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setActionMessage(`Exported batch ${result.batch.batchNumber} with ${result.batch.totalCount} payouts (${formatINR(result.batch.totalAmountPaise)}).`);
      await loadPayouts();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      const text = await file.text();
      const res = await api.importPayoutsCsv({ csvContent: text });
      setActionMessage(`Import processed: ${res.succeeded} succeeded, ${res.failed} failed out of ${res.processed} rows.`);
      await loadPayouts();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const approvedPayoutsCount = payouts.filter((p) => p.status === 'APPROVED').length;
  const approvedTotalPaise = payouts
    .filter((p) => p.status === 'APPROVED')
    .reduce((sum, p) => sum + BigInt(p.amountPaise), 0n);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Driver Payouts & Disbursal Batches"
          description="Review withdrawal requests, export bank-ready CSV batches, and import UTR transaction confirmations."
        />
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs"
          >
            {isImporting ? <Spinner className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5 text-primary" />}
            Import Bank UTR CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={isExporting || approvedPayoutsCount === 0}
            onClick={handleExportCsv}
            className="gap-1.5 text-xs"
          >
            {isExporting ? <Spinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            Export Batch CSV ({approvedPayoutsCount})
          </Button>
          <Button variant="outline" size="sm" onClick={loadPayouts} disabled={isLoading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-500 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {actionMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-textSecondary font-medium">Ready for Batch Export</p>
          <p className="text-xl font-bold text-primary">{formatINR(approvedTotalPaise.toString())}</p>
          <p className="text-[11px] text-textSecondary">{approvedPayoutsCount} withdrawal requests approved</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-textSecondary font-medium">In Transit / Processing</p>
          <p className="text-xl font-bold text-amber-500">
            {payouts.filter((p) => p.status === 'PROCESSING').length}
          </p>
          <p className="text-[11px] text-textSecondary">Awaiting bank UTR reconciliation</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-textSecondary font-medium">Successfully Disbursed</p>
          <p className="text-xl font-bold text-emerald-500">
            {payouts.filter((p) => p.status === 'PAID').length}
          </p>
          <p className="text-[11px] text-textSecondary">Completed driver bank transfers</p>
        </Card>
      </div>

      {/* Payouts Table */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Payout Requests & History
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surfaceAlt/50 text-textSecondary uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-4 py-2">Payout ID</th>
                <th className="px-4 py-2">Driver</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Account / UPI</th>
                <th className="px-4 py-2">UTR Reference</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-textPrimary">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-surfaceAlt/30">
                  <td className="px-4 py-2.5 font-mono text-[11px]">{p.id.slice(0, 8)}...</td>
                  <td className="px-4 py-2.5 font-medium">{p.driverId.slice(0, 8)}...</td>
                  <td className="px-4 py-2.5 font-bold text-textPrimary">{formatINR(p.amountPaise)}</td>
                  <td className="px-4 py-2.5 font-semibold text-[11px]">{p.method}</td>
                  <td className="px-4 py-2.5 text-textSecondary font-mono text-[11px]">
                    {p.gatewayReference || 'Verified Details on File'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">
                    {p.utr || <span className="text-textSecondary">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium inline-flex items-center gap-1 ${
                      p.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' :
                      p.status === 'APPROVED' ? 'bg-primary/10 text-primary' :
                      p.status === 'PROCESSING' ? 'bg-amber-500/10 text-amber-500' :
                      p.status === 'FAILED' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-surfaceAlt text-textSecondary'
                    }`}>
                      {p.status === 'PAID' && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {p.status === 'PROCESSING' && <Clock className="w-2.5 h-2.5" />}
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-textSecondary text-[11px]">
                    {new Date(p.requestedAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
