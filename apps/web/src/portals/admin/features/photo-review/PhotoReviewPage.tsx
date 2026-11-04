import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Car,
  UserCheck,
  RefreshCw,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import {
  INSTALL_REJECT_REASONS,
  type InstallRejectReason,
} from '@ap/shared-constants';
import type { InstallationReviewQueueItemDto } from '@ap/shared-types';
import { useApi } from '../../../../shared/lib/api';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { Spinner } from '../../../../shared/components/Spinner';
import { Modal } from '../../../../shared/components/Modal';
import { EmptyState } from '../../../../shared/components/EmptyState';
import { DailyPhotoReviewTab } from './DailyPhotoReviewTab';
import { FraudOverviewTab } from './FraudOverviewTab';

const REASON_LABELS: Record<InstallRejectReason, string> = {
  [INSTALL_REJECT_REASONS.WRONG_AUTO_OR_PLATE]: 'Number plate does not match vehicle RC or is obscured',
  [INSTALL_REJECT_REASONS.POSTER_WRINKLED_OR_DAMAGED]: 'Poster is wrinkled, torn, crooked, or bubbling',
  [INSTALL_REJECT_REASONS.POOR_LIGHTING_OR_BLURRY]: 'Photo is blurry, dark, overexposed, or taken at night',
  [INSTALL_REJECT_REASONS.NUMBER_PLATE_OBSCURED]: 'Number plate is covered, dirty, or cut out of frame',
  [INSTALL_REJECT_REASONS.POSTER_CROPPED_OR_INCOMPLETE]: 'Auto back or poster is partially cut off or obstructed',
  [INSTALL_REJECT_REASONS.SUSPECTED_REUSE_OR_DUPLICATE]: 'Suspected photo manipulation, screen-capture, or duplicate',
  [INSTALL_REJECT_REASONS.OTHER]: 'Other installation defect (details specified in note)',
};

