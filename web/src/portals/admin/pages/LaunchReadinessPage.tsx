import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../shared/lib/api';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  FileCheck2,
  Lock,
  Server,
  Zap,
} from 'lucide-react';
import type { LaunchReadiness, PilotSignOff } from '@ap/shared-types';
import { StepUpModal } from '../../../shared/components/StepUpModal';

export function LaunchReadinessPage() {
  const { t } = useTranslation(['common', 'status']);
  const client = useApiClient();

  const [readiness, setReadiness] = useState<LaunchReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step-up authentication modal state
  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'ATTEST' | 'REVOKE';
    key: string;
    notes?: string;
  } | null>(null);

  const fetchReadiness = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.adminGetLaunchReadiness();
      setReadiness(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load launch readiness status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
  }, [client]);

  const handleAttestClick = (key: string) => {
    const notes = window.prompt('Enter any sign-off notes or verification references (optional):');
    if (notes === null) return; // user cancelled
    setPendingAction({ type: 'ATTEST', key, notes: notes.trim() });
    setIsStepUpOpen(true);
  };

  const handleRevokeClick = (key: string) => {
    if (!window.confirm(`Are you sure you want to revoke sign-off "${key}"?`)) {
      return;
    }
    setPendingAction({ type: 'REVOKE', key });
    setIsStepUpOpen(true);
  };

  const handleStepUpSuccess = async () => {
    if (!pendingAction) return;
    setIsSubmitting(true);
    try {
      if (pendingAction.type === 'ATTEST') {
        await client.adminAttestLaunchSignOff({
          key: pendingAction.key,
          notes: pendingAction.notes,
        });
      } else {
        await client.adminRevokeLaunchSignOff(pendingAction.key);
      }
      await fetchReadiness();
      setPendingAction(null);
    } catch (err: any) {
      alert(err?.message || 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-textPrimary">Pilot Launch Readiness</h1>
            {readiness ? (
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  readiness.environment === 'production'
                    ? 'bg-danger/20 text-danger border border-danger/30'
                    : 'bg-primary/20 text-primary border border-primary/30'
                }`}
              >
                {readiness.environment}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-textSecondary mt-1">
            Pre-flight verification, infrastructure health checks, and Phase 15 launch sign-off gates.
          </p>
        </div>

        <button
          onClick={fetchReadiness}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surfaceAlt text-sm font-medium transition-colors self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Checks</span>
        </button>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {/* Overall Status Banner */}
      {readiness ? (
        <div
          className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            readiness.overallStatus === 'READY'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
              : readiness.overallStatus === 'WARNING'
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              : 'bg-danger/10 border-danger/20 text-danger'
          }`}
        >
          <div className="flex items-center gap-4">
            {readiness.overallStatus === 'READY' ? (
              <CheckCircle2 className="w-10 h-10 shrink-0" />
            ) : readiness.overallStatus === 'WARNING' ? (
              <AlertTriangle className="w-10 h-10 shrink-0" />
            ) : (
              <XCircle className="w-10 h-10 shrink-0" />
            )}
            <div>
              <h2 className="text-lg font-bold">
                Launch Status:{' '}
                {readiness.overallStatus === 'READY'
                  ? 'All Checks Cleared'
                  : readiness.overallStatus === 'WARNING'
                  ? 'Ready with Warnings'
                  : 'Launch Blocked'}
              </h2>
              <p className="text-xs opacity-90 mt-0.5">
                Last verified at {new Date(readiness.checkedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="text-sm font-semibold sm:text-right">
            <div>
              Sign-Offs Complete:{' '}
              {readiness.allSignOffsComplete ? (
                <span className="font-bold text-emerald-400">6 / 6 (100%)</span>
              ) : (
                <span className="font-bold text-amber-400">
                  {readiness.signOffs.filter((s) => s.attested).length} / {readiness.signOffs.length}
                </span>
              )}
            </div>
            <div className="text-xs opacity-80 mt-1">
              {readiness.environment === 'production' && !readiness.allSignOffsComplete
                ? 'Mandatory sign-offs required prior to live payouts & payments'
                : 'Server-enforced safety gates active'}
            </div>
          </div>
        </div>
      ) : null}

      {/* Infrastructure Health Checks */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-textPrimary">Infrastructure & Provider Diagnostics</h3>
          </div>
        </div>

        <div className="divide-y divide-border">
          {readiness?.checks.map((c) => (
            <div key={c.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-textPrimary">{c.name}</p>
                <p className="text-xs text-textSecondary mt-0.5 truncate">{c.message}</p>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                  c.status === 'PASS'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : c.status === 'WARN'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-danger/10 text-danger border border-danger/20'
                }`}
              >
                {c.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pilot Launch Sign-offs Gate */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-textPrimary">Phase 15 Pilot Sign-Offs Gate</h3>
          </div>
          <span className="text-xs text-textSecondary font-mono">
            {readiness?.signOffs.filter((s) => s.attested).length} of 6 Signed
          </span>
        </div>

        <div className="divide-y divide-border">
          {readiness?.signOffs.map((signOff) => (
            <div key={signOff.key} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-textPrimary">{signOff.label}</h4>
                  {signOff.attested ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Attested
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" /> Pending Sign-off
                    </span>
                  )}
                </div>
                <p className="text-xs text-textSecondary">{signOff.description}</p>
                {signOff.attested ? (
                  <p className="text-[11px] text-textSecondary font-mono pt-1">
                    Signed by {signOff.attestedByEmail || signOff.attestedBy} on{' '}
                    {new Date(signOff.attestedAt!).toLocaleString()}
                    {signOff.notes ? ` • "${signOff.notes}"` : ''}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {signOff.attested ? (
                  <button
                    onClick={() => handleRevokeClick(signOff.key)}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg border border-danger/30 hover:bg-danger/10 text-danger text-xs font-medium transition-colors"
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    onClick={() => handleAttestClick(signOff.key)}
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primaryText text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Attest & Sign Off</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <StepUpModal
        isOpen={isStepUpOpen}
        onClose={() => setIsStepUpOpen(false)}
        onSuccess={handleStepUpSuccess}
        title={pendingAction?.type === 'ATTEST' ? 'Sign-Off Attestation' : 'Sign-Off Revocation'}
      />
    </div>
  );
}
