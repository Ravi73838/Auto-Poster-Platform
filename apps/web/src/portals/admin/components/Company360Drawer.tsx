import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Shield,
  IndianRupee,
  Megaphone,
  CreditCard,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { useApiClient } from '../../../shared/lib/api';
import { StepUpModal } from '../../../shared/components/StepUpModal';

interface Company360DrawerProps {
  companyId: string | null;
  onClose: () => void;
}

export function Company360Drawer({ companyId, onClose }: Company360DrawerProps) {
  const client = useApiClient();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);
  const [revealedGstin, setRevealedGstin] = useState<string | null>(null);
  const [revealedPan, setRevealedPan] = useState<string | null>(null);

  const [isStepUpOpen, setIsStepUpOpen] = useState(false);
  const [pendingRevealField, setPendingRevealField] = useState<'MOBILE' | 'EMAIL' | 'GSTIN' | 'PAN' | null>(null);

  useEffect(() => {
    if (!companyId) {
      setData(null);
      setRevealedPhone(null);
      setRevealedEmail(null);
      setRevealedGstin(null);
      setRevealedPan(null);
      return;
    }

    setLoading(true);
    client
      .adminGetCompanyOverview(companyId)
      .then((res: any) => setData(res))
      .catch((err: unknown) => console.error('Failed to load company 360 overview:', err))
      .finally(() => setLoading(false));
  }, [client, companyId]);

  if (!companyId) return null;

  const handleReveal = async (field: 'MOBILE' | 'EMAIL' | 'GSTIN' | 'PAN') => {
    try {
      const res = await client.adminRevealPii({
        entityType: 'COMPANY',
        entityId: companyId,
        field,
      });
      if (field === 'MOBILE') setRevealedPhone(res.value);
      if (field === 'EMAIL') setRevealedEmail(res.value);
      if (field === 'GSTIN') setRevealedGstin(res.value);
      if (field === 'PAN') setRevealedPan(res.value);
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
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  {data?.profile?.companyName || 'Company 360° View'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-textSecondary mt-0.5">
                  <span>ID: {companyId.slice(0, 8)}...</span>
                  {data?.profile?.cityName && <span>• {data.profile.cityName}</span>}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      data?.profile?.isVerified
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {data?.profile?.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
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

          {/* Content */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-sm text-textSecondary">
              Failed to load company details.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Profile Card & PII */}
              <div className="p-4 rounded-xl border border-border bg-surfaceAlt/20 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Corporate Legal & Tax Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-textSecondary block">Legal Entity Name</span>
                    <span className="font-semibold text-textPrimary mt-0.5 block">
                      {data.profile.legalName || data.profile.companyName}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Brand Name</span>
                    <span className="text-textPrimary mt-0.5 block">
                      {data.profile.brandName || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">GSTIN</span>
                    <div className="flex items-center gap-2 font-mono mt-0.5 text-textPrimary">
                      <span>{revealedGstin || data.profile.gstin || 'None'}</span>
                      {data.profile.gstin && !revealedGstin && (
                        <button
                          onClick={() => handleReveal('GSTIN')}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3 h-3" /> Reveal
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-textSecondary block">PAN</span>
                    <div className="flex items-center gap-2 font-mono mt-0.5 text-textPrimary">
                      <span>{revealedPan || data.profile.pan || 'None'}</span>
                      {data.profile.pan && !revealedPan && (
                        <button
                          onClick={() => handleReveal('PAN')}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3 h-3" /> Reveal
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Contact Person</span>
                    <span className="font-medium text-textPrimary mt-0.5 block">
                      {data.profile.contactPersonName || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Contact Phone</span>
                    <div className="flex items-center gap-2 font-mono mt-0.5 text-textPrimary">
                      <span>{revealedPhone || data.profile.contactPersonPhone}</span>
                      {!revealedPhone && (
                        <button
                          onClick={() => handleReveal('MOBILE')}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3 h-3" /> Reveal
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Corporate Email</span>
                    <div className="flex items-center gap-2 font-mono mt-0.5 text-textPrimary">
                      <span>{revealedEmail || data.profile.email}</span>
                      {!revealedEmail && (
                        <button
                          onClick={() => handleReveal('EMAIL')}
                          className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3 h-3" /> Reveal
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
                  <IndianRupee className="w-3.5 h-3.5" /> Financial Summary
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-surfaceAlt/40 rounded-xl border border-border">
                    <span className="text-[11px] text-textSecondary">Total Spend</span>
                    <div className="text-sm font-bold text-textPrimary mt-0.5">
                      {formatPaise(data.financialSummary.totalSpentPaise)}
                    </div>
                  </div>
                  <div className="p-3 bg-surfaceAlt/40 rounded-xl border border-border">
                    <span className="text-[11px] text-textSecondary">Payments</span>
                    <div className="text-sm font-bold text-success mt-0.5">
                      {data.financialSummary.paymentsCount}
                    </div>
                  </div>
                  <div className="p-3 bg-surfaceAlt/40 rounded-xl border border-border">
                    <span className="text-[11px] text-textSecondary">Refunds</span>
                    <div className="text-sm font-bold text-warning mt-0.5">
                      {data.financialSummary.refundsCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Campaigns */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
                  <Megaphone className="w-3.5 h-3.5" /> Campaigns ({data.campaigns?.length || 0})
                </h3>
                {data.campaigns?.length === 0 ? (
                  <p className="text-xs text-textSecondary p-3 border border-border rounded-xl">
                    No campaigns created yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.campaigns.map((cmp: any) => (
                      <div
                        key={cmp.id}
                        className="p-3 rounded-xl border border-border bg-surface hover:bg-surfaceAlt/40 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-textPrimary">{cmp.title}</div>
                          <div className="text-[11px] text-textSecondary flex items-center gap-2 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-surfaceAlt rounded font-medium">
                              {cmp.status}
                            </span>
                            <span>•</span>
                            <span>{cmp.targetSlots} slots</span>
                            <span>•</span>
                            <span>{cmp.durationDays} days</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-textPrimary block">
                            {formatPaise(cmp.totalBudgetPaise)}
                          </span>
                          <span className="text-[10px] text-textSecondary">
                            {new Date(cmp.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Payments */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-textSecondary mb-3 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5" /> Recent Transactions ({data.payments?.length || 0})
                </h3>
                {data.payments?.length === 0 ? (
                  <p className="text-xs text-textSecondary p-3 border border-border rounded-xl">
                    No transactions recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.payments.map((p: any) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl border border-border bg-surface flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-medium text-textPrimary block">
                            {p.method || 'Online Payment'}
                          </span>
                          <span className="text-[10px] font-mono text-textSecondary">
                            Order: {p.gatewayOrderId || p.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-textPrimary block">
                            {formatPaise(p.amountPaise)}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              p.status === 'PAID' ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
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
