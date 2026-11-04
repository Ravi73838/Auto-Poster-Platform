import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Flag,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Users,
  ZoomIn,
} from 'lucide-react';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { Spinner } from '../../../../shared/components/Spinner';
import { Modal } from '../../../../shared/components/Modal';
import { EmptyState } from '../../../../shared/components/EmptyState';
import { useApi } from '../../../../shared/lib/api';
import {
  PHOTO_FLAG_REASONS,
  type PhotoFlagReason,
} from '@ap/shared-constants';
import type {
  CompanyCampaignProgressDto,
  CompanyDailyPhotoDto,
} from '@ap/shared-types';

interface CampaignProgressTabProps {
  campaignId: string;
}

const FLAG_REASONS: { code: PhotoFlagReason; label: string }[] = [
  { code: PHOTO_FLAG_REASONS.POSTER_NOT_VISIBLE, label: 'Poster is removed, missing, or obscured' },
  { code: PHOTO_FLAG_REASONS.WRONG_AUTO, label: 'Vehicle or number plate does not match' },
  { code: PHOTO_FLAG_REASONS.LOOKS_FAKE, label: 'Photo appears manipulated, old, or fake' },
  { code: PHOTO_FLAG_REASONS.OTHER, label: 'Other quality or compliance issue' },
];

