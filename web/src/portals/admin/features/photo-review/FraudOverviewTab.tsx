import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Copy,
  Flame,
  HelpCircle,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  TrendingDown,
  User,
  Users,
} from 'lucide-react';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { Spinner } from '../../../../shared/components/Spinner';
import { Modal } from '../../../../shared/components/Modal';
import { EmptyState } from '../../../../shared/components/EmptyState';
import { useApi } from '../../../../shared/lib/api';
import type { FraudOverviewDto } from '@ap/shared-types';

export function FraudOverviewTab() {
  const api = useApi();
  const [data, setData] = useState<FraudOverviewDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getFraudOverview();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fraud overview');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading && !data) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-center justify-between">
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={loadData}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-textPrimary">Proof Integrity & Fraud Signals</h2>
          <p className="text-xs text-textSecondary">
            Cluster detection across device hardware, perceptual image hashes, and high-risk driver behavior
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh Signals
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Flags (7d)
          </span>
          <p className="text-2xl font-bold text-amber-600">
            {data.summary7d.flagCount}
          </p>
          <span className="text-[11px] text-textSecondary">
            {data.summary7d.autoFlaggedCount} automated &bull; {data.summary7d.rejectedCount} rejected
          </span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <Copy className="w-3.5 h-3.5 text-danger" /> Duplicate Clusters
          </span>
          <p className="text-2xl font-bold text-danger">
            {data.nearDuplicateClusters.length}
          </p>
          <span className="text-[11px] text-textSecondary">Perceptual hash collision</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-primary" /> Multi-Account Devices
          </span>
          <p className="text-2xl font-bold text-textPrimary">
            {data.sharedDevices.length}
          </p>
          <span className="text-[11px] text-textSecondary">Shared hardware IDs</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-500" /> Stationary Autos
          </span>
          <p className="text-2xl font-bold text-red-600">
            {data.stationaryAssignments.length}
          </p>
          <span className="text-[11px] text-textSecondary">Zero daily mobility detected</span>
        </Card>
      </div>

      {/* Duplicate Photo Clusters & Shared Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Duplicate Clusters */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-1.5">
              <Copy className="w-4 h-4 text-danger" />
              Perceptual Duplicate Clusters (dHash)
            </h3>
            <span className="text-xs text-textSecondary">
              {data.nearDuplicateClusters.length} clusters
            </span>
          </div>

          {data.nearDuplicateClusters.length === 0 ? (
            <div className="py-8 text-center text-xs text-textSecondary">
              No cross-driver duplicate image clusters detected.
            </div>
          ) : (
            <div className="space-y-3">
              {data.nearDuplicateClusters.map((cluster, i) => (
                <div key={i} className="p-3 rounded-lg bg-surfaceAlt border border-danger/20 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-danger text-[11px] font-semibold">
                      Cluster #{i + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-danger/10 text-danger text-[10px] font-bold">
                      {cluster.photoIds.length} Photos Involved (Distance &le; {cluster.maxDistance})
                    </span>
                  </div>

                  <div className="text-xs text-textSecondary font-mono truncate">
                    IDs: {cluster.photoIds.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Device Correlation */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-primary" />
              Shared Device Fingerprints
            </h3>
            <span className="text-xs text-textSecondary">
              {data.sharedDevices.length} devices
            </span>
          </div>

          {data.sharedDevices.length === 0 ? (
            <div className="py-8 text-center text-xs text-textSecondary">
              No shared devices detected across multiple driver accounts.
            </div>
          ) : (
            <div className="space-y-3">
              {data.sharedDevices.map((device, i) => (
                <div key={i} className="p-3 rounded-lg bg-surfaceAlt border border-border space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[11px] text-textSecondary">
                      {device.deviceInstallId.slice(0, 24)}...
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[10px]">
                      {device.accountCount} Accounts on 1 Phone
                    </span>
                  </div>
                  <div className="text-textPrimary font-medium font-mono text-[11px]">
                    Accounts: {device.accounts.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top Flagged Drivers */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          Top Flagged Drivers
        </h3>

        {data.topFlaggedDrivers.length === 0 ? (
          <div className="py-8 text-center text-xs text-textSecondary">
            All active drivers maintain clean submission compliance.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-textSecondary font-semibold">
                  <th className="pb-2">Driver Name</th>
                  <th className="pb-2">Driver ID</th>
                  <th className="pb-2">Total Flags</th>
                  <th className="pb-2">Total Rejections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topFlaggedDrivers.map((driver) => (
                  <tr key={driver.driverId} className="hover:bg-surfaceAlt">
                    <td className="py-2.5 font-medium text-textPrimary">{driver.driverName}</td>
                    <td className="py-2.5 font-mono text-textSecondary">{driver.driverId}</td>
                    <td className="py-2.5 text-amber-600 font-semibold">{driver.flagCount}</td>
                    <td className="py-2.5 text-danger font-semibold">{driver.rejectCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
