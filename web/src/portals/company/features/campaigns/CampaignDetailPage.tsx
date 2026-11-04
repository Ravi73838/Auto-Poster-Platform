import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Calendar,
  Truck,
  IndianRupee,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Trash2,
  Send,
  RefreshCw,
  CreditCard,
  ZoomIn,
  ShieldAlert,
} from 'lucide-react';
import { CAMPAIGN_STATUS, type CampaignStatus } from '@ap/shared-constants';
import type { CampaignDetailDto } from '@ap/shared-types';
import { useApi } from '../../../../shared/lib/api';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { Spinner } from '../../../../shared/components/Spinner';
import { Modal } from '../../../../shared/components/Modal';
import { CampaignProgressTab } from './CampaignProgressTab';

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const api = useApi();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<CampaignDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Modals
  const [activeTab, setActiveTab] = useState<'overview' | 'progress'>('overview');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const loadCampaign = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getCompanyCampaignDetail(id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setIsLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  // Actions
  const handleSubmitForReview = async () => {
    if (!id) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await api.submitCampaign(id);
      await loadCampaign();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit campaign');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!id) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await api.reopenCampaign(id);
      await loadCampaign();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reopen campaign');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleClone = async () => {
    if (!id) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      const cloned = await api.cloneCampaign(id);
      navigate(`/company/campaigns/${cloned.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to clone campaign');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await api.cancelCampaign(id, cancelReason.trim() || undefined);
      setIsCancelModalOpen(false);
      await loadCampaign();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel campaign');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!id) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await api.simulateCampaignPayment(id);
      await loadCampaign();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Payment simulation failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/company/campaigns')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaigns
        </Button>
        <Card className="p-6 text-center text-red-500">
          <p>{error || 'Campaign not found'}</p>
        </Card>
      </div>
    );
  }

  const c = detail.campaign;
  const slotUsage = detail.slotUsage;
  const paymentSummary = detail.paymentSummary;
  const reviews = detail.reviews;

  const isAwaitingPayment = c.status === CAMPAIGN_STATUS.AWAITING_PAYMENT;
  const isRejected = c.status === CAMPAIGN_STATUS.REJECTED;
  const isDraft = c.status === CAMPAIGN_STATUS.DRAFT;
  const isCancelable =
    c.status !== CAMPAIGN_STATUS.LIVE &&
    c.status !== CAMPAIGN_STATUS.RUNNING &&
    c.status !== CAMPAIGN_STATUS.COMPLETED &&
    c.status !== CAMPAIGN_STATUS.SETTLED &&
    c.status !== CAMPAIGN_STATUS.CANCELLED;

  const totalBudgetINR = (Number(BigInt(c.totalChargedPaise)) / 100).toLocaleString('en-IN');
  const rentPer30dINR = (c.rentPer30DaysPaise / 100).toLocaleString('en-IN');
  const allowanceINR = (c.printingAllowancePaise / 100).toLocaleString('en-IN');

  const slotsFilled = slotUsage.total - slotUsage.available;
  const slotPercentage = Math.round((slotsFilled / (slotUsage.total || 1)) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/company/campaigns')} className="inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Campaigns</span>
        </Button>

        <div className="flex items-center gap-2">
          {isDraft && (
            <Button variant="primary" size="sm" onClick={handleSubmitForReview} isLoading={isActionLoading}>
              <Send className="w-4 h-4 mr-1.5" /> Submit for Review
            </Button>
          )}

          {isRejected && (
            <Button variant="primary" size="sm" onClick={handleReopen} isLoading={isActionLoading}>
              <RefreshCw className="w-4 h-4 mr-1.5" /> Reopen Draft to Edit
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handleClone} isLoading={isActionLoading}>
            <Copy className="w-4 h-4 mr-1.5" /> Clone
          </Button>

          {isCancelable && (
            <Button variant="danger" size="sm" onClick={() => setIsCancelModalOpen(true)} disabled={isActionLoading}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-surface border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-textPrimary">{c.title}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surfaceAlt border border-border">
              {c.status}
            </span>
          </div>
          <p className="text-xs text-textSecondary">
            Campaign ID: {c.id} &bull; Revision #{c.revisionCount || 1} &bull; Created {new Date(c.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-textSecondary block">Total Budget</span>
          <span className="text-2xl font-bold text-primary">₹{totalBudgetINR}</span>
        </div>
      </div>

      {/* Banners for Actionable Statuses */}
      {isAwaitingPayment && (
        <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CreditCard className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                  Poster Approved — Awaiting Advance Escrow Payment
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Your artwork and campaign parameters have been approved by the platform moderators. Payment must be completed before the deadline to activate driver enrolment.
                </p>
                {paymentSummary?.paymentDeadlineAt && (
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mt-2">
                    Payment Deadline: {new Date(paymentSummary.paymentDeadlineAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Dev simulate payment button */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSimulatePayment}
              isLoading={isActionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            >
              Simulate Payment (Dev)
            </Button>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-red-800 dark:text-red-300">
                Campaign Review: Feedback Required
              </h3>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                Moderators reviewed this campaign and identified items that need correction before approval:
              </p>

              {reviews && reviews.length > 0 && reviews[0]?.reasons && (
                <div className="mt-3 p-3 rounded-lg bg-surface border border-red-500/20 text-xs space-y-2">
                  <span className="font-semibold text-textPrimary block">Reason Codes:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {reviews[0].reasons.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-mono text-[11px]">
                        {typeof r === 'string' ? r : r.code}
                      </span>
                    ))}
                  </div>
                  {reviews[0]?.note && (
                    <p className="text-textSecondary mt-2">
                      <strong>Moderator Note:</strong> {reviews[0].note}
                    </p>
                  )}
                </div>
              )}

              <Button variant="primary" size="sm" onClick={handleReopen} isLoading={isActionLoading} className="mt-4">
                <RefreshCw className="w-4 h-4 mr-1.5" /> Reopen Draft to Fix & Resubmit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            activeTab === 'overview'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Campaign Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            activeTab === 'progress'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Daily Proof & Verification
        </button>
      </div>

      {activeTab === 'progress' ? (
        <CampaignProgressTab campaignId={id!} />
      ) : (
        /* Main Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="md:col-span-2 space-y-6">
          {/* Slots & Progress Card */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-textPrimary flex items-center justify-between">
              <span>Auto-Rickshaw Slots</span>
              <span className="text-xs font-normal text-textSecondary">{slotPercentage}% Enrolled</span>
            </h3>

            {/* Progress bar */}
            <div className="w-full h-3 bg-surfaceAlt rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${slotPercentage}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-surfaceAlt">
                <span className="text-textSecondary block">Target</span>
                <span className="text-sm font-bold text-textPrimary">{slotUsage.total}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surfaceAlt">
                <span className="text-textSecondary block">Enrolled</span>
                <span className="text-sm font-bold text-emerald-600">{slotsFilled}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surfaceAlt">
                <span className="text-textSecondary block">Available</span>
                <span className="text-sm font-bold text-primary">{slotUsage.available}</span>
              </div>
            </div>
          </Card>

          {/* Details & Targeting Card */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-textPrimary">Campaign Configuration</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-textSecondary flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Target Area
                </span>
                <p className="font-medium text-textPrimary">
                  {c.cityName || 'Citywide'}
                  {c.zoneNames && c.zoneNames.length > 0
                    ? ` (${c.zoneNames.join(', ')})`
                    : ' (All Zones)'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-textSecondary flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Schedule
                </span>
                <p className="font-medium text-textPrimary">
                  {c.startDate} to {c.endDate} ({c.durationDays} days)
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-textSecondary flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5" /> Monthly Rate per Auto
                </span>
                <p className="font-medium text-textPrimary">₹{rentPer30dINR} / 30 days</p>
              </div>

              <div className="space-y-1">
                <span className="text-textSecondary flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5" /> Printing Allowance
                </span>
                <p className="font-medium text-textPrimary">₹{allowanceINR} per auto</p>
              </div>
            </div>

            {c.description && (
              <div className="pt-3 border-t border-border text-xs">
                <span className="text-textSecondary block mb-1">Notes:</span>
                <p className="text-textPrimary">{c.description}</p>
              </div>
            )}
          </Card>

          {/* Pricing Snapshot Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-textPrimary">Detailed Financial Breakdown</h3>
            <div className="space-y-2 text-xs text-textSecondary">
              <div className="flex justify-between">
                <span>Driver Rent Subtotal</span>
                <span className="text-textPrimary font-medium">
                  ₹{(Number(BigInt(c.totalBudgetPaise)) / 100).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Platform Commission</span>
                <span className="text-textPrimary font-medium">
                  ₹{(Number(BigInt(c.platformFeePaise)) / 100).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>GST (18%)</span>
                <span className="text-textPrimary font-medium">
                  ₹{(Number(BigInt(c.gstAmountPaise)) / 100).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="pt-2 border-t border-border flex justify-between text-sm font-bold text-textPrimary">
                <span>Total Escrow Amount</span>
                <span className="text-primary">₹{totalBudgetINR}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Poster Preview */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-textPrimary">Poster Artwork</h3>

            {c.posterPreviewUrl ? (
              <div className="space-y-3">
                <div
                  className="relative rounded-lg overflow-hidden border border-border cursor-pointer group"
                  onClick={() => setIsImageModalOpen(true)}
                >
                  <img
                    src={c.posterPreviewUrl}
                    alt="Poster Artwork"
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <ZoomIn className="w-6 h-6" />
                  </div>
                </div>

                <div className="text-xs text-textSecondary space-y-1">
                  <p><strong className="text-textPrimary">Material:</strong> {c.printMaterial}</p>
                  <p><strong className="text-textPrimary">Dimensions:</strong> {c.printSize || 'Standard'}</p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-textSecondary text-xs">
                <p>No poster file attached yet</p>
              </div>
            )}
          </Card>
        </div>
      </div>
      )}

      {/* Image Zoom Modal */}
      {isImageModalOpen && c.posterPreviewUrl && (
        <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Poster Artwork Preview">
          <div className="flex flex-col items-center gap-4">
            <img
              src={c.posterPreviewUrl}
              alt="Poster Full Preview"
              className="max-h-[70vh] rounded-lg object-contain shadow-lg"
            />
            <Button variant="outline" size="sm" onClick={() => setIsImageModalOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>
      )}

      {/* Cancel Confirmation Modal */}
      {isCancelModalOpen && (
        <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Campaign">
          <div className="space-y-4">
            <p className="text-xs text-textSecondary">
              Are you sure you want to cancel this campaign? This action cannot be undone.
            </p>
            <div>
              <label className="block text-xs font-medium text-textPrimary mb-1">Cancellation Reason (Optional)</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling this campaign?"
                className="w-full px-3 py-2 text-xs bg-surface border border-border rounded-lg text-textPrimary focus:ring-2 focus:ring-danger focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsCancelModalOpen(false)} disabled={isActionLoading}>
                Keep Campaign
              </Button>
              <Button variant="danger" size="sm" onClick={handleCancel} isLoading={isActionLoading}>
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
