import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { DataTable, type Column } from '../../../../shared/components/DataTable';
import { Spinner } from '../../../../shared/components/Spinner';
import { Modal } from '../../../../shared/components/Modal';
import { Input } from '../../../../shared/components/Input';
import { useApiClient } from '../../../../shared/lib/api';
import {
  DollarSign,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Scale,
  ArrowRightLeft,
  Pause,
  Play,
  RotateCcw,
  Plus,
} from 'lucide-react';
import type {
  FinanceDashboardDto,
  TrialBalanceDto,
  AssignmentSettlementDto,
  RefundDto,
  LedgerAccountDto,
} from '@ap/shared-types';

export function AdminPaymentsPage() {
  const api = useApiClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'settlements' | 'refunds' | 'ledger'>('overview');
  const [dashboard, setDashboard] = useState<FinanceDashboardDto | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceDto | null>(null);
  const [settlements, setSettlements] = useState<AssignmentSettlementDto[]>([]);
  const [refunds, setRefunds] = useState<RefundDto[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccountDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseType, setPauseType] = useState<'payments' | 'payouts'>('payments');
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundCampaignId, setRefundCampaignId] = useState('');
  const [refundAmountPaise, setRefundAmountPaise] = useState('');
  const [refundReason, setRefundReason] = useState<'UNFILLED_SLOTS' | 'CAMPAIGN_CANCELLED' | 'MANUAL_CORRECTION'>('UNFILLED_SLOTS');
  const [refundNotes, setRefundNotes] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const [dash, tb, stl, rfd, acc] = await Promise.all([
        api.getFinanceDashboard(),
        api.getTrialBalance(),
        api.listFinanceSettlements(),
        api.listFinanceRefunds(1, 50),
        api.listLedgerAccounts(),
      ]);
      setDashboard(dash);
      setTrialBalance(tb);
      setSettlements(stl);
      setRefunds(rfd.data);
      setAccounts(acc);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load finance data');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatINR = (paiseStr: string) => {
    const rupees = Number(paiseStr) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(rupees);
  };

  const handleTogglePause = async (type: 'payments' | 'payouts') => {
    if (!dashboard) return;
    const currentlyEnabled = type === 'payments' ? dashboard.paymentsEnabled : dashboard.payoutsEnabled;
    if (currentlyEnabled) {
      // Prompt for reason modal
      setPauseType(type);
      setIsPauseModalOpen(true);
    } else {
      // Resume immediately
      try {
        await api.toggleFinancePause({
          paymentsEnabled: type === 'payments' ? true : undefined,
          payoutsEnabled: type === 'payouts' ? true : undefined,
          reason: `Resumed ${type} processing by administrator`,
        });
        await loadData();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to toggle pause');
      }
    }
  };

  const confirmPause = async () => {
    if (!pauseReason.trim()) {
      alert('A valid reason is required for safety pausing');
      return;
    }
    try {
      await api.toggleFinancePause({
        paymentsEnabled: pauseType === 'payments' ? false : undefined,
        payoutsEnabled: pauseType === 'payouts' ? false : undefined,
        reason: pauseReason,
      });
      setIsPauseModalOpen(false);
      setPauseReason('');
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to pause');
    }
  };

  const handleApproveSettlement = async (settlementId: string) => {
    try {
      await api.reviewFinanceSettlement(settlementId, { decision: 'APPROVE' });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve settlement');
    }
  };

  const handleApproveRefund = async (refundId: string) => {
    try {
      await api.reviewFinanceRefund(refundId, { decision: 'APPROVED' });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve refund');
    }
  };

  const handleRejectRefund = async (refundId: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    try {
      await api.reviewFinanceRefund(refundId, { decision: 'REJECTED', rejectionReason: reason });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject refund');
    }
  };

  const handleCreateRefund = async () => {
    if (!refundCampaignId || !refundAmountPaise) {
      alert('Please enter campaign ID and amount in paise');
      return;
    }
    try {
      await api.requestFinanceRefund({
        campaignId: refundCampaignId,
        amountPaise: refundAmountPaise,
        reason: refundReason,
        notes: refundNotes,
      });
      setIsRefundModalOpen(false);
      setRefundCampaignId('');
      setRefundAmountPaise('');
      setRefundNotes('');
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to request refund');
    }
  };

  const handleCampaignCloseout = async () => {
    const cid = prompt('Enter Campaign ID to execute closeout & escrow sweep:');
    if (!cid) return;
    try {
      const res = await api.closeoutCampaign(cid);
      alert(`Closeout complete. Swept ${formatINR(res.sweptAmountPaise)} to company refund reserve.`);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Closeout failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Financial Ledger & Treasury Portal"
          description="Double-entry ledger control, settlement queues, maker-checker refunds, and real-time trial balance."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCampaignCloseout} className="gap-1.5 text-xs">
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
            Closeout Campaign
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-500">
          {actionError}
        </div>
      )}

      {/* Emergency Pause Kill Switches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-textPrimary">Company Payments Processing</p>
            <p className="text-[11px] text-textSecondary">
              Status: {dashboard?.paymentsEnabled ? (
                <span className="text-emerald-500 font-medium">LIVE / ACCEPTING</span>
              ) : (
                <span className="text-rose-500 font-bold">PAUSED (KILL SWITCH ACTIVE)</span>
              )}
            </p>
          </div>
          <Button
            size="sm"
            variant={dashboard?.paymentsEnabled ? 'outline' : 'primary'}
            onClick={() => handleTogglePause('payments')}
            className="text-xs gap-1.5"
          >
            {dashboard?.paymentsEnabled ? <Pause className="w-3.5 h-3.5 text-rose-500" /> : <Play className="w-3.5 h-3.5" />}
            {dashboard?.paymentsEnabled ? 'Pause Inflows' : 'Resume Inflows'}
          </Button>
        </Card>

        <Card className="p-4 flex items-center justify-between border-l-4 border-l-primary">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-textPrimary">Driver Payouts Processing</p>
            <p className="text-[11px] text-textSecondary">
              Status: {dashboard?.payoutsEnabled ? (
                <span className="text-emerald-500 font-medium">LIVE / PROCESSING</span>
              ) : (
                <span className="text-rose-500 font-bold">PAUSED (KILL SWITCH ACTIVE)</span>
              )}
            </p>
          </div>
          <Button
            size="sm"
            variant={dashboard?.payoutsEnabled ? 'outline' : 'primary'}
            onClick={() => handleTogglePause('payouts')}
            className="text-xs gap-1.5"
          >
            {dashboard?.payoutsEnabled ? <Pause className="w-3.5 h-3.5 text-rose-500" /> : <Play className="w-3.5 h-3.5" />}
            {dashboard?.payoutsEnabled ? 'Pause Outflows' : 'Resume Outflows'}
          </Button>
        </Card>
      </div>

      {/* Financial Health Indicators */}
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="p-3 space-y-1">
            <p className="text-[11px] text-textSecondary">Campaign Escrow</p>
            <p className="text-base font-bold text-textPrimary">{formatINR(dashboard.escrowBalancePaise)}</p>
          </Card>
          <Card className="p-3 space-y-1">
            <p className="text-[11px] text-textSecondary">Platform Revenue</p>
            <p className="text-base font-bold text-emerald-500">{formatINR(dashboard.platformRevenuePaise)}</p>
          </Card>
          <Card className="p-3 space-y-1">
            <p className="text-[11px] text-textSecondary">GST Payable</p>
            <p className="text-base font-bold text-textPrimary">{formatINR(dashboard.gstPayablePaise)}</p>
          </Card>
          <Card className="p-3 space-y-1">
            <p className="text-[11px] text-textSecondary">Pending Settlements</p>
            <p className="text-base font-bold text-amber-500">{dashboard.pendingSettlementsCount}</p>
          </Card>
          <Card className="p-3 space-y-1">
            <p className="text-[11px] text-textSecondary">Pending Payouts</p>
            <p className="text-base font-bold text-amber-500">{dashboard.pendingPayoutsCount}</p>
          </Card>
          <Card className="p-3 space-y-1">
            <p className="text-[11px] text-textSecondary">Pending Refunds</p>
            <p className="text-base font-bold text-rose-500">{dashboard.pendingRefundsCount}</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'overview' ? 'border-primary text-primary font-semibold' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Trial Balance & Ledger
        </button>
        <button
          onClick={() => setActiveTab('settlements')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'settlements' ? 'border-primary text-primary font-semibold' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Settlements Queue
          {settlements.filter((s) => s.status === 'PENDING' || s.status === 'HOLD').length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-500 rounded-full text-[10px]">
              {settlements.filter((s) => s.status === 'PENDING' || s.status === 'HOLD').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('refunds')}
          className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'refunds' ? 'border-primary text-primary font-semibold' : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Maker-Checker Refunds
          {refunds.filter((r) => r.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500/10 text-rose-500 rounded-full text-[10px]">
              {refunds.filter((r) => r.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Overview & Trial Balance */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {trialBalance && (
            <Card className={`p-5 space-y-3 border-l-4 ${trialBalance.isBalanced ? 'border-l-emerald-500' : 'border-l-rose-500'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className={`w-5 h-5 ${trialBalance.isBalanced ? 'text-emerald-500' : 'text-rose-500'}`} />
                  <h3 className="text-sm font-bold text-textPrimary">
                    Global Trial Balance: {trialBalance.isBalanced ? (
                      <span className="text-emerald-500">BALANCED (Debits == Credits)</span>
                    ) : (
                      <span className="text-rose-500">IMBALANCE DETECTED (Diff: {formatINR(trialBalance.diffPaise)})</span>
                    )}
                  </h3>
                </div>
                <span className="text-[11px] text-textSecondary">As of {new Date(trialBalance.asOf).toLocaleTimeString()}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3 bg-surfaceAlt/40 rounded-lg">
                  <p className="text-[11px] text-textSecondary">Total Debits</p>
                  <p className="text-base font-bold text-textPrimary">{formatINR(trialBalance.totalDebitsPaise)}</p>
                </div>
                <div className="p-3 bg-surfaceAlt/40 rounded-lg">
                  <p className="text-[11px] text-textSecondary">Total Credits</p>
                  <p className="text-base font-bold text-textPrimary">{formatINR(trialBalance.totalCreditsPaise)}</p>
                </div>
                <div className="p-3 bg-surfaceAlt/40 rounded-lg">
                  <p className="text-[11px] text-textSecondary">Ledger Discrepancy</p>
                  <p className={`text-base font-bold ${trialBalance.diffPaise === '0' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatINR(trialBalance.diffPaise)}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-textPrimary">Chart of Accounts</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surfaceAlt/50 text-textSecondary uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Account Type</th>
                    <th className="px-4 py-2">Owner / Ref</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-textPrimary">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-surfaceAlt/30">
                      <td className="px-4 py-2.5 font-mono font-medium">{acc.code}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surfaceAlt border border-border">
                          {acc.accountType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-textSecondary text-[11px]">
                        {acc.campaignId ? `Campaign ${acc.campaignId.slice(0, 8)}` : acc.userId ? `User ${acc.userId.slice(0, 8)}` : 'System Global'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold">
                        {formatINR(acc.balancePaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Settlements Queue */}
      {activeTab === 'settlements' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-textPrimary">Driver Run Settlements Queue</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceAlt/50 text-textSecondary uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-2">Assignment</th>
                  <th className="px-4 py-2">Verified / Total</th>
                  <th className="px-4 py-2">Driver Rent</th>
                  <th className="px-4 py-2">Refund to Co.</th>
                  <th className="px-4 py-2">Fee + GST</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-textPrimary">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-surfaceAlt/30">
                    <td className="px-4 py-2.5 font-mono text-[11px]">{s.assignmentId.slice(0, 8)}...</td>
                    <td className="px-4 py-2.5">
                      {s.verifiedDays} / {s.totalDays} days
                      {s.missedDays > 0 && <span className="text-rose-500 text-[10px] ml-1">({s.missedDays} missed)</span>}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-emerald-500">{formatINR(s.rentPayablePaise)}</td>
                    <td className="px-4 py-2.5 text-textSecondary">{formatINR(s.companyRefundPaise)}</td>
                    <td className="px-4 py-2.5 text-textSecondary">
                      {formatINR((BigInt(s.commissionPaise) + BigInt(s.gstPaise)).toString())}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.status === 'APPROVED' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500">
                          Approved
                        </span>
                      ) : s.status === 'HOLD' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-500 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Hold Anomaly
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.status !== 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="text-[11px] py-1 px-2.5 h-auto"
                          onClick={() => handleApproveSettlement(s.id)}
                        >
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Maker-Checker Refunds */}
      {activeTab === 'refunds' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-textPrimary">Dual-Control Refund Approvals</h3>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setIsRefundModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Request Refund
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surfaceAlt/50 text-textSecondary uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-2">Refund ID</th>
                  <th className="px-4 py-2">Campaign</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Maker-Checker Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-textPrimary">
                {refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-surfaceAlt/30">
                    <td className="px-4 py-2.5 font-mono text-[11px]">{r.id.slice(0, 8)}...</td>
                    <td className="px-4 py-2.5 font-medium">{r.campaignId.slice(0, 8)}...</td>
                    <td className="px-4 py-2.5 font-bold text-textPrimary">{formatINR(r.amountPaise)}</td>
                    <td className="px-4 py-2.5 text-textSecondary">{r.reason}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        r.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' :
                        r.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-1">
                      {r.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            className="text-[11px] py-1 px-2 h-auto"
                            onClick={() => handleApproveRefund(r.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[11px] py-1 px-2 h-auto text-rose-500 hover:text-rose-600"
                            onClick={() => handleRejectRefund(r.id)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Emergency Pause Reason Modal */}
      {isPauseModalOpen && (
        <Modal isOpen={isPauseModalOpen} onClose={() => setIsPauseModalOpen(false)} title="Emergency Circuit Breaker">
          <div className="space-y-4">
            <p className="text-xs text-rose-500 font-semibold">
              Warning: Pausing {pauseType} processing will immediately block all incoming or outgoing fund operations.
            </p>
            <div>
              <label className="block text-xs font-medium text-textPrimary mb-1">Reason for Emergency Pause</label>
              <textarea
                rows={3}
                className="w-full text-xs p-2.5 border border-border rounded-lg bg-surface text-textPrimary focus:ring-1 focus:ring-primary"
                placeholder="Audit check, suspected anomalous activity, bank holiday, etc."
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsPauseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={confirmPause}>
                Confirm Emergency Pause
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Request Refund Modal */}
      {isRefundModalOpen && (
        <Modal isOpen={isRefundModalOpen} onClose={() => setIsRefundModalOpen(false)} title="Initiate Company Refund (Maker)">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-textPrimary mb-1">Campaign ID</label>
              <Input
                value={refundCampaignId}
                onChange={(e) => setRefundCampaignId(e.target.value)}
                placeholder="UUID of campaign"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-textPrimary mb-1">Amount (in Paise)</label>
              <Input
                value={refundAmountPaise}
                onChange={(e) => setRefundAmountPaise(e.target.value)}
                placeholder="e.g. 50000 for ₹500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-textPrimary mb-1">Reason</label>
              <select
                className="w-full text-xs p-2 border border-border rounded-lg bg-surface text-textPrimary"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value as any)}
              >
                <option value="UNFILLED_SLOTS">Unfilled Slots</option>
                <option value="CAMPAIGN_CANCELLED">Campaign Cancelled</option>
                <option value="MANUAL_CORRECTION">Manual Correction</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-textPrimary mb-1">Audit Notes</label>
              <textarea
                rows={2}
                className="w-full text-xs p-2 border border-border rounded-lg bg-surface text-textPrimary"
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                placeholder="Notes for reviewer"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsRefundModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateRefund}>
                Submit for Checker Review
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
