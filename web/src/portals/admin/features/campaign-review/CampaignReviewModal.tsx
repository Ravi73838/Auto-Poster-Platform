import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ZoomIn,
  Clock,
  ShieldCheck,
  Building,
  Calendar,
  Truck,
  IndianRupee,
  ExternalLink,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  CAMPAIGN_REVIEW_REASONS,
  CAMPAIGN_REVIEW_DECISIONS,
  CAMPAIGN_STATUS,
  type CampaignReviewReason,
} from '@ap/shared-constants';
import type { CampaignDetailDto } from '@ap/shared-types';
import { useApi } from '../../../../shared/lib/api';
import { Button } from '../../../../shared/components/Button';
import { Spinner } from '../../../../shared/components/Spinner';

interface CampaignReviewModalProps {
  campaignId: string | null;
  onClose: () => void;
  onDecisionComplete: () => void;
}

const POLICY_ITEMS = [
  'No adult, obscene, or hateful content',
  'No banned products (tobacco, alcohol, illegal drugs, firearms)',
  'No false, deceptive, or misleading advertising claims',
  'Does not obstruct number plate or compromise driver/passenger safety',
  'No election campaign or unauthorized political messaging',
];

const REASON_OPTIONS: { code: CampaignReviewReason; label: string }[] = [
  { code: CAMPAIGN_REVIEW_REASONS.POSTER_CONTENT_POLICY, label: 'Artwork violates content policy (prohibited/adult/hateful)' },
  { code: CAMPAIGN_REVIEW_REASONS.POSTER_LOW_QUALITY, label: 'Poster artwork is blurry, low resolution, or distorted' },
  { code: CAMPAIGN_REVIEW_REASONS.POSTER_MISLEADING, label: 'Artwork contains false, fraudulent, or deceptive claims' },
  { code: CAMPAIGN_REVIEW_REASONS.PRICE_TOO_LOW, label: 'Offered rent rate is inadequate for market parameters' },
  { code: CAMPAIGN_REVIEW_REASONS.DETAILS_UNCLEAR, label: 'Campaign instructions or target parameters are ambiguous' },
  { code: CAMPAIGN_REVIEW_REASONS.UNSUPPORTED_AREA, label: 'Selected geographic zones have no active driver fleet' },
  { code: CAMPAIGN_REVIEW_REASONS.START_DATE_TOO_SOON, label: 'Start date is too soon to allow printing and payment deadline' },
  { code: CAMPAIGN_REVIEW_REASONS.OTHER, label: 'Other violation or concern (details in note)' },
];

