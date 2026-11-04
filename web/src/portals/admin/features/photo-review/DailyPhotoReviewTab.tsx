import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  HelpCircle,
  Lock,
  RefreshCw,
  Unlock,
  XCircle,
} from 'lucide-react';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { Spinner } from '../../../../shared/components/Spinner';
import { Modal } from '../../../../shared/components/Modal';
import { EmptyState } from '../../../../shared/components/EmptyState';
import { useApi } from '../../../../shared/lib/api';
import {
  DAILY_REJECT_REASONS,
  type DailyRejectReason,
} from '@ap/shared-constants';
import type {
  DailyPhotoQueueItemDto,
  DailyPhotoDetailDto,
} from '@ap/shared-types';

const REASON_OPTIONS: { code: DailyRejectReason; label: string }[] = [
  { code: DAILY_REJECT_REASONS.PHOTO_UNCLEAR, label: 'Photo is blurry, dark, or obscured' },
  { code: DAILY_REJECT_REASONS.POSTER_NOT_VISIBLE, label: 'Poster is not visible or covered' },
  { code: DAILY_REJECT_REASONS.POSTER_REMOVED_OR_DAMAGED, label: 'Poster is peeling, damaged, or removed' },
  { code: DAILY_REJECT_REASONS.WRONG_AUTO, label: 'Wrong auto or number plate does not match vehicle' },
  { code: DAILY_REJECT_REASONS.WRONG_POSTER, label: 'Wrong poster artwork displayed' },
  { code: DAILY_REJECT_REASONS.PLATE_NOT_VISIBLE, label: 'Vehicle number plate is cut off or missing' },
  { code: DAILY_REJECT_REASONS.LOCATION_MISMATCH, label: 'Location is completely outside campaign territory' },
  { code: DAILY_REJECT_REASONS.OLD_OR_REUSED_PHOTO, label: 'Photo appears to be old, reused, or recycled' },
  { code: DAILY_REJECT_REASONS.SCREEN_OR_EDITED_PHOTO, label: 'Photo of a screen, printed photo, or digitally edited' },
];

