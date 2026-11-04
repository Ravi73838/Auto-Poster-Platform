import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Search,
  Filter,
  Eye,
  ArrowRight,
  ShieldAlert,
  Send,
  MessageSquare,
  FileCheck,
  RefreshCw,
  EyeOff,
  UserCheck,
  Scale,
} from 'lucide-react';
import {
  DISPUTE_STATUS,
  DISPUTE_QUEUES,
  DISPUTE_EFFECTS,
  DISPUTE_RESOLUTION_TYPES,
  DISPUTE_MESSAGE_VISIBILITY,
  ROLES,
} from '@ap/shared-constants';
import { useApi } from '../../../../shared/lib/api';
import { useAuthStore } from '../../../../shared/store/authStore';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { Modal } from '../../../../shared/components/Modal';
import { Spinner } from '../../../../shared/components/Spinner';

export function DisputesPage() {
  const api = useApi();
  const currentUser = useAuthStore((s) => s.user);

  const [disputes, setDisputes] = useState<any[]>([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [activeDispute, setActiveDispute] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [queueFilter, setQueueFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isRequestInfoModalOpen, setIsRequestInfoModalOpen] = useState(false);
  const [requestInfoTarget, setRequestInfoTarget] = useState<'DRIVER' | 'COMPANY' | 'BOTH'>('DRIVER');
  const [requestInfoText, setRequestInfoText] = useState('');
  const [decisionType, setDecisionType] = useState<string>(DISPUTE_RESOLUTION_TYPES.UPHELD_FOR_DRIVER);
  const [decisionText, setDecisionText] = useState('');
  const [selectedEffects, setSelectedEffects] = useState<string[]>([DISPUTE_EFFECTS.OVERTURN_PHOTO_REJECTION]);
  const [toDriverPaise, setToDriverPaise] = useState('0');
  const [toCompanyPaise, setToCompanyPaise] = useState('0');
  const [decisionPreview, setDecisionPreview] = useState<any | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Message composer
  const [messageBody, setMessageBody] = useState('');
  const [messageVisibility, setMessageVisibility] = useState<string>(DISPUTE_MESSAGE_VISIBILITY.BOTH);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const loadDisputes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.listDisputes(
        'admin',
        1,
        50,
        statusFilter || undefined,
        queueFilter || undefined,
      );
      setDisputes(res.data || []);
      if (!selectedDisputeId && res.data && res.data[0]) {
        setSelectedDisputeId(res.data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load disputes');
    } finally {
      setIsLoading(false);
    }
  }, [api, statusFilter, queueFilter, selectedDisputeId]);

  const loadDisputeDetail = useCallback(
    async (id: string) => {
      try {
        setIsDetailLoading(true);
        const data = await api.getDisputeDetail(id, 'admin');
        setActiveDispute(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load dispute workspace');
      } finally {
        setIsDetailLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  useEffect(() => {
    if (selectedDisputeId) {
      loadDisputeDetail(selectedDisputeId);
    } else {
      setActiveDispute(null);
    }
  }, [selectedDisputeId, loadDisputeDetail]);

  const handleClaimNext = async () => {
    try {
      setIsLoading(true);
      const res = await api.adminClaimNextDispute(queueFilter || undefined);
      if (res) {
        setSelectedDisputeId(res.id);
        await loadDisputes();
      } else {
        setError('No available disputes in queue');
      }
    } catch (err: any) {
      setError(err?.message || 'No available disputes in queue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async (id: string) => {
    try {
      await api.adminClaimDispute(id);
      await loadDisputeDetail(id);
      await loadDisputes();
    } catch (err: any) {
      setError(err?.message || 'Failed to claim dispute');
    }
  };

  const handleRelease = async (id: string) => {
    try {
      await api.adminReleaseDispute(id);
      await loadDisputeDetail(id);
      await loadDisputes();
    } catch (err: any) {
      setError(err?.message || 'Failed to release dispute');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedDisputeId || !messageBody.trim()) return;
    try {
      setIsSendingMessage(true);
      await api.addDisputeMessage(
        selectedDisputeId,
        {
          body: messageBody.trim(),
          visibleTo: messageVisibility as any,
        },
        'admin',
      );
      setMessageBody('');
      await loadDisputeDetail(selectedDisputeId);
    } catch (err: any) {
      setError(err?.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleToggleEvidenceVisibility = async (evidenceId: string, currentVisible: boolean) => {
    if (!selectedDisputeId) return;
    try {
      await api.adminSetEvidenceVisibility(selectedDisputeId, evidenceId, {
        visibleToOtherParty: !currentVisible,
      });
      await loadDisputeDetail(selectedDisputeId);
    } catch (err: any) {
      setError(err?.message || 'Failed to update evidence visibility');
    }
  };

  const handleSendRequestInfo = async () => {
    if (!selectedDisputeId || !requestInfoText.trim()) return;
    try {
      await api.adminRequestDisputeInfo(selectedDisputeId, {
        targetParty: requestInfoTarget,
        message: requestInfoText.trim(),
      });
      setIsRequestInfoModalOpen(false);
      setRequestInfoText('');
      await loadDisputeDetail(selectedDisputeId);
    } catch (err: any) {
      setError(err?.message || 'Failed to request info');
    }
  };

  const handlePreviewDecision = async () => {
    if (!selectedDisputeId || !decisionText.trim()) return;
    try {
      setIsPreviewing(true);
      const preview = await api.adminPreviewDisputeDecision(selectedDisputeId, {
        resolutionType: decisionType as any,
        effects: selectedEffects as any,
        decisionText: decisionText.trim(),
        toDriverPaise: toDriverPaise,
        toCompanyPaise: toCompanyPaise,
      });
      setDecisionPreview(preview);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExecuteDecision = async () => {
    if (!selectedDisputeId || !decisionText.trim()) return;
    try {
      setIsExecuting(true);
      await api.adminExecuteDisputeDecision(selectedDisputeId, {
        resolutionType: decisionType as any,
        effects: selectedEffects as any,
        decisionText: decisionText.trim(),
        toDriverPaise: toDriverPaise,
        toCompanyPaise: toCompanyPaise,
      });
      setIsDecisionModalOpen(false);
      setDecisionPreview(null);
      await loadDisputeDetail(selectedDisputeId);
      await loadDisputes();
    } catch (err: any) {
      setError(err?.message || 'Failed to execute decision');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleAcceptReopen = async (id: string) => {
    try {
      await api.adminAcceptDisputeReopen(id);
      await loadDisputeDetail(id);
      await loadDisputes();
    } catch (err: any) {
      setError(err?.message || 'Failed to accept second-level review');
    }
  };

  const toggleEffect = (effect: string) => {
    setSelectedEffects((prev) =>
      prev.includes(effect) ? prev.filter((e) => e !== effect) : [...prev, effect],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Dispute Resolution Workspace"
          description="Resolve driver claims, photo rejections, settlement hold distribution, and second-level appeals"
        />
        <Button onClick={handleClaimNext} className="flex items-center gap-2">
          <Scale className="w-4 h-4" />
          Claim Next SLA Critical
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
            <input
              type="text"
              placeholder="Search by ID, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surfaceAlt border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-textPrimary"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-textSecondary" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value={DISPUTE_STATUS.OPEN}>Open</option>
              <option value={DISPUTE_STATUS.UNDER_REVIEW}>Under Review</option>
              <option value={DISPUTE_STATUS.RESOLVED}>Resolved</option>
              <option value={DISPUTE_STATUS.REJECTED}>Rejected</option>
            </select>

            <select
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              className="bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none"
            >
              <option value="">All Queues</option>
              <option value={DISPUTE_QUEUES.MODERATION}>Moderation</option>
              <option value={DISPUTE_QUEUES.FINANCE}>Finance</option>
            </select>

            <Button variant="outline" size="sm" onClick={loadDisputes}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Split-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[700px]">
        {/* Left Pane: Disputes Queue */}
        <div className="lg:col-span-4 space-y-3 max-h-[850px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Spinner />
            </div>
          ) : disputes.length === 0 ? (
            <Card className="p-6 text-center text-textSecondary">
              <p>No disputes matching criteria.</p>
            </Card>
          ) : (
            disputes.map((d) => {
              const isSelected = d.id === selectedDisputeId;
              const isSlaBreached = d.slaDueAt && new Date(d.slaDueAt) < new Date();

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDisputeId(d.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : 'bg-surface border-border hover:border-textSecondary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-textPrimary">
                      #{d.id.slice(0, 8)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        d.status === DISPUTE_STATUS.OPEN
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : d.status === DISPUTE_STATUS.UNDER_REVIEW
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          : d.status === DISPUTE_STATUS.RESOLVED
                          ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-textPrimary truncate">{d.reason}</p>
                  <p className="text-xs text-textSecondary line-clamp-2 mt-1">{d.details}</p>

                  <div className="flex items-center justify-between text-xs text-textSecondary mt-3 pt-2 border-t border-border">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      {d.raisedByRole}
                    </span>
                    {d.slaDueAt && (
                      <span
                        className={`flex items-center gap-1 ${
                          isSlaBreached ? 'text-red-400 font-bold' : ''
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {new Date(d.slaDueAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Pane: Selected Dispute Workspace */}
        <div className="lg:col-span-8">
          {isDetailLoading ? (
            <Card className="p-12 flex justify-center items-center h-full">
              <Spinner />
            </Card>
          ) : !activeDispute ? (
            <Card className="p-12 flex flex-col justify-center items-center h-full text-center text-textSecondary">
              <Scale className="w-12 h-12 mb-3 text-textSecondary/40" />
              <p className="font-semibold text-lg">Select a dispute from the queue</p>
              <p className="text-sm max-w-sm mt-1">
                View evidence, system audit history, message thread, and execute decisions.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Reopen Request Banner for Super Admin */}
              {activeDispute.reopenRequestedAt && (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-sm font-bold text-purple-300">
                        Second-Level Review (Appeal) Requested
                      </p>
                      <p className="text-xs text-purple-200/80">
                        Requested on {new Date(activeDispute.reopenRequestedAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  {currentUser?.role === ROLES.SUPER_ADMIN && (
                    <Button
                      size="sm"
                      onClick={() => handleAcceptReopen(activeDispute.id)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Accept Reopen (Review Level 2)
                    </Button>
                  )}
                </div>
              )}

              {/* Workspace Header */}
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-textPrimary">
                        Dispute #{activeDispute.id.slice(0, 8)}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-surfaceAlt border border-border text-textSecondary">
                        Level {activeDispute.reviewLevel}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-primary/10 text-primary border border-primary/20">
                        {activeDispute.queue} Queue
                      </span>
                    </div>
                    <p className="text-sm text-textSecondary mt-1">
                      Reason: <strong className="text-textPrimary">{activeDispute.reason}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeDispute.assignedToId === currentUser?.id ? (
                      <Button variant="outline" size="sm" onClick={() => handleRelease(activeDispute.id)}>
                        Release Case
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleClaim(activeDispute.id)}>
                        Claim Case
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsRequestInfoModalOpen(true)}
                    >
                      Request Info
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => setIsDecisionModalOpen(true)}
                      className="bg-primary hover:bg-primary/90 text-primaryText"
                    >
                      Decision & Effects
                    </Button>
                  </div>
                </div>

                {/* Details & Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
                  <div>
                    <span className="text-textSecondary block">Disputant:</span>
                    <span className="font-semibold text-textPrimary">
                      {activeDispute.raisedByRole} ({activeDispute.raisedByUser?.email ?? activeDispute.raisedByUser?.mobile ?? 'User'})
                    </span>
                  </div>

                  <div>
                    <span className="text-textSecondary block">Against Party:</span>
                    <span className="font-semibold text-textPrimary">
                      {activeDispute.againstParty}
                    </span>
                  </div>

                  <div>
                    <span className="text-textSecondary block">Claimed / Held:</span>
                    <span className="font-semibold text-textPrimary">
                      ₹{((Number(activeDispute.claimedAmountPaise) || 0) / 100).toFixed(2)} / ₹
                      {((Number(activeDispute.heldAmountPaise) || 0) / 100).toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-textSecondary block">SLA Due At:</span>
                    <span className="font-semibold text-textPrimary">
                      {activeDispute.slaDueAt
                        ? new Date(activeDispute.slaDueAt).toLocaleDateString('en-IN')
                        : 'None'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-surfaceAlt text-sm text-textPrimary">
                  <span className="text-xs font-semibold text-textSecondary block mb-1">
                    Initial Claim Description:
                  </span>
                  {activeDispute.details}
                </div>
              </Card>

              {/* System Evidence Panel */}
              <Card className="p-6">
                <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-primary" />
                  System Ground Truth Evidence
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Linked Photo if any */}
                  {activeDispute.photo && (
                    <div className="p-4 rounded-xl border border-border bg-surfaceAlt/50 space-y-2">
                      <span className="text-xs font-bold text-textSecondary">Disputed Photo Proof</span>
                      <img
                        src={activeDispute.photo.photoUrl}
                        alt="Disputed Proof"
                        className="w-full h-48 object-cover rounded-lg border border-border"
                      />
                      <div className="text-xs space-y-1 text-textSecondary pt-1">
                        <p>Status: <strong className="text-textPrimary">{activeDispute.photo.status}</strong></p>
                        <p>Date: {activeDispute.photo.photoDate ? new Date(activeDispute.photo.photoDate).toLocaleDateString() : 'N/A'}</p>
                        <p>Accuracy: {activeDispute.photo.accuracyMeters}m | Risk: {activeDispute.photo.riskScore}</p>
                      </div>
                    </div>
                  )}

                  {/* Linked Assignment / Campaign info */}
                  {activeDispute.assignment && (
                    <div className="p-4 rounded-xl border border-border bg-surfaceAlt/50 space-y-2 text-xs">
                      <span className="text-xs font-bold text-textSecondary">Campaign & Assignment Context</span>
                      <p>Campaign: <strong className="text-textPrimary">{activeDispute.assignment.campaign?.title ?? 'Campaign'}</strong></p>
                      <p>Driver: <strong className="text-textPrimary">{activeDispute.assignment.driver?.driverProfile?.fullName ?? 'Driver'}</strong></p>
                      <p>Status: <strong className="text-textPrimary">{activeDispute.assignment.status}</strong></p>
                      <p>Verified Days: <strong className="text-green-400">{activeDispute.assignment.verifiedDays}</strong> / Total: {activeDispute.assignment.totalDays}</p>
                      <p>Missed Days: <strong className="text-amber-400">{activeDispute.assignment.missedDays}</strong> | Excused: {activeDispute.assignment.excusedDays}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Uploaded Evidence Files with Visibility Toggle */}
              <Card className="p-6">
                <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Uploaded Evidence & Privacy Controls
                </h4>

                {(!activeDispute.evidences || activeDispute.evidences.length === 0) ? (
                  <p className="text-xs text-textSecondary">No supporting files uploaded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeDispute.evidences.map((e: any) => (
                      <div
                        key={e.id}
                        className="p-3 rounded-lg border border-border bg-surfaceAlt flex items-center justify-between"
                      >
                        <div className="truncate mr-2">
                          <a
                            href={e.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-primary underline truncate block"
                          >
                            {e.fileUrl.split('/').pop() || 'Evidence File'}
                          </a>
                          <span className="text-[10px] text-textSecondary">
                            {e.visibleToOtherParty ? 'Shared with company' : 'Hidden from company'}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleEvidenceVisibility(e.id, e.visibleToOtherParty)}
                          className="shrink-0 text-xs flex items-center gap-1"
                        >
                          {e.visibleToOtherParty ? (
                            <>
                              <EyeOff className="w-3 h-3 text-amber-400" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3 text-green-400" />
                              Share
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Message Thread */}
              <Card className="p-6 space-y-4">
                <h4 className="text-sm font-bold text-textPrimary uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Communication Thread & Admin Notes
                </h4>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {(!activeDispute.messages || activeDispute.messages.length === 0) ? (
                    <p className="text-xs text-textSecondary">No messages recorded yet.</p>
                  ) : (
                    activeDispute.messages.map((m: any) => {
                      const isInternal = m.visibleTo === DISPUTE_MESSAGE_VISIBILITY.INTERNAL;
                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-xl border text-xs ${
                            isInternal
                              ? 'bg-amber-500/5 border-amber-500/20'
                              : 'bg-surfaceAlt border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-textPrimary">
                              {m.authorRole} ({m.author?.email ?? m.author?.mobile ?? 'User'})
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-textSecondary">
                              <span className="px-1.5 py-0.5 rounded bg-surface border border-border">
                                {m.visibleTo}
                              </span>
                              <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                            </div>
                          </div>
                          <p className="text-textPrimary whitespace-pre-wrap">{m.body}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Composer */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-textSecondary">Visible to:</span>
                    <select
                      value={messageVisibility}
                      onChange={(e) => setMessageVisibility(e.target.value)}
                      className="bg-surfaceAlt border border-border rounded px-2 py-1 text-xs text-textPrimary"
                    >
                      <option value={DISPUTE_MESSAGE_VISIBILITY.BOTH}>Both Parties</option>
                      <option value={DISPUTE_MESSAGE_VISIBILITY.DRIVER}>Driver Only</option>
                      <option value={DISPUTE_MESSAGE_VISIBILITY.COMPANY}>Company Only</option>
                      <option value={DISPUTE_MESSAGE_VISIBILITY.INTERNAL}>Internal Admin Note Only</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type a response or internal note..."
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1 px-3 py-2 bg-surfaceAlt border border-border rounded-lg text-xs text-textPrimary focus:outline-none focus:border-primary"
                    />
                    <Button
                      size="sm"
                      onClick={handleSendMessage}
                      disabled={isSendingMessage || !messageBody.trim()}
                      className="flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      Send
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Request Info Modal */}
      <Modal
        isOpen={isRequestInfoModalOpen}
        onClose={() => setIsRequestInfoModalOpen(false)}
        title="Request Additional Information"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Target Party</label>
            <select
              value={requestInfoTarget}
              onChange={(e) => setRequestInfoTarget(e.target.value as any)}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            >
              <option value="DRIVER">Driver</option>
              <option value="COMPANY">Company</option>
              <option value="BOTH">Both</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Information Requested</label>
            <textarea
              rows={4}
              value={requestInfoText}
              onChange={(e) => setRequestInfoText(e.target.value)}
              placeholder="Explain clearly what document, photo, or explanation is required..."
              className="w-full bg-surfaceAlt border border-border rounded-lg p-3 text-sm text-textPrimary focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsRequestInfoModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendRequestInfo} disabled={!requestInfoText.trim()}>
              Send Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* Decision & Effects Modal */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title="Execute Dispute Decision & Effects"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Resolution Outcome</label>
            <select
              value={decisionType}
              onChange={(e) => setDecisionType(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            >
              <option value={DISPUTE_RESOLUTION_TYPES.UPHELD_FOR_DRIVER}>Upheld For Driver</option>
              <option value={DISPUTE_RESOLUTION_TYPES.UPHELD_FOR_COMPANY}>Upheld For Company</option>
              <option value={DISPUTE_RESOLUTION_TYPES.PARTIAL}>Partial / Compromise</option>
              <option value={DISPUTE_RESOLUTION_TYPES.NO_ACTION}>No Action / Rejected</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Decision Rationale</label>
            <textarea
              rows={3}
              value={decisionText}
              onChange={(e) => setDecisionText(e.target.value)}
              placeholder="State clear reasons based on photo integrity, GPS, or policy..."
              className="w-full bg-surfaceAlt border border-border rounded-lg p-3 text-sm text-textPrimary focus:outline-none focus:border-primary"
            />
          </div>

          {/* Effects Selection */}
          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-2">
              Select Automated Effects to Execute in DB:
            </label>
            <div className="space-y-2">
              {[
                { id: DISPUTE_EFFECTS.OVERTURN_PHOTO_REJECTION, label: 'Overturn Photo Rejection (Mark Verified)' },
                { id: DISPUTE_EFFECTS.EXCUSE_DAY, label: 'Excuse Day (Without pay penalty)' },
                { id: DISPUTE_EFFECTS.REVOKE_STRIKE, label: 'Revoke Strike (And check ban lift)' },
                { id: DISPUTE_EFFECTS.LIFT_BAN, label: 'Lift Driver Ban' },
                { id: DISPUTE_EFFECTS.REINSTATE_ASSIGNMENT, label: 'Reinstate Terminated Assignment' },
                { id: DISPUTE_EFFECTS.TERMINATE_ASSIGNMENT, label: 'Terminate Assignment' },
                { id: DISPUTE_EFFECTS.RELEASE_HOLD, label: 'Release Settlement Hold' },
                { id: DISPUTE_EFFECTS.REQUEST_ADJUSTMENT, label: 'Request Ledger Adjustment (Maker-Checker)' },
                { id: DISPUTE_EFFECTS.REQUEST_REFUND, label: 'Request Refund to Company Escrow' },
              ].map((eff) => (
                <label key={eff.id} className="flex items-center gap-2 text-xs text-textPrimary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEffects.includes(eff.id)}
                    onChange={() => toggleEffect(eff.id)}
                    className="rounded border-border"
                  />
                  <span>{eff.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Held Amount Distribution if RELEASE_HOLD is checked */}
          {selectedEffects.includes(DISPUTE_EFFECTS.RELEASE_HOLD) && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-surfaceAlt border border-border">
              <div>
                <label className="text-[10px] text-textSecondary block">Release to Driver (paise)</label>
                <input
                  type="number"
                  value={toDriverPaise}
                  onChange={(e) => setToDriverPaise(e.target.value)}
                  className="w-full bg-surface border border-border rounded p-2 text-xs text-textPrimary"
                />
              </div>
              <div>
                <label className="text-[10px] text-textSecondary block">Release to Company Refund (paise)</label>
                <input
                  type="number"
                  value={toCompanyPaise}
                  onChange={(e) => setToCompanyPaise(e.target.value)}
                  className="w-full bg-surface border border-border rounded p-2 text-xs text-textPrimary"
                />
              </div>
            </div>
          )}

          {/* Preview Panel */}
          {decisionPreview && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
              <span className="text-xs font-bold text-primary block">Transaction Preview:</span>
              <ul className="text-xs space-y-1 list-disc list-inside text-textPrimary">
                {decisionPreview.effectsSummary?.map((s: string, idx: number) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" onClick={handlePreviewDecision} disabled={isPreviewing}>
              {isPreviewing ? 'Calculating...' : 'Preview Effects'}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsDecisionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteDecision}
                disabled={isExecuting || !decisionText.trim()}
                className="bg-primary hover:bg-primary/90 text-primaryText"
              >
                {isExecuting ? 'Executing...' : 'Confirm & Execute'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}