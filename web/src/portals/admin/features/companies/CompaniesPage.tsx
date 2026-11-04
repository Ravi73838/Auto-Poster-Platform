import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { AdminDataTable, type AdminColumn } from '../../components/AdminDataTable';
import { Company360Drawer } from '../../components/Company360Drawer';
import { useApiClient } from '../../../../shared/lib/api';

interface CompanyRow {
  id: string;
  userId: string;
  companyName: string;
  brandName: string | null;
  legalName: string | null;
  gstin: string | null;
  contactPersonPhone: string | null;
  email: string | null;
  isVerified: boolean;
  status: string;
  cityName: string;
  createdAt: string;
}

export function CompaniesPage() {
  const { t } = useTranslation('common');
  const client = useApiClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const q = searchParams.get('q') || '';
  const isVerifiedParam = searchParams.get('isVerified');

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.adminListCompanies({
        page,
        limit,
        q: q || undefined,
        isVerified: isVerifiedParam !== null ? isVerifiedParam === 'true' : undefined,
      });
      setCompanies(res?.companies || []);
      setTotal(res?.total || 0);
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  }, [client, page, limit, q, isVerifiedParam]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleExport = async () => {
    try {
      await client.adminRequestExport({
        reportKey: 'CAMPAIGNS',
      });
      alert('Export job queued! Check the Reports & Exports tab to download once generated.');
    } catch (err: any) {
      alert(err?.message || 'Failed to trigger export');
    }
  };

  const setVerifiedFilter = (val: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val !== null) {
        next.set('isVerified', val);
      } else {
        next.delete('isVerified');
      }
      next.set('page', '1');
      return next;
    });
  };

  const columns: AdminColumn<CompanyRow>[] = [
    {
      id: 'companyName',
      header: 'Company / Brand',
      accessorKey: 'companyName',
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-semibold text-textPrimary hover:text-primary transition-colors block">
            {row.companyName}
          </span>
          {row.brandName && (
            <span className="text-[11px] text-textSecondary">{row.brandName}</span>
          )}
        </div>
      ),
    },
    {
      id: 'gstin',
      header: 'GSTIN (Masked)',
      accessorKey: 'gstin',
      cell: (row) => <span className="font-mono text-xs">{row.gstin || '—'}</span>,
    },
    {
      id: 'cityName',
      header: 'City',
      accessorKey: 'cityName',
      sortable: true,
    },
    {
      id: 'contactPersonPhone',
      header: 'Contact Phone',
      accessorKey: 'contactPersonPhone',
      cell: (row) => <span className="font-mono text-xs">{row.contactPersonPhone || '—'}</span>,
    },
    {
      id: 'isVerified',
      header: 'Verification Status',
      accessorKey: 'isVerified',
      sortable: true,
      cell: (row) =>
        row.isVerified ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success">
            <CheckCircle2 className="w-3 h-3" /> VERIFIED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning">
            <XCircle className="w-3 h-3" /> UNVERIFIED
          </span>
        ),
    },
    {
      id: 'status',
      header: 'Account Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            row.status === 'ACTIVE'
              ? 'bg-success/10 text-success'
              : 'bg-danger/10 text-danger'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: 'Onboarded On',
      accessorKey: 'createdAt',
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-textSecondary">
          {new Date(row.createdAt).toLocaleDateString('en-IN')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Company Accounts"
          description="Manage advertiser businesses, tax compliance (GSTIN/PAN), campaigns, and corporate profiles."
        />
        {/* Verified filter */}
        <div className="flex items-center gap-1 border border-border rounded-xl p-1 bg-surface text-xs font-semibold">
          <button
            onClick={() => setVerifiedFilter(null)}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isVerifiedParam === null ? 'bg-primary/10 text-primary' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setVerifiedFilter('true')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isVerifiedParam === 'true' ? 'bg-primary/10 text-primary' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            Verified GST
          </button>
          <button
            onClick={() => setVerifiedFilter('false')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isVerifiedParam === 'false' ? 'bg-primary/10 text-primary' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            Unverified
          </button>
        </div>
      </div>

      <AdminDataTable
        tableId="companies-registry"
        columns={columns}
        data={companies}
        totalCount={total}
        loading={loading}
        emptyMessage="No advertiser companies found."
        onRowClick={(row) => setSelectedCompanyId(row.id)}
        onExport={handleExport}
      />

      {/* Company 360 Detail Drawer */}
      <Company360Drawer
        companyId={selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
      />
    </div>
  );
}