export function DailyPhotoReviewTab() {
  const api = useApi();
  const [queue, setQueue] = useState<DailyPhotoQueueItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Review Item & Modal
  const [selectedItem, setSelectedItem] = useState<DailyPhotoQueueItemDto | null>(null);
  const [photoDetail, setPhotoDetail] = useState<DailyPhotoDetailDto | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Rejection Form
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<DailyRejectReason[]>([]);
  const [moderatorNote, setModeratorNote] = useState('');

  // Excuse Day Modal
  const [isExcuseModalOpen, setIsExcuseModalOpen] = useState(false);
  const [excuseReason, setExcuseReason] = useState('');
  const [isExcusing, setIsExcusing] = useState(false);
  const [excuseError, setExcuseError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getDailyPhotoQueue();
      setQueue(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load daily photo queue');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Hotkeys: 'A' to approve, 'R' to reject
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isReviewModalOpen || isSubmitting) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setIsRejectMode(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReviewModalOpen, isSubmitting, selectedItem]);

  const handleClaim = async (photoId: string) => {
    try {
      await api.claimDailyPhoto(photoId);
      await loadQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to claim review');
    }
  };

  const handleRelease = async (photoId: string) => {
    try {
      await api.releaseDailyPhoto(photoId);
      await loadQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to release review');
    }
  };

  const openReviewModal = async (item: DailyPhotoQueueItemDto) => {
    setSelectedItem(item);
    setIsRejectMode(false);
    setSelectedReasons([]);
    setModeratorNote('');
    setSubmitError(null);
    setIsReviewModalOpen(true);
    setIsDetailLoading(true);

    try {
      const detail = await api.getDailyPhotoDetail(item.photoId);
      setPhotoDetail(detail);
    } catch {
      // Fallback if detail fetch fails
      setPhotoDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.reviewDailyPhoto(selectedItem.photoId, {
        decision: 'APPROVE',
        reasons: [],
        note: moderatorNote.trim() || undefined,
      });
      setIsReviewModalOpen(false);
      await loadQueue();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to approve daily photo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    if (selectedReasons.length === 0) {
      setSubmitError('Please select at least one rejection reason.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.reviewDailyPhoto(selectedItem.photoId, {
        decision: 'REJECT',
        reasons: selectedReasons.map((code) => ({ code })),
        note: moderatorNote.trim() || undefined,
      });
      setIsReviewModalOpen(false);
      await loadQueue();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to reject daily photo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExcuseDay = async () => {
    if (!selectedItem) return;
    if (!excuseReason.trim()) {
      setExcuseError('A valid operational or breakdown reason is required to excuse a day.');
      return;
    }
    setIsExcusing(true);
    setExcuseError(null);
    try {
      await api.excuseAssignmentDay(
        selectedItem.assignmentId,
        selectedItem.date,
        { reason: excuseReason.trim() },
      );
      setIsExcuseModalOpen(false);
      setIsReviewModalOpen(false);
      await loadQueue();
    } catch (err) {
      setExcuseError(err instanceof Error ? err.message : 'Failed to excuse day');
    } finally {
      setIsExcusing(false);
    }
  };

  const toggleReason = (code: DailyRejectReason) => {
    if (selectedReasons.includes(code)) {
      setSelectedReasons(selectedReasons.filter((r) => r !== code));
    } else {
      setSelectedReasons([...selectedReasons, code]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-textPrimary">Daily Proof Photo Review Queue</h2>
          <p className="text-xs text-textSecondary">
            Review auto-flagged photos, high-risk submissions, and audit samples. Hotkeys: [A] Approve, [R] Reject.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadQueue} isLoading={isLoading}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs flex justify-between items-center">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadQueue}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : queue.length === 0 ? (
        <Card>
          <EmptyState
            title="Daily Queue Clean"
            description="All daily proof photos have been verified or resolved. New manual reviews will appear here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queue.map((item) => (
            <Card key={item.photoId} className="flex flex-col justify-between hover:border-primary/50 transition">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-textPrimary text-sm line-clamp-1">
                      {item.campaignTitle}
                    </h4>
                    <p className="text-xs text-textSecondary font-mono font-medium">
                      {item.vehicleRegistrationNumber}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.riskScore > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                        Risk: {item.riskScore}
                      </span>
                    )}
                    {item.isSlaBreached && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/10 text-danger border border-danger/30 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> SLA
                      </span>
                    )}
                  </div>
                </div>

                {/* Photo Thumbnail */}
                <div className="h-44 w-full bg-surface border border-border rounded-lg overflow-hidden relative group">
                  <img
                    src={item.photoUrl}
                    alt="Daily Proof"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-medium">
                    {item.date} &bull; {item.cityName}
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.waitingMinutes}m waiting
                  </div>
                </div>

                {/* Auto Check Flags */}
                {item.autoCheckFlags && Object.keys(item.autoCheckFlags).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(item.autoCheckFlags).map((flag) => (
                      <span
                        key={flag}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-600 font-mono"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-xs space-y-1 text-textSecondary">
                  <div className="flex justify-between">
                    <span>Driver:</span>
                    <span className="text-textPrimary font-medium">{item.driverName ?? 'Driver'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span className="text-textPrimary font-mono">{item.driverMobile ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Source:</span>
                    <span className="text-textPrimary">{item.reviewSource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Review Lock:</span>
                    <span className="text-textPrimary font-medium">
                      {item.claimedByName ?? (item.claimedById ? 'Locked' : 'Available')}
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
                    onClick={() => handleClaim(item.photoId)}
                  >
                    <Lock className="w-3.5 h-3.5 mr-1" /> Claim
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRelease(item.photoId)}
                  >
                    <Unlock className="w-3.5 h-3.5 mr-1" /> Release
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => openReviewModal(item)}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Review
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Modal: 3-Panel Comparison + Metadata Drawer */}
      {isReviewModalOpen && selectedItem && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title={`Daily Proof Review: ${selectedItem.vehicleRegistrationNumber} (${selectedItem.date})`}
        >
          <div className="space-y-4 max-h-[85vh] overflow-y-auto px-1">
            {submitError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs">
                {submitError}
              </div>
            )}

            {/* 3-Panel Image Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Panel 1: Current Daily Photo */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-primary uppercase">1. Today's Photo</span>
                  <span className="text-textSecondary text-[10px]">{selectedItem.date}</span>
                </div>
                <div className="h-64 rounded-lg bg-surface border-2 border-primary/40 overflow-hidden flex items-center justify-center relative">
                  <img
                    src={selectedItem.photoUrl}
                    alt="Today Daily Proof"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>

              {/* Panel 2: Verified Installation Photo */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-textSecondary uppercase">2. Install Baseline</span>
                  <span className="text-emerald-600 text-[10px] font-medium">Verified</span>
                </div>
                <div className="h-64 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center">
                  {photoDetail?.installationPhotoUrl ? (
                    <img
                      src={photoDetail.installationPhotoUrl}
                      alt="Install Baseline"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-textSecondary">Baseline unavailable</span>
                  )}
                </div>
              </div>

              {/* Panel 3: Previous Day Photo or Poster Design */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-textSecondary uppercase">3. Reference / Prev Day</span>
                </div>
                <div className="h-64 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center">
                  {photoDetail?.previousDayPhotoUrl ? (
                    <img
                      src={photoDetail.previousDayPhotoUrl}
                      alt="Previous Day"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : photoDetail?.posterPreviewUrl ? (
                    <img
                      src={photoDetail.posterPreviewUrl}
                      alt="Campaign Poster"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-textSecondary">No reference available</span>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata & Auto-Check Breakdown */}
            <div className="p-3 bg-surface border border-border rounded-lg space-y-2 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-textSecondary block">Plate & Driver:</span>
                  <span className="font-mono font-bold text-textPrimary">
                    {selectedItem.vehicleRegistrationNumber}
                  </span>
                  <span className="block text-textSecondary text-[11px]">{selectedItem.driverName ?? 'Driver'}</span>
                </div>
                <div>
                  <span className="text-textSecondary block">Capture Time (IST):</span>
                  <span className="font-medium text-textPrimary">
                    {new Date(selectedItem.capturedAt).toLocaleTimeString('en-IN')}
                  </span>
                  <span className="block text-textSecondary text-[11px]">{selectedItem.date}</span>
                </div>
                <div>
                  <span className="text-textSecondary block">City & Source:</span>
                  <span className="font-medium text-textPrimary">
                    {selectedItem.cityName}
                  </span>
                  <span className="block text-textSecondary text-[11px]">
                    Source: {selectedItem.reviewSource}
                  </span>
                </div>
                <div>
                  <span className="text-textSecondary block">Risk & Breach:</span>
                  <span className={`font-bold ${selectedItem.riskScore > 30 ? 'text-danger' : 'text-amber-500'}`}>
                    Risk Score: {selectedItem.riskScore}
                  </span>
                  <span className="block text-textSecondary text-[11px]">
                    SLA: {selectedItem.waitingMinutes}m waiting
                  </span>
                </div>
              </div>

              {photoDetail?.driverStats && (
                <div className="pt-2 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-textSecondary">Verified Submissions:</span>{' '}
                    <strong className="text-emerald-600">{photoDetail.driverStats.verifiedCount}</strong>
                  </div>
                  <div>
                    <span className="text-textSecondary">Rejected Total:</span>{' '}
                    <strong className="text-danger">{photoDetail.driverStats.rejectedCount}</strong>
                  </div>
                  <div>
                    <span className="text-textSecondary">30-Day Rejections:</span>{' '}
                    <strong className="text-danger">{photoDetail.driverStats.recentRejectionCount30d}</strong>
                  </div>
                  <div>
                    <span className="text-textSecondary">Missed Days:</span>{' '}
                    <strong className="text-amber-600">{photoDetail.driverStats.missedDaysCount}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Rejection Reasons Form */}
            {isRejectMode && (
              <div className="p-3 bg-danger/5 border border-danger/20 rounded-lg space-y-3">
                <span className="text-xs font-semibold text-danger block">
                  Select Rejection Reasons:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {REASON_OPTIONS.map((opt) => (
                    <label
                      key={opt.code}
                      className="flex items-start gap-2 text-xs text-textPrimary cursor-pointer hover:bg-danger/10 p-1.5 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedReasons.includes(opt.code)}
                        onChange={() => toggleReason(opt.code)}
                        className="mt-0.5 rounded border-border text-danger focus:ring-danger"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-textPrimary mb-1">
                    Moderator Note (Driver feedback):
                  </label>
                  <textarea
                    rows={2}
                    value={moderatorNote}
                    onChange={(e) => setModeratorNote(e.target.value)}
                    placeholder="Explain what the driver must correct when taking the next photo..."
                    className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-textPrimary focus:ring-1 focus:ring-danger"
                  />
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExcuseModalOpen(true)}
                className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1" /> Excuse Day Override
              </Button>

              <div className="flex items-center gap-2">
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
                      variant="danger"
                      size="sm"
                      onClick={() => setIsRejectMode(true)}
                      disabled={isSubmitting}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject [R]
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleApprove}
                      isLoading={isSubmitting}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve [A]
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
                      Back
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleReject}
                      isLoading={isSubmitting}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Confirm Rejection
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Excuse Day Override Modal */}
      {isExcuseModalOpen && selectedItem && (
        <Modal
          isOpen={isExcuseModalOpen}
          onClose={() => setIsExcuseModalOpen(false)}
          title={`Excuse Day Override: ${selectedItem.vehicleRegistrationNumber} (${selectedItem.date})`}
        >
          <div className="space-y-4">
            <p className="text-xs text-textSecondary">
              Manually excuse this day due to verified operational issues (e.g. verified garage repair receipt, severe local cyclone/strike). The day will count as payable for the driver.
            </p>

            {excuseError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs">
                {excuseError}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-textPrimary">
                Justification & Verification Details (Mandatory):
              </label>
              <textarea
                rows={3}
                value={excuseReason}
                onChange={(e) => setExcuseReason(e.target.value)}
                placeholder="E.g., Vehicle was in auto repair garage on 2026-11-02. Verified via repair invoice #4928 from Laxmi Auto Garage..."
                className="w-full text-xs p-2.5 bg-surface border border-border rounded-lg text-textPrimary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="pt-2 border-t border-border flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExcuseModalOpen(false)}
                disabled={isExcusing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExcuseDay}
                isLoading={isExcusing}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Mark Day as EXCUSED
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
