import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Truck,
  IndianRupee,
  AlertTriangle,
  FileText,
  Eye,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useApiClient } from '../../../shared/lib/api';
import { StepUpModal } from '../../../shared/components/StepUpModal';

interface Driver360DrawerProps {
  driverId: string | null;
  onClose: () => void;
}

export function Driver360Drawer({ driverId, onClose }: Driver360DrawerProps) {
  const client = useApiClient();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealedMobile, setRevealedMobile] = useState<string | null>(null);
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);
  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [pendingRevealField, setPendingRevealField] = useState<'MOBILE' | 'EMAIL' | null>(null);

  useEffect(() => {
    if (!driverId) {
      setData(null);
      setRevealedMobile(null);
      setRevealedEmail(null);
      return;
    }

    setLoading(true);
    client
      .adminGetDriverOverview(driverId)
      .then((res: any) => setData(res))
      .catch((err: unknown) => console.error('Failed to load driver 360 overview:', err))
      .finally(() => setLoading(false));
  }, [client, driverId]);

  if (!driverId) return null;

  const handleReveal = async (field: 'MOBILE' | 'EMAIL') => {
    try {
      const res = await client.adminRevealPii({
        entityType: 'DRIVER',
        entityId: driverId,
        field,
      });
      if (field === 'MOBILE') setRevealedMobile(res.value);
      if (field === 'EMAIL') setRevealedEmail(res.value);
    } catch (err: any) {
      if (err?.code === 'STEP_UP_REQUIRED' || err?.message?.includes('Step-up')) {
        setPendingRevealField(field);
        setIsStepUpOpen(true);
      } else {
        alert(err?.message || 'Failed to reveal PII');
      }
    }
  };

  const handleStepUpSuccess = async () => {
    if (pendingRevealField) {
      const field = pendingRevealField;
      setPendingRevealField(null);
      await handleReveal(field);
    }
  };

  const formatPaise = (paiseStr: string) => {
    const val = Number(paiseStr || '0') / 100;
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
        <div className="bg-surface border-l border-border w-full max-w-2xl h-full shadow-2xl flex flex-col text-textPrimary animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-surfaceAlt/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  {data?.profile?.fullName || 'Driver 360° View'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-textSecondary mt-0.5">
                  <span>ID: {driverId.slice(0, 8)}...</span>
                  {data?.profile?.cityName && <span>• {data.profile.cityName}</span>}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      data?.profile?.kycStatus === 'APPROVED'
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    KYC: {data?.profile?.kycStatus || 'PENDING'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-sm text-textSecondary">
              Failed to load driver details.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Profile Card & PII */}
              <div className="p-4 rounded-xl border border-border bg-surfaceAlt/20 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Driver Identity & Contact
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-textSecondary block">Mobile</span>
                    <div className="flex items-center gap-2 font-mono mt-0.5 text-textPrimary">
                      <span>{revealedMobile || data.profile.mobile}</span>
                      {!revealedMobile && (
                        <button
                          onClick={() => handleReveal('MOBILE')}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                          title="Verify identity to reveal full phone"
                        >
                          <Eye className="w-3 h-3" /> Reveal
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Email</span>
                    <div className="flex items-center gap-2 font-mono mt-0.5 text-textPrimary">
                      <span>{revealedEmail || data.profile.email || 'None'}</span>
                      {data.profile.email && !revealedEmail && (
                        <button
                          onClick={() => handleReveal('EMAIL')}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                          title="Verify identity to reveal full email"
                        >
                          <Eye className="w-3 h-3" /> Reveal
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Vehicle Number</span>
                    <span className="font-semibold text-textPrimary mt-0.5 block">
                      {data.profile.vehicleNumber || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Vehicle Make / Model</span>
                    <span className="text-textPrimary mt-0.5 block">
                      {data.profile.vehicleMakeModel || 'Auto Rickshaw'}
                    </span>
                  </div>
                  {data.profile.bannedUntil && (
                    <div className="col-span-2 p-2 bg-danger/10 border border-danger/20 rounded-lg text-danger font-medium">
                      Banned until {new Date(data.profile.bannedUntil).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Snapshot */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
                  <IndianRupee className="w-3.5 h-3.5" /> Financial Balances
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-surfaceAlt/40 rounded-xl border border-border">
                    <span className="text-[11px] text-textSecondary">Total Earned</span>
                    <div className="text-sm font-bold text-textPrimary mt-0.5">
                      {formatPaise(data.financialSummary.totalEarnedPaise)}
                    </div>
                  </div>
                  <div className="p-3 bg-surfaceAlt/40 rounded-xl border border-border">
                    <span className="text-[11px] text-textSecondary">Available Balance</span>
                    <div className="text-sm font-bold text-success mt-0.5">
                      {formatPaise(data.financialSummary.availableBalancePaise)}
                    </div>
                  </div>
                  <div className="p-3 bg-surfaceAlt/40 rounded-xl border border-border">
                    <span className="text-[11px] text-textSecondary">Pending Payouts</span>
                    <div className="text-sm font-bold text-textPrimary mt-0.5">
                      {data.financialSummary.pendingPayoutsCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignments History */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5" /> Campaign Assignments ({data.assignments?.length || 0})
                </h3>
                {data.assignments?.length === 0 ? (
                  <p className="text-xs text-textSecondary p-3 border border-border rounded-xl">
                    No campaign participation history.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.assignments.map((asgn: any) => (
                      <div
                        key={asgn.id}
                        className="p-3 rounded-xl border border-border bg-surface hover:bg-surfaceAlt/40 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-textPrimary">
                            {asgn.campaignTitle}
                          </div>
                          <div className="text-[11px] text-textSecondary flex items-center gap-2 mt-0.5">
                            <span>Status: {asgn.status}</span>
                            <span>•</span>
                            <span className="text-success font-medium">
                              {asgn.verifiedDays} verified
                            </span>
                            <span>•</span>
                            <span className="text-danger font-medium">
                              {asgn.missedDays} missed
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-textPrimary block">
                            {formatPaise(asgn.rentPaidPaise)}
                          </span>
                          <span className="text-[10px] text-textSecondary">
                            {new Date(asgn.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Strikes & Discipline */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Strikes & Violations ({data.strikes?.length || 0})
                </h3>
                {data.strikes?.length === 0 ? (
                  <p className="text-xs text-textSecondary p-3 border border-border rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    Clean track record. No active strikes.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.strikes.map((s: any) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl border border-border bg-danger/5 flex items-start justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-danger block">{s.reason}</span>
                          {s.notes && (
                            <span className="text-textSecondary text-[11px] mt-0.5 block">
                              {s.notes}
                            </span>
                          )}
                          <span className="text-[10px] text-textSecondary mt-1 block">
                            Issued: {new Date(s.issuedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.isActive ? 'bg-danger/10 text-danger' : 'bg-surfaceAlt text-textSecondary'
                          }`}
                        >
                          {s.isActive ? 'ACTIVE' : 'EXPIRED'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <StepUpModal
        isOpen={isStepUpOpen}
        onClose={() => {
          setIsStepUpOpen(false);
          setPendingRevealField(null);
        }}
        onSuccess={handleStepUpSuccess}
        title="Identity Verification Required"
        description="To reveal masked personally identifiable information (PII), complete step-up authentication."
      />
    </>
  );
}