export function CampaignReviewModal({
  campaignId,
  onClose,
  onDecisionComplete,
}: CampaignReviewModalProps) {
  const { t } = useTranslation();
  const api = useApi();

  const [campaign, setCampaign] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Decision State
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<CampaignReviewReason[]>([]);
  const [reviewerNote, setReviewerNote] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    setIsLoading(true);
    setError(null);
    async function loadDetail() {
      try {
        const data = await api.getAdminCampaignDetail(campaignId!);
        setCampaign(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign');
      } finally {
        setIsLoading(false);
      }
    }
    loadDetail();
  }, [api, campaignId]);

  if (!campaignId) return null;

  const handleClaim = async () => {
    setIsActionLoading(true);
    try {
      await api.claimCampaign(campaignId);
      const data = await api.getAdminCampaignDetail(campaignId);
      setCampaign(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRelease = async () => {
    setIsActionLoading(true);
    try {
      await api.releaseCampaign(campaignId);
      onDecisionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setError(null);
    setIsActionLoading(true);
    try {
      await api.decideCampaign(campaignId, {
        decision: CAMPAIGN_REVIEW_DECISIONS.APPROVED,
        reasons: [],
        note: reviewerNote.trim() || undefined,
      });
      onDecisionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (selectedReasons.length === 0) {
      setError('Please select at least one rejection reason');
      return;
    }
    setError(null);
    setIsActionLoading(true);
    try {
      await api.decideCampaign(campaignId, {
        decision: CAMPAIGN_REVIEW_DECISIONS.REJECTED,
        reasons: selectedReasons.map((code) => ({ code })),
        note: reviewerNote.trim() || undefined,
      });
      onDecisionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setIsActionLoading(false);
    }
  };

  const allChecklistConfirmed = POLICY_ITEMS.every((_, i) => checklist[i]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden text-textPrimary my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surfaceAlt/50">
          <div>
            <h2 className="text-base font-bold text-textPrimary flex items-center gap-2">
              <span>Campaign Artwork & Policy Review</span>
              {campaign && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-normal">
                  Rev #{campaign.revisionCount || 1}
                </span>
              )}
            </h2>
            {campaign && (
              <p className="text-xs text-textSecondary mt-0.5">
                {campaign.title} &bull; Company: {campaign.company?.companyName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-textSecondary hover:bg-surfaceAlt transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Spinner />
          </div>
        ) : error && !campaign ? (
          <div className="p-8 text-center text-red-500">
            <p>{error}</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Warnings */}
            {campaign.warnings && campaign.warnings.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Policy Warnings:
                </span>
                <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-400 space-y-1 pl-1">
                  {campaign.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Review Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Poster Column (7 Cols) */}
              <div className="lg:col-span-7 space-y-3">
                <span className="text-xs font-semibold text-textSecondary block uppercase tracking-wider">
                  Poster Artwork Inspection
                </span>

                {campaign.posterUrls?.preview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border bg-black/5 dark:bg-black/30 group">
                    <img
                      src={isZoomed ? campaign.posterUrls.original : campaign.posterUrls.preview}
                      alt="Campaign Poster"
                      className={`w-full object-contain transition-all duration-300 ${
                        isZoomed ? 'max-h-[70vh] cursor-zoom-out' : 'max-h-96 cursor-zoom-in'
                      }`}
                      onClick={() => setIsZoomed(!isZoomed)}
                    />
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsZoomed(!isZoomed)}
                        className="bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm text-xs py-1 px-2.5 h-auto"
                      >
                        <ZoomIn className="w-3.5 h-3.5 mr-1" />
                        {isZoomed ? 'Fit Screen' : '100% Zoom'}
                      </Button>
                      {campaign.posterUrls.original && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(campaign.posterUrls.original, '_blank')}
                          className="bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm text-xs py-1 px-2.5 h-auto"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Original Print File
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-textSecondary text-xs border border-dashed border-border rounded-xl">
                    No poster artwork attached
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-textSecondary p-3 rounded-lg bg-surfaceAlt border border-border">
                  <span>Material: <strong>{campaign.printMaterial}</strong></span>
                  <span>Dimensions: <strong>{campaign.printSize}</strong></span>
                  <span>Slots: <strong>{campaign.targetAutoCount} Autos</strong></span>
                </div>
              </div>

              {/* Company & Checklist Column (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Company KYC Box */}
                <div className="p-4 rounded-xl bg-surfaceAlt/60 border border-border space-y-2 text-xs">
                  <span className="font-semibold text-textPrimary text-sm flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-primary" /> Advertiser Profile
                  </span>
                  <p><strong className="text-textPrimary">{campaign.company?.companyName}</strong></p>
                  <p className="text-textSecondary">GSTIN: {campaign.company?.gstin || 'Unregistered'}</p>
                  <p className="text-textSecondary flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>KYC Verified: {campaign.company?.kycApprovedAt ? new Date(campaign.company.kycApprovedAt).toLocaleDateString() : 'Yes'}</span>
                  </p>
                </div>

                {/* Campaign Schedule & Area */}
                <div className="p-4 rounded-xl bg-surfaceAlt/60 border border-border space-y-2 text-xs">
                  <span className="font-semibold text-textPrimary text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" /> Schedule & Area
                  </span>
                  <p className="text-textSecondary">
                    City: <strong className="text-textPrimary">{campaign.cityName || 'Citywide'}</strong>
                  </p>
                  <p className="text-textSecondary">
                    Dates: <strong className="text-textPrimary">{campaign.startDate} to {campaign.endDate} ({campaign.durationDays}d)</strong>
                  </p>
                  <p className="text-textSecondary">
                    Rent: <strong className="text-textPrimary">₹{(campaign.rentPer30DaysPaise / 100).toLocaleString('en-IN')} / 30d</strong>
                  </p>
                </div>

                {/* Policy Checklist */}
                <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                  <span className="text-xs font-semibold text-textPrimary flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Moderator Policy Checklist
                  </span>
                  <p className="text-[11px] text-textSecondary">Confirm compliance before approving poster artwork:</p>

                  <div className="space-y-2">
                    {POLICY_ITEMS.map((item, idx) => (
                      <label key={idx} className="flex items-start gap-2 text-xs text-textSecondary cursor-pointer hover:text-textPrimary">
                        <input
                          type="checkbox"
                          checked={!!checklist[idx]}
                          onChange={(e) => setChecklist({ ...checklist, [idx]: e.target.checked })}
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="leading-tight">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Rejection Reasons Sub-dialog */}
            {isRejectDialogOpen && (
              <div className="p-5 rounded-xl border border-red-500/30 bg-red-500/5 space-y-4 animate-fade-in">
                <span className="text-sm font-bold text-red-600 dark:text-red-400 block">
                  Select Rejection Reasons & Feedback for Advertiser
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {REASON_OPTIONS.map((opt) => {
                    const isChecked = selectedReasons.includes(opt.code);
                    return (
                      <label key={opt.code} className="flex items-start gap-2 text-xs text-textPrimary cursor-pointer p-2 rounded-lg bg-surface border border-border hover:border-red-500/40">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReasons([...selectedReasons, opt.code]);
                            } else {
                              setSelectedReasons(selectedReasons.filter((r) => r !== opt.code));
                            }
                          }}
                          className="mt-0.5 rounded border-border text-red-600 focus:ring-red-500"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-medium text-textPrimary mb-1">
                    Custom Feedback Note (Required for OTHER)
                  </label>
                  <textarea
                    rows={2}
                    value={reviewerNote}
                    onChange={(e) => setReviewerNote(e.target.value)}
                    placeholder="Provide specific details on what the company needs to adjust in their artwork or schedule..."
                    className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setIsRejectDialogOpen(false)} disabled={isActionLoading}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleReject}
                    isLoading={isActionLoading}
                    disabled={selectedReasons.length === 0}
                  >
                    Confirm Rejection
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surfaceAlt/50">
          <div className="flex items-center gap-2">
            {campaign?.assignedToName ? (
              <span className="text-xs text-textSecondary flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" /> Claimed by {campaign.assignedToName}
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={handleClaim} isLoading={isActionLoading}>
                <Lock className="w-3.5 h-3.5 mr-1" /> Claim to Review
              </Button>
            )}

            {campaign?.assignedToName && (
              <Button variant="ghost" size="sm" onClick={handleRelease} disabled={isActionLoading} className="text-xs">
                <Unlock className="w-3.5 h-3.5 mr-1" /> Release Claim
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isRejectDialogOpen && (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsRejectDialogOpen(true)}
                  disabled={isActionLoading}
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> Reject Poster
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApprove}
                  disabled={!allChecklistConfirmed || isActionLoading}
                  isLoading={isActionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve & Issue Payment Order
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
