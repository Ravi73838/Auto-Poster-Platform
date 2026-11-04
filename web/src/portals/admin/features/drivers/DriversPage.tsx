import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserCheck, ShieldAlert, CheckCircle, Clock, XCircle } from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { AdminDataTable, type AdminColumn } from '../../components/AdminDataTable';
import { Driver360Drawer } from '../../components/Driver360Drawer';
import { useApiClient } from '../../../../shared/lib/api';

interface DriverRow {
  id: string;
  userId: string;
  fullName: string;
  mobile: string;
  email: string | null;
  status: string;
  kycStatus: string;
  cityName: string;
  vehicleNumber: string;
  createdAt: string;
}

export function DriversPage() {
  const { t } = useTranslation('common');
  const client = useApiClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const q = searchParams.get('q') || '';
  const kycStatus = searchParams.get('kycStatus') || '';

  const loadDrivers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.adminListDrivers({
        page,
        limit,
        q: q || undefined,
        kycStatus: kycStatus || undefined,
      });
      setDrivers(res?.drivers || []);
      setTotal(res?.total || 0);
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setLoading(false);
    }
  }, [client, page, limit, q, kycStatus]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const handleExport = async () => {
    try {
      await client.adminRequestExport({
        reportKey: 'DRIVERS',
      });
      alert('Driver export job queued! Check the Reports & Exports tab to download once generated.');
    } catch (err: any) {
      alert(err?.message || 'Failed to trigger driver export');
    }
  };

  const setKycFilter = (status: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (status) {
        next.set('kycStatus', status);
      } else {
        next.delete('kycStatus');
      }
      next.set('page', '1');
      return next;
    });
  };

  const columns: AdminColumn<DriverRow>[] = [
    {
      id: 'fullName',
      header: 'Driver Name',
      accessorKey: 'fullName',
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-semibold text-textPrimary hover:text-primary transition-colors block">
            {row.fullName}
          </span>
          <span className="text-[11px] text-textSecondary font-mono">{row.vehicleNumber}</span>
        </div>
      ),
    },
    {
      id: 'mobile',
      header: 'Phone (Masked)',
      accessorKey: 'mobile',
      cell: (row) => <span className="font-mono text-xs">{row.mobile}</span>,
    },
    {
      id: 'cityName',
      header: 'City',
      accessorKey: 'cityName',
      sortable: true,
    },
    {
      id: 'kycStatus',
      header: 'KYC Status',
      accessorKey: 'kycStatus',
      sortable: true,
      cell: (row) => {
        switch (row.kycStatus) {
          case 'APPROVED':
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success">
                <CheckCircle className="w-3 h-3" /> APPROVED
              </span>
            );
          case 'SUBMITTED':
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-warning/10 text-warning">
                <Clock className="w-3 h-3" /> PENDING REVIEW
              </span>
            );
          case 'REJECTED':
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-danger/10 text-danger">
                <XCircle className="w-3 h-3" /> REJECTED
              </span>
            );
          default:
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-surfaceAlt text-textSecondary">
                DRAFT
              </span>
            );
        }
      },
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
      header: 'Registered On',
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
          title="Driver Management"
          description="View all auto-rickshaw partners, KYC approvals, fleet vehicles, and 360° histories."
        />
        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-1 border border-border rounded-xl p-1 bg-surface text-xs font-semibold">
          <button
            onClick={() => setKycFilter('')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              !kycStatus ? 'bg-primary/10 text-primary' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setKycFilter('SUBMITTED')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              kycStatus === 'SUBMITTED' ? 'bg-primary/10 text-primary' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            Pending KYC
          </button>
          <button
            onClick={() => setKycFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              kycStatus === 'APPROVED' ? 'bg-primary/10 text-primary' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            Verified
          </button>
        </div>
      </div>

      <AdminDataTable
        tableId="drivers-registry"
        columns={columns}
        data={drivers}
        totalCount={total}
        loading={loading}
        emptyMessage="No drivers found matching your search criteria."
        onRowClick={(row) => setSelectedDriverId(row.id)}
        onExport={handleExport}
      />

      {/* Driver 360 Detail Drawer */}
      <Driver360Drawer
        driverId={selectedDriverId}
        onClose={() => setSelectedDriverId(null)}
      />
    </div>
  );
}
