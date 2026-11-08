import React, { useEffect, useState } from 'react';
import { useApiClient } from '../../../shared/lib/api';
import {
  Gauge,
  Users,
  Building,
  Megaphone,
  CreditCard,
  Banknote,
  AlertTriangle,
  FileCheck2,
  PhoneCall,
  Star,
  RefreshCw,
  PlusCircle,
  KeyRound,
} from 'lucide-react';
import type { PilotCommandCenter } from '@ap/shared-types';
import { Link } from 'react-router-dom';

export function PilotCommandCenterPage() {
  const client = useApiClient();
  const [data, setData] = useState<PilotCommandCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.adminGetPilotCommandCenter();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Pilot Command Center data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [client]);

  const counters = data?.counters;
  const anomalies = data?.anomalies;
  const feedback = data?.feedback;
  const support = data?.support;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-textPrimary">Pilot Command Center</h1>
            <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              PHASE 15 ACTIVE
            </span>
          </div>
          <p className="text-sm text-textSecondary mt-1">
            Real-time monitoring of pilot guardrails, invite quotas, quality audits, and incident triage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/launch-readiness"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surfaceAlt text-sm font-medium transition-colors"
          >
            <FileCheck2 className="w-4 h-4 text-primary" />
            <span>Readiness Gate</span>
          </Link>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primaryText text-sm font-semibold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {/* Guardrail Caps & Live Utilization Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Drivers Cap Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between text-textSecondary">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Driver Fleet</span>
            </div>
            {counters?.isInviteOnlyDrivers ? (
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Invite-Only
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-textPrimary">
              {counters?.activeDrivers ?? 0}
              <span className="text-base font-normal text-textSecondary ml-1">
                / {counters?.maxDrivers ?? 50}
              </span>
            </div>
            <span className="text-xs font-semibold text-textSecondary">
              {Math.round(((counters?.activeDrivers ?? 0) / (counters?.maxDrivers || 50)) * 100)}% Cap
            </span>
          </div>
          <div className="w-full bg-surfaceAlt rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  Math.round(((counters?.activeDrivers ?? 0) / (counters?.maxDrivers || 50)) * 100),
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Company Cap Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between text-textSecondary">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Advertisers</span>
            </div>
            {counters?.isInviteOnlyCompanies ? (
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Invite-Only
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-textPrimary">
              {counters?.activeCompanies ?? 0}
              <span className="text-base font-normal text-textSecondary ml-1">
                / {counters?.maxCompanies ?? 10}
              </span>
            </div>
            <span className="text-xs font-semibold text-textSecondary">
              {Math.round(((counters?.activeCompanies ?? 0) / (counters?.maxCompanies || 10)) * 100)}% Cap
            </span>
          </div>
          <div className="w-full bg-surfaceAlt rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  Math.round(((counters?.activeCompanies ?? 0) / (counters?.maxCompanies || 10)) * 100),
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Campaign Cap Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between text-textSecondary">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Active Campaigns</span>
            </div>
            <span className="text-[11px] font-semibold text-textSecondary">
              Max {counters?.maxSlotsPerCampaign ?? 20} slots/camp
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-textPrimary">
              {counters?.activeCampaigns ?? 0}
              <span className="text-base font-normal text-textSecondary ml-1">
                / {counters?.maxActiveCampaigns ?? 5}
              </span>
            </div>
            <span className="text-xs font-semibold text-textSecondary">
              {Math.round(((counters?.activeCampaigns ?? 0) / (counters?.maxActiveCampaigns || 5)) * 100)}% Cap
            </span>
          </div>
          <div className="w-full bg-surfaceAlt rounded-full h-2 overflow-hidden">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  Math.round(((counters?.activeCampaigns ?? 0) / (counters?.maxActiveCampaigns || 5)) * 100),
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Total Escrow Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between text-textSecondary">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Escrow Held</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-400">Hard Cap Enforced</span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-textPrimary">
              ₹{(Number(counters?.totalEscrowPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs font-semibold text-textSecondary">
              of ₹{(Number(counters?.maxTotalEscrowPaise || 50000000) / 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-full bg-surfaceAlt rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  Math.round(
                    (Number(counters?.totalEscrowPaise || 0) /
                      Number(counters?.maxTotalEscrowPaise || 50000000)) *
                      100,
                  ),
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Daily Payouts Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between text-textSecondary">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Payouts Today (IST)</span>
            </div>
            <span className="text-[11px] font-semibold text-textSecondary">
              Max ₹{(Number(counters?.maxDriverDailyPayoutPaise || 500000) / 100).toLocaleString('en-IN')}/driver
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-extrabold text-textPrimary">
              ₹{(Number(counters?.todayPayoutsPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs font-semibold text-textSecondary">
              of ₹{(Number(counters?.maxDailyPayoutsPaise || 10000000) / 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-full bg-surfaceAlt rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  Math.round(
                    (Number(counters?.todayPayoutsPaise || 0) /
                      Number(counters?.maxDailyPayoutsPaise || 10000000)) *
                      100,
                  ),
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Operational Triage Summary Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between text-textSecondary">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Quality & Triage</span>
            </div>
            <span className="text-[11px] font-bold text-primary">Live Shifts</span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 rounded-xl bg-surfaceAlt/50 border border-border">
              <span className="text-xs text-textSecondary block">QC 2nd-Look</span>
              <span className="text-lg font-bold text-textPrimary">
                {data?.pendingSecondLooks ?? 0} Pending
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-surfaceAlt/50 border border-border">
              <span className="text-xs text-textSecondary block">Support Desk</span>
              <span className="text-lg font-bold text-textPrimary">
                {support?.openTickets ?? 0} Tickets / {support?.openCallbacks ?? 0} Calls
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Modules Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Anomaly Detection Alerts */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-textPrimary">Automated Anomaly Detection</h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {anomalies?.totalOpen ?? 0} Open Alerts
              </span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-textSecondary">
                Automated background scanners inspect GPS clusters, multi-driver bank sharing, sudden photo surges, and velocity spikes every 15 minutes.
              </p>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
                  <span className="text-xs text-danger font-bold block">CRITICAL</span>
                  <span className="text-xl font-extrabold text-danger">{anomalies?.critical ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-xs text-amber-400 font-bold block">HIGH</span>
                  <span className="text-xl font-extrabold text-amber-400">{anomalies?.high ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-xs text-blue-400 font-bold block">MEDIUM</span>
                  <span className="text-xl font-extrabold text-blue-400">{anomalies?.medium ?? 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-surfaceAlt border border-border">
                  <span className="text-xs text-textSecondary font-bold block">LOW</span>
                  <span className="text-xl font-extrabold text-textPrimary">{anomalies?.low ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border bg-surfaceAlt/30 flex justify-end">
            <Link
              to="/admin/anomalies"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>View Anomaly Triage Queue &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Feedback & NPS Pulse */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="font-semibold text-textPrimary">Pilot Feedback & NPS Pulse</h3>
              </div>
              <span className="text-xs font-mono text-textSecondary">
                Rating: {feedback?.avgRating ?? 0} / 5.0
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-surfaceAlt border border-border">
                <div>
                  <span className="text-xs text-textSecondary block">Net Promoter Score (NPS)</span>
                  <span className="text-2xl font-black text-textPrimary">+{feedback?.avgNps ?? 0}</span>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Target: &gt; +40
                </span>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider block">
                  Recent Partner Feedback
                </span>
                {feedback?.recent && feedback.recent.length > 0 ? (
                  feedback.recent.slice(0, 2).map((f) => (
                    <div key={f.id} className="p-3 rounded-xl bg-surfaceAlt/60 border border-border text-xs">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-textPrimary capitalize">{f.category.replace(/_/g, ' ')}</span>
                        <span className="text-amber-400">{'★'.repeat(f.rating)}</span>
                      </div>
                      <p className="text-textSecondary mt-1 italic">&ldquo;{f.comment || 'No comment provided'}&rdquo;</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-textSecondary py-2 text-center">No pilot feedback submissions recorded yet.</p>
                )}
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border bg-surfaceAlt/30 flex justify-end">
            <Link
              to="/admin/feedback"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>View All Partner Feedback &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

