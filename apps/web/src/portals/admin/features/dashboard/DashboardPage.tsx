import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  Truck,
  Megaphone,
  CheckCircle,
  IndianRupee,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building,
  RefreshCw,
  FileCheck,
  Eye,
} from 'lucide-react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { useApiClient } from '../../../../shared/lib/api';

export function AdminDashboardPage() {
  const { t } = useTranslation('common');
  const client = useApiClient();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [roleView, setRoleView] = useState<'SUPER_ADMIN' | 'MODERATOR' | 'FINANCE'>('SUPER_ADMIN');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await client.adminGetAnalyticsOverview();
      setAnalytics(res);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatRupees = (paiseStr: string = '0') => {
    const val = Number(paiseStr) / 100;
    return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={t('dashboard')}
          description="Nationwide operational analytics, review queues, and financial summary."
        />
        <div className="flex items-center gap-2">
          {/* Role Perspective Switcher */}
          <div className="flex items-center border border-border rounded-xl p-1 bg-surface text-xs font-semibold">
            <button
              onClick={() => setRoleView('SUPER_ADMIN')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                roleView === 'SUPER_ADMIN'
                  ? 'bg-primary/10 text-primary'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Executive
            </button>
            <button
              onClick={() => setRoleView('MODERATOR')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                roleView === 'MODERATOR'
                  ? 'bg-primary/10 text-primary'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Operations / Ops
            </button>
            <button
              onClick={() => setRoleView('FINANCE')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                roleView === 'FINANCE'
                  ? 'bg-primary/10 text-primary'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Finance / Payouts
            </button>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !analytics ? (
        <div className="py-24 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* EXECUTIVE / SUPER ADMIN VIEW */}
          {roleView === 'SUPER_ADMIN' && (
            <div className="space-y-6">
              {/* Nationwide KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Live Campaigns</span>
                    <div className="text-xl font-bold text-textPrimary mt-0.5">
                      {analytics?.metrics?.liveCampaigns ?? 0}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Running Autos</span>
                    <div className="text-xl font-bold text-textPrimary mt-0.5">
                      {analytics?.metrics?.activeAssignments ?? 0}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-success/10 text-success">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Verified Days Today</span>
                    <div className="text-xl font-bold text-textPrimary mt-0.5">
                      {analytics?.metrics?.verifiedDaysToday ?? 0}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Gross Platform GMV</span>
                    <div className="text-xl font-bold text-textPrimary mt-0.5">
                      {formatRupees(analytics?.metrics?.totalGmvPaise)}
                    </div>
                  </div>
                </Card>
              </div>

              {/* City Breakdown Table */}
              <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b border-border bg-surfaceAlt/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold">City-Wise Fleet & Coverage</h3>
                  </div>
                  <span className="text-xs text-textSecondary">
                    {analytics?.cityBreakdown?.length || 0} active markets
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surfaceAlt text-textSecondary border-b border-border uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-5 py-3">City</th>
                        <th className="px-5 py-3">Active Campaigns</th>
                        <th className="px-5 py-3">Running Autos</th>
                        <th className="px-5 py-3">Verified Days Today</th>
                        <th className="px-5 py-3 text-right">GMV (Paise)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-textPrimary">
                      {analytics?.cityBreakdown?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-textSecondary">
                            No city data available yet.
                          </td>
                        </tr>
                      ) : (
                        analytics?.cityBreakdown?.map((city: any, idx: number) => (
                          <tr key={idx} className="hover:bg-surfaceAlt/40 transition-colors">
                            <td className="px-5 py-3.5 font-semibold">{city.cityName}</td>
                            <td className="px-5 py-3.5">{city.liveCampaigns}</td>
                            <td className="px-5 py-3.5">{city.activeAutos}</td>
                            <td className="px-5 py-3.5 text-success font-medium">
                              {city.verifiedDaysToday}
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-medium">
                              {formatRupees(city.gmvPaise)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* MODERATOR / OPERATIONS QUEUE VIEW */}
          {roleView === 'MODERATOR' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center gap-3 border-l-4 border-l-warning">
                  <div className="p-3 rounded-xl bg-warning/10 text-warning">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Pending Driver KYC</span>
                    <div className="text-xl font-bold text-textPrimary mt-0.5">
                      {analytics?.queues?.kycPending ?? 0}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3 border-l-4 border-l-primary">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Campaign Approvals</span>
                    <div className="text-xl font-bold text-textPrimary mt-0.5">
                      {analytics?.queues?.campaignsPending ?? 0}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3 border-l-4 border-l-blue-500">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Install Checks</span>
                    <div className="text-xl font-bold text-textPrimary mt-0.5">
                      {analytics?.queues?.installationsPending ?? 0}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3 border-l-4 border-l-danger">
                  <div className="p-3 rounded-xl bg-danger/10 text-danger">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Flagged Photos</span>
                    <div className="text-xl font-bold text-textPrimary mt-0.5">
                      {analytics?.queues?.photosFlagged ?? 0}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Action Banner */}
              <Card className="p-6 bg-gradient-to-r from-primary/10 via-surface to-surface border border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-bold text-textPrimary">Operations Work Queue</h4>
                  <p className="text-xs text-textSecondary mt-1">
                    Process pending verifications, review claimed tasks, and handle dispute escalations.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/admin/my-work"
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    Open My Work Inbox
                  </a>
                  <a
                    href="/admin/photo-review"
                    className="px-4 py-2 rounded-xl bg-surface border border-border text-textPrimary text-xs font-semibold hover:bg-surfaceAlt transition-colors"
                  >
                    Review Photos
                  </a>
                </div>
              </Card>
            </div>
          )}

          {/* FINANCE / MONEY VIEW */}
          {roleView === 'FINANCE' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-success/10 text-success">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Escrow Balance</span>
                    <div className="text-lg font-bold text-textPrimary mt-0.5">
                      {formatRupees(analytics?.finance?.escrowBalancePaise)}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Pending Payouts</span>
                    <div className="text-lg font-bold text-textPrimary mt-0.5">
                      {analytics?.finance?.pendingPayoutsCount ?? 0}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-warning/10 text-warning">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Held Settlement</span>
                    <div className="text-lg font-bold text-textPrimary mt-0.5">
                      {formatRupees(analytics?.finance?.heldSettlementPaise)}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-textSecondary font-medium">Net Platform Margin</span>
                    <div className="text-lg font-bold text-textPrimary mt-0.5">
                      {formatRupees(analytics?.finance?.platformNetPaise)}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Quick links to Finance modules */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a
                  href="/admin/payments"
                  className="p-4 rounded-xl border border-border bg-surface hover:bg-surfaceAlt/60 transition-colors block"
                >
                  <span className="text-xs font-bold text-primary block">Payment Gateways & Escrow</span>
                  <p className="text-xs text-textSecondary mt-1">
                    Monitor Razorpay webhooks, inbound payments, and refunds ledger.
                  </p>
                </a>
                <a
                  href="/admin/payouts"
                  className="p-4 rounded-xl border border-border bg-surface hover:bg-surfaceAlt/60 transition-colors block"
                >
                  <span className="text-xs font-bold text-primary block">Payout Batches</span>
                  <p className="text-xs text-textSecondary mt-1">
                    Approve driver rent and printing allowance payouts via IMPS/NEFT.
                  </p>
                </a>
                <a
                  href="/admin/reports"
                  className="p-4 rounded-xl border border-border bg-surface hover:bg-surfaceAlt/60 transition-colors block"
                >
                  <span className="text-xs font-bold text-primary block">Tax & Financial Exports</span>
                  <p className="text-xs text-textSecondary mt-1">
                    Download GST compliance reports, ledger balances, and payment audits.
                  </p>
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
