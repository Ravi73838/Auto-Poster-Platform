import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { DataTable, type Column } from '../../../../shared/components/DataTable';
import { Spinner } from '../../../../shared/components/Spinner';
import { useApiClient } from '../../../../shared/lib/api';
import { Download, RefreshCw, CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react';
import { PAYMENT_STATUS } from '@ap/shared-constants';
import type { CampaignPaymentDto } from '@ap/shared-types';

export function CompanyPaymentsPage() {
  const api = useApiClient();
  const [payments, setPayments] = useState<CampaignPaymentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.listCompanyPayments();
      setPayments(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleDownloadInvoice = async (docId: string, docNumber: string) => {
    setDownloadingDocId(docId);
    try {
      const blob = await api.downloadTaxDocumentPdf(docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docNumber.replace(/[\/\\]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download tax document');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const formatINR = (paiseStr: string) => {
    const rupees = Number(paiseStr) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(rupees);
  };

  const columns: Column<CampaignPaymentDto & Record<string, unknown>>[] = [
    {
      header: 'Payment Reference',
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium text-textPrimary text-xs">{row.gatewayPaymentId || row.gatewayOrderId || row.id}</p>
          <p className="text-[11px] text-textSecondary">ID: {row.id.slice(0, 8)}...</p>
        </div>
      ),
    },
    {
      header: 'Campaign',
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="font-semibold text-textPrimary text-xs">{row.campaign?.title ?? row.campaignId.slice(0, 8)}</p>
          <p className="text-[11px] text-textSecondary">ID: {row.campaignId.slice(0, 8)}...</p>
        </div>
      ),
    },
    {
      header: 'Escrow Amount',
      cell: (row) => (
        <span className="font-bold text-textPrimary text-xs">{formatINR(row.amountPaise)}</span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => {
        if (row.status === PAYMENT_STATUS.PAID) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-3 h-3" /> Paid (Escrow)
            </span>
          );
        }
        if (row.status === PAYMENT_STATUS.CREATED) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
              <Clock className="w-3 h-3" /> Processing
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500">
            <AlertCircle className="w-3 h-3" /> {row.status}
          </span>
        );
      },
    },
    {
      header: 'Paid Date',
      cell: (row) => (
        <span className="text-xs text-textSecondary">
          {row.capturedAt ? new Date(row.capturedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      header: 'Tax Invoice',
      cell: (row) => {
        const taxDoc = row.taxDocuments?.[0];
        if (!taxDoc) {
          return <span className="text-xs text-textSecondary">Pending</span>;
        }
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1 py-1 px-2 h-auto"
            disabled={downloadingDocId === taxDoc.id}
            onClick={() => handleDownloadInvoice(taxDoc.id, taxDoc.documentNumber)}
          >
            {downloadingDocId === taxDoc.id ? (
              <Spinner className="w-3 h-3" />
            ) : (
              <Download className="w-3 h-3 text-primary" />
            )}
            {taxDoc.documentNumber}
          </Button>
        );
      },
    },
  ];

  const totalEscrowPaise = payments
    .filter((p) => p.status === PAYMENT_STATUS.PAID)
    .reduce((acc, curr) => acc + BigInt(curr.amountPaise), 0n);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Escrow Payments & Tax Invoices"
          description="View advance escrow deposits, payment receipts, and download GST tax invoices."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={loadPayments}
          disabled={isLoading}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-textSecondary font-medium">Total Escrow Deposited</p>
          <p className="text-xl font-bold text-textPrimary">{formatINR(totalEscrowPaise.toString())}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-textSecondary font-medium">Successful Payments</p>
          <p className="text-xl font-bold text-emerald-500">
            {payments.filter((p) => p.status === PAYMENT_STATUS.PAID).length}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-textSecondary font-medium">GST Compliant Invoices</p>
          <p className="text-xl font-bold text-primary">
            {payments.flatMap((p) => p.taxDocuments ?? []).length}
          </p>
        </Card>
      </div>

      {/* Payments Table */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Transaction History
          </h3>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-500">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={payments as unknown as (CampaignPaymentDto & Record<string, unknown>)[]}
            emptyMessage="No payment orders found. When your campaigns are approved, deposit payments will appear here."
          />
        )}
      </Card>
    </div>
  );
}
