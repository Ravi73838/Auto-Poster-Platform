import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { apiClient } from '../../services/api';
import {
  DISPUTE_REASONS,
  DISPUTE_STATUS,
} from '@ap/shared-constants';
import type { DisputeDto, DisputeDetailDto } from '@ap/shared-types';

interface DriverDisputesScreenProps {
  onBack: () => void;
  defaultAssignmentId?: string;
}

export function DriverDisputesScreen({
  onBack,
  defaultAssignmentId,
}: DriverDisputesScreenProps) {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);

  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [activeDispute, setActiveDispute] = useState<DisputeDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File Dispute Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reason, setReason] = useState<string>(DISPUTE_REASONS.PHOTO_WRONGLY_REJECTED);
  const [description, setDescription] = useState('');
  const [assignmentId, setAssignmentId] = useState(defaultAssignmentId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Message composer
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Second-level appeal modal
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenText, setReopenText] = useState('');
  const [isSubmittingReopen, setIsSubmittingReopen] = useState(false);

  const loadDisputes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.listDisputes('driver', 1, 50);
      setDisputes(res.data || []);
      if (!selectedDisputeId && res.data && res.data[0]) {
        setSelectedDisputeId(res.data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load disputes');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDisputeId]);

  const loadDisputeDetail = useCallback(async (id: string) => {
    try {
      setIsDetailLoading(true);
      const data = await apiClient.getDisputeDetail(id, 'driver');
      setActiveDispute(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dispute details');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

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

  const handleCreateDispute = async () => {
    if (!description.trim() || !assignmentId.trim()) {
      setError('Assignment ID and description are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await apiClient.driverCreateDispute({
        reason: reason as any,
        description: description.trim(),
        evidenceUploadedFileIds: [],
        assignmentId: assignmentId.trim(),
      });
      setIsCreateModalOpen(false);
      setDescription('');
      await loadDisputes();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit dispute');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedDisputeId || !messageText.trim()) return;
    try {
      setIsSendingMessage(true);
      await apiClient.addDisputeMessage(
        selectedDisputeId,
        { body: messageText.trim() },
        'driver',
      );
      setMessageText('');
      await loadDisputeDetail(selectedDisputeId);
    } catch (err: any) {
      setError(err?.message || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleRequestReopen = async () => {
    if (!selectedDisputeId || !reopenText.trim()) return;
    try {
      setIsSubmittingReopen(true);
      await apiClient.requestDisputeReopen(
        selectedDisputeId,
        {
          reason: reopenText.trim(),
        },
        'driver',
      );
      setIsReopenModalOpen(false);
      setReopenText('');
      await loadDisputeDetail(selectedDisputeId);
      await loadDisputes();
    } catch (err: any) {
      setError(err?.message || 'Failed to request second-level review');
    } finally {
      setIsSubmittingReopen(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case DISPUTE_STATUS.RESOLVED:
        return '#16A34A';
      case DISPUTE_STATUS.UNDER_REVIEW:
        return '#2563EB';
      case DISPUTE_STATUS.REJECTED:
      case DISPUTE_STATUS.WITHDRAWN:
        return '#64748B';
      default:
        return '#D97706';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Disputes & Appeals</Text>
        <TouchableOpacity
          onPress={() => setIsCreateModalOpen(true)}
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Disputes Horizontal Selector */}
      {disputes.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillList}
        >
          {disputes.map((d) => {
            const isSelected = d.id === selectedDisputeId;
            return (
              <TouchableOpacity
                key={d.id}
                onPress={() => setSelectedDisputeId(d.id)}
                style={[
                  styles.pill,
                  isSelected && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[styles.pillText, isSelected && styles.pillTextSelected]}
                >
                  {d.reason.replace(/_/g, ' ')}
                </Text>
                <View
                  style={[
                    styles.pillDot,
                    { backgroundColor: getStatusColor(d.status) },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading disputes...</Text>
        </View>
      ) : disputes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Disputes Filed</Text>
          <Text style={styles.emptySubtext}>
            If you disagree with a photo rejection, penalty, or strike, you can file a dispute for moderator review.
          </Text>
          <TouchableOpacity
            onPress={() => setIsCreateModalOpen(true)}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.actionBtnText}>File an Appeal / Dispute</Text>
          </TouchableOpacity>
        </View>
      ) : activeDispute ? (
        <View style={styles.card}>
          {/* Dispute Status Header */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.disputeReason}>
                {activeDispute.dispute.reason.replace(/_/g, ' ')}
              </Text>
              <Text style={styles.disputeDate}>
                Filed on {new Date(activeDispute.dispute.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(activeDispute.dispute.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: getStatusColor(activeDispute.dispute.status) },
                ]}
              >
                {activeDispute.dispute.status}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.sectionHeading}>Your Explanation</Text>
          <Text style={styles.descriptionText}>{activeDispute.dispute.details}</Text>

          {/* Resolution Outcome if Resolved */}
          {activeDispute.dispute.resolutionType ? (
            <View style={styles.resolutionBox}>
              <Text style={styles.resolutionTitle}>Moderator Decision</Text>
              <Text style={styles.resolutionText}>
                Outcome: {activeDispute.dispute.resolutionType.replace(/_/g, ' ')}
              </Text>
              {activeDispute.dispute.resolution ? (
                <Text style={styles.decisionNotes}>
                  Notes: {activeDispute.dispute.resolution}
                </Text>
              ) : null}

              {/* Second-level appeal button if eligible */}
              {activeDispute.dispute.status === DISPUTE_STATUS.RESOLVED ||
              activeDispute.dispute.status === DISPUTE_STATUS.REJECTED ? (
                <TouchableOpacity
                  onPress={() => setIsReopenModalOpen(true)}
                  style={styles.reopenBtn}
                >
                  <Text style={styles.reopenBtnText}>
                    Request Second-Level Review (Appeal)
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Message Thread */}
          <Text style={styles.sectionHeading}>Messages with Moderator</Text>
          <View style={styles.messagesContainer}>
            {activeDispute.messages && activeDispute.messages.length > 0 ? (
              activeDispute.messages.map((m) => {
                const isDriver = m.authorRole === 'DRIVER';
                return (
                  <View
                    key={m.id}
                    style={[
                      styles.messageBubble,
                      isDriver ? styles.driverBubble : styles.moderatorBubble,
                    ]}
                  >
                    <Text style={styles.messageAuthor}>
                      {isDriver ? 'You' : 'Platform Support'}
                    </Text>
                    <Text style={styles.messageBody}>{m.body}</Text>
                    <Text style={styles.messageTime}>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyMessages}>
                No messages yet. Send a message below to provide additional details.
              </Text>
            )}
          </View>

          {/* Message Input */}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={isSendingMessage || !messageText.trim()}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary },
                (!messageText.trim() || isSendingMessage) && styles.disabledBtn,
              ]}
            >
              <Text style={styles.sendBtnText}>
                {isSendingMessage ? '...' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* File Dispute Modal */}
      <Modal visible={isCreateModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>File Dispute / Appeal</Text>

            <Text style={styles.modalLabel}>Dispute Reason</Text>
            <View style={styles.reasonRow}>
              {[
                { label: 'Photo Rejection', val: DISPUTE_REASONS.PHOTO_WRONGLY_REJECTED },
                { label: 'Strike Appeal', val: DISPUTE_REASONS.STRIKE_APPEAL },
                { label: 'Payment Issue', val: DISPUTE_REASONS.PAYMENT_ISSUE },
                { label: 'Other', val: DISPUTE_REASONS.OTHER },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.val}
                  onPress={() => setReason(opt.val)}
                  style={[
                    styles.reasonOption,
                    reason === opt.val && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonOptionText,
                      reason === opt.val && styles.reasonOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Assignment ID</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Assignment UUID..."
              value={assignmentId}
              onChangeText={setAssignmentId}
            />

            <Text style={styles.modalLabel}>Explain what happened</Text>
            <TextInput
              style={styles.modalTextArea}
              placeholder="Provide clear details and facts to help our moderators review your case..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateDispute}
                disabled={isSubmitting || !description.trim() || !assignmentId.trim()}
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.primary },
                  (!description.trim() || !assignmentId.trim() || isSubmitting) && styles.disabledBtn,
                ]}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Dispute'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reopen Request Modal */}
      <Modal visible={isReopenModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Second-Level Review Appeal</Text>
            <Text style={styles.modalSubtext}>
              A senior administrator will personally review the decision. You must explain why you believe the decision was incorrect.
            </Text>

            <TextInput
              style={styles.modalTextArea}
              placeholder="Explain new evidence or why you believe the decision was incorrect..."
              value={reopenText}
              onChangeText={setReopenText}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setIsReopenModalOpen(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRequestReopen}
                disabled={isSubmittingReopen || !reopenText.trim()}
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.primary },
                  (!reopenText.trim() || isSubmittingReopen) && styles.disabledBtn,
                ]}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmittingReopen ? 'Submitting...' : 'Request Appeal'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingTop: 48,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  createBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
  },
  pillList: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  disputeReason: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  disputeDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  resolutionBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  resolutionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  resolutionText: {
    fontSize: 13,
    color: '#15803D',
    marginTop: 2,
  },
  decisionNotes: {
    fontSize: 12,
    color: '#166534',
    marginTop: 4,
  },
  reopenBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  reopenBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  messagesContainer: {
    marginVertical: 10,
    gap: 8,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    maxWidth: '85%',
  },
  driverBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#EEF2FF',
  },
  moderatorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
  },
  messageAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  messageBody: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  messageTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  emptyMessages: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    maxHeight: 80,
  },
  sendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  reasonOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonOptionText: {
    fontSize: 12,
    color: '#475569',
  },
  reasonOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 10,
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    height: 100,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '600',
  },
  submitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