export function CampaignProgressTab({ campaignId }: CampaignProgressTabProps) {
  const api = useApi();
  const [progress, setProgress] = useState<CompanyCampaignProgressDto | null>(null);
  const [photos, setPhotos] = useState<CompanyDailyPhotoDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state for photos
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Photo Detail & Flagging Modal
  const [selectedPhoto, setSelectedPhoto] = useState<CompanyDailyPhotoDto | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState<PhotoFlagReason>(PHOTO_FLAG_REASONS.POSTER_NOT_VISIBLE);
  const [flagNote, setFlagNote] = useState<string>('');
  const [isFlagging, setIsFlagging] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [progData, photoRes] = await Promise.all([
        api.getCampaignProgress(campaignId),
        api.listCompanyDailyPhotos(campaignId, 1, 50, dateFilter || undefined),
      ]);
      setProgress(progData);
      setPhotos(photoRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress data');
    } finally {
      setIsLoading(false);
    }
  }, [api, campaignId, selectedStatus, dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownloadCsv = () => {
    try {
      const token = localStorage.getItem('token') || '';
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
      const downloadUrl = `${baseUrl}/company/campaigns/${campaignId}/progress.csv`;

      // Trigger download with auth header via fetch blob
      fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to download CSV');
          return res.blob();
        })
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `campaign-${campaignId}-progress.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        })
        .catch((err) => {
          alert(err instanceof Error ? err.message : 'Download failed');
        });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export error');
    }
  };

  const handleOpenFlagModal = (photo: CompanyDailyPhotoDto) => {
    setSelectedPhoto(photo);
    setFlagReason(PHOTO_FLAG_REASONS.POSTER_NOT_VISIBLE);
    setFlagNote('');
    setFlagError(null);
    setIsFlagModalOpen(true);
  };

  const handleSubmitFlag = async () => {
    if (!selectedPhoto) return;
    setIsFlagging(true);
    setFlagError(null);
    try {
      await api.flagCompanyPhoto(campaignId, selectedPhoto.id, {
        reason: flagReason,
        note: flagNote.trim() || undefined,
      });
      setIsFlagModalOpen(false);
      setIsPhotoModalOpen(false);
      await loadData();
    } catch (err) {
      setFlagError(err instanceof Error ? err.message : 'Failed to flag photo');
    } finally {
      setIsFlagging(false);
    }
  };

  if (isLoading && !progress) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (error && !progress) {
    return (
      <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-center justify-between">
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={loadData}>
          Retry
        </Button>
      </div>
    );
  }

  if (!progress) return null;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-textPrimary">Campaign Verification & Proof</h2>
          <p className="text-xs text-textSecondary">
            Live daily photo tracking, verified days, and privacy-masked driver compliance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadCsv}>
            <Download className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Download CSV Report
          </Button>
        </div>
      </div>

      {/* KPI Headline Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Active Autos
          </span>
          <p className="text-xl font-bold text-textPrimary">
            {progress.runningVehicles}{' '}
            <span className="text-xs font-normal text-textSecondary">/ {progress.totalVehicles}</span>
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Verified Today
          </span>
          <p className="text-xl font-bold text-emerald-600">
            {progress.todayCoveragePercent}%
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Overall Coverage
          </span>
          <p className="text-xl font-bold text-textPrimary">
            {progress.overallCoveragePercent}%
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Verified Photos Today
          </span>
          <p className="text-xl font-bold text-primary">
            {progress.todayVerifiedPhotos}{' '}
            <span className="text-xs font-normal text-textSecondary">
              / {progress.todayExpectedPhotos} expected
            </span>
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-textSecondary flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Missed Rate
          </span>
          <p className="text-xl font-bold text-amber-600">
            {progress.overallMissedRatePercent}%
          </p>
        </Card>
      </div>

      {/* Timeseries and Zone Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeseries Chart (SVG based) */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-textPrimary">Daily Verification Trends</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Verified
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Under Review
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Missed
              </span>
            </div>
          </div>

          {progress.dailySeries.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-textSecondary">
              No daily tracking data recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 overflow-x-auto border-b border-border">
                {progress.dailySeries.map((day) => {
                  const total = (day.verified || 0) + (day.underReview || 0) + (day.missed || 0) || 1;
                  const vHeight = ((day.verified || 0) / total) * 100;
                  const pHeight = ((day.underReview || 0) / total) * 100;
                  const mHeight = ((day.missed || 0) / total) * 100;

                  return (
                    <div
                      key={day.date}
                      className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-1 h-full justify-end group relative"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] rounded px-1.5 py-0.5 pointer-events-none whitespace-nowrap z-10 shadow">
                        {day.date}: {day.verified} verified, {day.underReview} under review, {day.missed} missed
                      </div>

                      {/* Stacked bar */}
                      <div className="w-full flex flex-col justify-end h-full rounded-t overflow-hidden bg-surfaceAlt">
                        {mHeight > 0 && (
                          <div style={{ height: `${mHeight}%` }} className="bg-red-400 w-full" />
                        )}
                        {pHeight > 0 && (
                          <div style={{ height: `${pHeight}%` }} className="bg-amber-400 w-full" />
                        )}
                        {vHeight > 0 && (
                          <div style={{ height: `${vHeight}%` }} className="bg-emerald-500 w-full" />
                        )}
                      </div>

                      <span className="text-[10px] text-textSecondary font-mono truncate max-w-full">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Zone Breakdown */}
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-textPrimary">Zone Performance</h3>
          {progress.zoneBreakdown.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-textSecondary">
              All zones combined
            </div>
          ) : (
            <div className="space-y-3">
              {progress.zoneBreakdown.map((zone) => {
                const pct = zone.vehicleCount > 0 ? Math.round((zone.verifiedToday / zone.vehicleCount) * 100) : 0;
                return (
                  <div key={zone.zoneId} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium">
                      <span className="text-textPrimary">{zone.zoneName}</span>
                      <span className="text-textSecondary">
                        {zone.vehicleCount} autos &bull; {pct}% verified
                      </span>
                    </div>
                    <div className="w-full h-2 bg-surfaceAlt rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Anonymized Daily Photo Gallery */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-textPrimary">Proof Photo Gallery</h3>
            <p className="text-xs text-textSecondary">
              Driver privacy-protected proof photos (identities and exact coordinates masked)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {photos.length === 0 ? (
          <Card>
            <EmptyState
              title="No Photos Found"
              description="No proof photos match the selected criteria for this campaign."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <Card
                key={photo.id}
                className="overflow-hidden flex flex-col justify-between hover:border-primary/50 transition cursor-pointer group"
                onClick={() => {
                  setSelectedPhoto(photo);
                  setIsPhotoModalOpen(true);
                }}
              >
                <div className="space-y-2">
                  <div className="h-44 w-full bg-surface border-b border-border overflow-hidden relative">
                    <img
                      src={photo.thumbnailUrl}
                      alt="Proof Photo"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
                      {photo.driverCode}
                    </div>
                    {photo.isFlagged && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-amber-600 text-[10px] text-white font-semibold flex items-center gap-1">
                        <Flag className="w-2.5 h-2.5" /> Flagged
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-textPrimary">{photo.zoneName || 'City Zone'}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          photo.status === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : photo.status === 'REJECTED'
                            ? 'bg-red-500/10 text-red-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {photo.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-textSecondary flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {photo.date}
                    </p>
                  </div>
                </div>

                <div className="px-3 pb-3 pt-1 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-textSecondary flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-primary" /> ~110m Radius
                  </span>
                  {!photo.isFlagged && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenFlagModal(photo);
                      }}
                      className="text-[11px] text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                    >
                      <Flag className="w-3 h-3" /> Flag
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Photo Detail Modal with Zoom & Fuzzy Location */}
      {isPhotoModalOpen && selectedPhoto && (
        <Modal
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          title={`Proof Photo: ${selectedPhoto.driverCode}`}
        >
          <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
            <div className="h-72 w-full bg-black/90 rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src={selectedPhoto.thumbnailUrl}
                alt="Enlarged Proof"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-surface border border-border rounded-lg text-xs">
              <div>
                <span className="text-textSecondary block">Masked Driver/Vehicle:</span>
                <span className="font-mono font-semibold text-textPrimary">
                  {selectedPhoto.driverCode}
                </span>
              </div>
              <div>
                <span className="text-textSecondary block">Date:</span>
                <span className="font-medium text-textPrimary">
                  {selectedPhoto.date}
                </span>
              </div>
              <div>
                <span className="text-textSecondary block">Zone:</span>
                <span className="font-medium text-textPrimary">
                  {selectedPhoto.zoneName || 'City Zone'}
                </span>
              </div>
              <div>
                <span className="text-textSecondary block">Status:</span>
                <span className="font-semibold text-emerald-600">
                  {selectedPhoto.status}
                </span>
              </div>
            </div>

            {/* Privacy Protection Note */}
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-textSecondary flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-textPrimary block">Privacy Protected Geo-Location</span>
                <p>
                  Approximate coordinates: {selectedPhoto.approxLat.toFixed(3)}, {selectedPhoto.approxLng.toFixed(3)} (rounded to ~110m resolution to protect driver privacy).
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between">
              {!selectedPhoto.isFlagged ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                  onClick={() => handleOpenFlagModal(selectedPhoto)}
                >
                  <Flag className="w-3.5 h-3.5 mr-1.5" />
                  Flag this photo
                </Button>
              ) : (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> You have flagged this photo for admin review
                </span>
              )}

              <Button variant="outline" size="sm" onClick={() => setIsPhotoModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Flagging Modal */}
      {isFlagModalOpen && selectedPhoto && (
        <Modal
          isOpen={isFlagModalOpen}
          onClose={() => setIsFlagModalOpen(false)}
          title={`Flag Photo: ${selectedPhoto.driverCode}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-textSecondary">
              If this photo shows the wrong poster, a damaged poster, or does not meet quality standards, submit a flag. Our operations moderation team will investigate.
            </p>

            {flagError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs">
                {flagError}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-textPrimary">
                Reason for Flagging:
              </label>
              <div className="space-y-1.5">
                {FLAG_REASONS.map((r) => (
                  <label
                    key={r.code}
                    className="flex items-center gap-2 text-xs text-textPrimary p-2 rounded border border-border hover:bg-surfaceAlt cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="flagReason"
                      value={r.code}
                      checked={flagReason === r.code}
                      onChange={() => setFlagReason(r.code)}
                      className="text-primary focus:ring-primary"
                    />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-textPrimary">
                Additional Note (Optional, max 500 characters):
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="Describe what looks wrong with the poster or vehicle..."
                className="w-full text-xs p-2.5 bg-surface border border-border rounded-lg text-textPrimary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="pt-2 border-t border-border flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFlagModalOpen(false)}
                disabled={isFlagging}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitFlag}
                isLoading={isFlagging}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Submit Flag to Admin
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
