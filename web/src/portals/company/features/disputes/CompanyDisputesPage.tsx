import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Plus,
  Send,
  MessageSquare,
  Clock,
  CheckCircle2,
  Filter,
  Shield,
  FileText,
} from 'lucide-react';
import {
  DISPUTE_STATUS,
  DISPUTE_REASONS,
  type DisputeStatus,
} from '@ap/shared-constants';
import { useApi } from '../../../../shared/lib/api';
import { PageHeader } from '../../../../shared/components/PageHeader';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { Modal } from '../../../../shared/components/Modal';
import { Spinner } from '../../../../shared/components/Spinner';

export function CompanyDisputesPage() {
  const api = useApi();

  const [disputes, setDisputes] = useState<any[]>([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [activeDispute, setActiveDispute] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File Dispute Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [disputeReason, setDisputeReason] = useState<string>(DISPUTE_REASONS.FLAG_OUTCOME);
  const [description, setDescription] = useState('');
  const [claimedPaise, setClaimedPaise] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Message composer
  const [messageBody, setMessageBody] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const loadDisputes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.listDisputes('company', 1, 50);
      setDisputes(res.data || []);
      if (!selectedDisputeId && res.data && res.data[0]) {
        setSelectedDisputeId(res.data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load disputes');
    } finally {
      setIsLoading(false);
    }
  }, [api, selectedDisputeId]);

  const loadDisputeDetail = useCallback(
    async (id: string) => {
      try {
        setIsDetailLoading(true);
        const data = await api.getDisputeDetail(id, 'company');
        setActiveDispute(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load dispute detail');
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

  const openCreateModal = async () => {
    try {
      const res = await api.listCompanyCampaigns({ pageSize: 100 });
      setCampaigns(res.items || []);
      if (res.items && res.items[0]) {
        setSelectedCampaignId(res.items[0].id);
      }
      setIsCreateModalOpen(true);
    } catch {
      setIsCreateModalOpen(true);
    }
  };

  const handleCreateDispute = async () => {
    if (!description.trim() || !selectedCampaignId) return;
    try {
      setIsSubmitting(true);
      await api.companyCreateDispute({
        campaignId: selectedCampaignId,
        reason: disputeReason as any,
        description: description.trim(),
        evidenceUploadedFileIds: [],
        claimedAmountPaise: claimedPaise ? (Number(claimedPaise) * 100).toString() : undefined,
      });
      setIsCreateModalOpen(false);
      setDescription('');
      setClaimedPaise('');
      await loadDisputes();
    } catch (err: any) {
      setError(err?.message || 'Failed to file dispute');
    } finally {
      setIsSubmitting(false);
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
        },
        'company',
      );
      setMessageBody('');
      await loadDisputeDetail(selectedDisputeId);
    } catch (err: any) {
      setError(err?.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Disputes & Claims"
          description="Track photo flag appeals, campaign escrow claims, and communicate with platform moderation"
        />
        <Button onClick={openCreateModal} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          File New Dispute
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-between">
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Column: Claims List */}
        <div className="lg:col-span-4 space-y-3">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Spinner />
            </div>
          ) : disputes.length === 0 ? (
            <Card className="p-8 text-center text-textSecondary">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No active or past disputes filed.</p>
            </Card>
          ) : (
            disputes.map((d) => {
              const isSelected = d.id === selectedDisputeId;
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
                    <span>{new Date(d.createdAt).toLocaleDateString('en-IN')}</span>
                    {d.claimedAmountPaise && (
                      <span className="font-semibold text-textPrimary">
                        ₹{(Number(d.claimedAmountPaise) / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Dispute Workspace */}
        <div className="lg:col-span-8">
          {isDetailLoading ? (
            <Card className="p-12 flex justify-center items-center h-full">
              <Spinner />
            </Card>
          ) : !activeDispute ? (
            <Card className="p-12 flex flex-col justify-center items-center h-full text-center text-textSecondary">
              <FileText className="w-12 h-12 mb-3 text-textSecondary/40" />
              <p className="font-semibold text-base">Select a dispute to view details</p>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div>
                    <h3 className="text-lg font-bold text-textPrimary">
                      Dispute #{activeDispute.id.slice(0, 8)}
                    </h3>
                    <p className="text-xs text-textSecondary mt-0.5">
                      Filed on {new Date(activeDispute.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded font-bold ${
                      activeDispute.status === DISPUTE_STATUS.RESOLVED
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}
                  >
                    {activeDispute.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 text-xs">
                  <div>
                    <span className="text-textSecondary block">Reason:</span>
                    <span className="font-bold text-textPrimary">{activeDispute.reason}</span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Assigned Auto:</span>
                    <span className="font-semibold text-textPrimary">
                      {activeDispute.assignment?.driver?.driverProfile?.fullName || 'Assigned Driver (Privacy Protected)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Resolution:</span>
                    <span className="font-semibold text-textPrimary">
                      {activeDispute.resolutionType || 'Under Moderation Review'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-surfaceAlt text-xs text-textPrimary">
                  <span className="text-[10px] font-bold text-textSecondary block mb-1 uppercase tracking-wider">
                    Claim Description:
                  </span>
                  {activeDispute.details}
                </div>

                {activeDispute.resolution && (
                  <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-200">
                    <span className="text-[10px] font-bold text-green-300 block mb-1 uppercase tracking-wider">
                      Platform Decision:
                    </span>
                    {activeDispute.resolution}
                  </div>
                )}
              </Card>

              {/* Message Thread */}
              <Card className="p-6 space-y-4">
                <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Dispute Discussion & Support Notes
                </h4>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {(!activeDispute.messages || activeDispute.messages.length === 0) ? (
                    <p className="text-xs text-textSecondary">No messages yet.</p>
                  ) : (
                    activeDispute.messages.map((m: any) => (
                      <div key={m.id} className="p-3 rounded-lg bg-surfaceAlt border border-border text-xs">
                        <div className="flex justify-between items-center mb-1 text-[10px] text-textSecondary">
                          <span className="font-semibold text-textPrimary">{m.authorRole}</span>
                          <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-textPrimary whitespace-pre-wrap">{m.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <input
                    type="text"
                    placeholder="Type a message to the moderator..."
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
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* File Dispute Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="File Campaign Dispute or Claim"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Select Campaign</label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Reason</label>
            <select
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            >
              <option value={DISPUTE_REASONS.FLAG_OUTCOME}>Photo Flag Outcome Disputed</option>
              <option value={DISPUTE_REASONS.POSTER_MISSING}>Poster Missing from Auto</option>
              <option value={DISPUTE_REASONS.PRINT_QUALITY}>Poster Print Quality Issue</option>
              <option value={DISPUTE_REASONS.PAYMENT_ISSUE}>Escrow / Billing Inquiry</option>
              <option value={DISPUTE_REASONS.OTHER}>Other Concern</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">
              Claimed Refund Amount in Rupees (Optional)
            </label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={claimedPaise}
              onChange={(e) => setClaimedPaise(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg px-3 py-2 text-sm text-textPrimary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-textSecondary block mb-1">Details & Rationale</label>
            <textarea
              rows={4}
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surfaceAlt border border-border rounded-lg p-3 text-sm text-textPrimary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateDispute}
              disabled={isSubmitting || !description.trim() || !selectedCampaignId}
              className="bg-primary hover:bg-primary/90 text-primaryText"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}