export function PhotoReviewPage() {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<'installations' | 'daily' | 'fraud'>('daily');
  const [queue, setQueue] = useState<InstallationReviewQueueItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item for review modal
  const [selectedItem, setSelectedItem] = useState<InstallationReviewQueueItemDto | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Rejection form state
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<InstallRejectReason[]>([]);
  const [moderatorNote, setModeratorNote] = useState('');

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAdminInstallationQueue();
      setQueue(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load installation queue');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleClaim = async (assignmentId: string) => {
    try {
      await api.claimAdminInstallation(assignmentId);
      await loadQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to claim review');
    }
  };

  const handleRelease = async (assignmentId: string) => {
    try {
      await api.releaseAdminInstallation(assignmentId);
      await loadQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to release review');
    }
  };

  const openReviewModal = (item: InstallationReviewQueueItemDto) => {
    setSelectedItem(item);
    setIsRejectMode(false);
    setSelectedReasons([]);
    setModeratorNote('');
    setSubmitError(null);
    setIsReviewModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.reviewAdminInstallation(selectedItem.assignmentId, {
        decision: 'APPROVED',
        reasons: [],
      });
      setIsReviewModalOpen(false);
      await loadQueue();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to approve installation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    if (selectedReasons.length === 0) {
      setSubmitError('Please select at least one reason for rejection.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.reviewAdminInstallation(selectedItem.assignmentId, {
        decision: 'REJECTED',
        reasons: selectedReasons.map((code) => ({ code })),
        note: moderatorNote.trim() || undefined,
      });
      setIsReviewModalOpen(false);
      await loadQueue();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to reject installation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrantExtraAttempt = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.reviewAdminInstallation(selectedItem.assignmentId, {
        decision: 'EXTRA_ATTEMPT_GRANTED',
        reasons: [],
        note: moderatorNote.trim() || 'Extra attempt granted for photo retake',
      });
      setIsReviewModalOpen(false);
      await loadQueue();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to grant extra attempt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleReason = (reason: InstallRejectReason) => {
    if (selectedReasons.includes(reason)) {
      setSelectedReasons(selectedReasons.filter((r) => r !== reason));
    } else {
      setSelectedReasons([...selectedReasons, reason]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Photo Verification & Quality Control"
          description="Review poster installation approvals, verify daily proofs, and monitor fraud signals"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            activeTab === 'daily'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Daily Proof Queue
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('installations')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            activeTab === 'installations'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Installation Approvals
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fraud')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            activeTab === 'fraud'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-textSecondary hover:text-textPrimary'
          }`}
        >
          Fraud & Signals
        </button>
      </div>

      {activeTab === 'daily' && <DailyPhotoReviewTab />}
      {activeTab === 'fraud' && <FraudOverviewTab />}

      {activeTab === 'installations' && (
        <>
          <div className="flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={loadQueue} isLoading={isLoading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Queue
            </Button>
          </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadQueue}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : queue.length === 0 ? (
        <Card>
          <EmptyState
            title="Review Queue is Empty"
            description="All poster installation submissions have been reviewed. New submissions will appear here automatically."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queue.map((item) => (
            <Card key={item.assignmentId} className="flex flex-col justify-between hover:border-primary/50 transition">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-textPrimary text-sm line-clamp-1">{item.campaignTitle}</h3>
                    <p className="text-xs text-textSecondary flex items-center gap-1 mt-0.5">
                      <Car className="w-3.5 h-3.5 text-textSecondary" />
                      <span className="font-mono font-medium text-textPrimary">{item.vehicleRegistrationNumber}</span>
                    </p>
                  </div>
                  {item.isSlaBreached && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-danger/10 text-danger border border-danger/30 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      SLA Breached
                    </span>
                  )}
                </div>

                {/* Thumbnail preview */}
                <div className="h-44 w-full bg-surface border border-border rounded-lg overflow-hidden flex items-center justify-center relative group">
                  {item.photoUrl ? (
                    <img
                      src={item.photoUrl}
                      alt="Installation preview"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <span className="text-xs text-textSecondary">No photo available</span>
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-medium">
                    Attempt {item.attemptNo} of 3
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.waitingMinutes}m ago
                  </div>
                </div>

                <div className="text-xs space-y-1 text-textSecondary pt-1">
                  <div className="flex justify-between">
                    <span>Driver:</span>
                    <span className="text-textPrimary font-medium">{item.driverName ?? 'Driver'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span className="text-textPrimary font-mono">{item.driverMobile ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Assigned Reviewer:</span>
                    <span className="text-textPrimary font-medium">
                      {item.claimedByName ?? (item.claimedById ? 'Claimed' : 'Unclaimed')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                {!item.claimedById ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleClaim(item.assignmentId)}
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                    Claim
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRelease(item.assignmentId)}
                  >
                    Release
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => openReviewModal(item)}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Review
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {isReviewModalOpen && selectedItem && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title={`Review Installation: ${selectedItem.vehicleRegistrationNumber}`}
        >
          <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
            {submitError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs">
                {submitError}
              </div>
            )}

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
                  Original Poster Design
                </span>
                <div className="h-64 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center">
                  {selectedItem.posterPreviewUrl ? (
                    <img
                      src={selectedItem.posterPreviewUrl}
                      alt="Campaign Poster"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-textSecondary">Poster preview not available</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
                  Submitted Auto Installation
                </span>
                <div className="h-64 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center">
                  {selectedItem.photoUrl ? (
                    <img
                      src={selectedItem.photoUrl}
                      alt="Submitted Auto"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-textSecondary">Installation photo not available</span>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata summary */}
            <div className="p-3 bg-surface border border-border rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-textSecondary block">Auto RC:</span>
                <span className="font-mono font-semibold text-textPrimary">
                  {selectedItem.vehicleRegistrationNumber}
                </span>
              </div>
              <div>
                <span className="text-textSecondary block">Attempt:</span>
                <span className="font-semibold text-textPrimary">#{selectedItem.attemptNo}</span>
              </div>
              <div>
                <span className="text-textSecondary block">Waiting:</span>
                <span className="font-semibold text-textPrimary">{selectedItem.waitingMinutes} minutes</span>
              </div>
              <div>
                <span className="text-textSecondary block">Review Owner:</span>
                <span className="font-semibold text-textPrimary">{selectedItem.reviewOwner}</span>
              </div>
            </div>

            {/* Rejection Reasons Section */}
            {isRejectMode && (
              <div className="p-3 bg-danger/5 border border-danger/20 rounded-lg space-y-3">
                <span className="text-xs font-semibold text-danger block">
                  Select Rejection Reasons (Driver will be notified to fix these):
                </span>
                <div className="space-y-1.5">
                  {(Object.keys(REASON_LABELS) as InstallRejectReason[]).map((code) => (
                    <label
                      key={code}
                      className="flex items-start gap-2 text-xs text-textPrimary cursor-pointer hover:bg-danger/10 p-1.5 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedReasons.includes(code)}
                        onChange={() => toggleReason(code)}
                        className="mt-0.5 rounded border-border text-danger focus:ring-danger"
                      />
                      <span>{REASON_LABELS[code]}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-textPrimary mb-1">
                    Moderator Note (Optional instructions for driver):
                  </label>
                  <textarea
                    rows={2}
                    value={moderatorNote}
                    onChange={(e) => setModeratorNote(e.target.value)}
                    placeholder="Provide specific feedback on how to fix the installation..."
                    className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-textPrimary focus:outline-none focus:ring-1 focus:ring-danger"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 border-t border-border flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReviewModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              {!isRejectMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGrantExtraAttempt}
                    isLoading={isSubmitting}
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5 text-warning" />
                    Grant Extra Attempt
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setIsRejectMode(true)}
                    disabled={isSubmitting}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Reject Installation
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApprove}
                    isLoading={isSubmitting}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    Approve Installation
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsRejectMode(false)}
                    disabled={isSubmitting}
                  >
                    Back to Approval
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleReject}
                    isLoading={isSubmitting}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Confirm Rejection
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
      </>
      )}
    </div>
  );
}
