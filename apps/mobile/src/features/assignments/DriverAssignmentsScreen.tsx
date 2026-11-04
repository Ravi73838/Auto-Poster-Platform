import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { apiClient } from '../../services/api';
import type { AssignmentDto } from '@ap/shared-types';

interface DriverAssignmentsScreenProps {
  onOpenAssignment: (assignmentId: string) => void;
  onExploreCampaigns: () => void;
}

export function DriverAssignmentsScreen({
  onOpenAssignment,
  onExploreCampaigns,
}: DriverAssignmentsScreenProps) {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);

  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.listDriverAssignments();
      setAssignments(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAssignments();
  };

  const handleWithdraw = (assignmentId: string) => {
    Alert.alert(
      'Withdraw from Campaign',
      'Are you sure you want to release your reserved slot? Other drivers will be able to take it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.withdrawAssignment(assignmentId, {
                reason: 'Driver requested slot release',
              });
              await loadAssignments();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not withdraw');
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your campaigns...</Text>
      </View>
    );
  }

  const activeAssignment = assignments.find((a) =>
    ['RESERVED', 'INSTALLING', 'INSTALL_SUBMITTED', 'INSTALL_APPROVED', 'RUNNING'].includes(a.status),
  );

  const pastAssignments = assignments.filter((a) =>
    ['COMPLETED', 'PAID', 'RELEASED', 'TERMINATED', 'RESERVATION_EXPIRED'].includes(a.status),
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <Text style={[styles.heading, { color: colors.textPrimary }]}>My Campaigns</Text>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Active Assignment Section */}
      <Text style={[styles.subheading, { color: colors.textSecondary }]}>Active Campaign</Text>

      {activeAssignment ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.campaignTitle, { color: colors.textPrimary }]}>
                {activeAssignment.campaignTitle ?? 'Campaign'}
              </Text>
              <Text style={[styles.autoText, { color: colors.textSecondary }]}>
                Auto: <Text style={{ color: colors.primary, fontWeight: '700' }}>{activeAssignment.vehicleRegistrationNumber ?? 'Auto'}</Text>
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(activeAssignment.status) }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(activeAssignment.status) }]}>
                {activeAssignment.status}
              </Text>
            </View>
          </View>

          {/* Next Action Box */}
          <View style={[styles.actionPromptBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Text style={[styles.actionPromptTitle, { color: '#166534' }]}>
              Next Step: {formatNextAction(activeAssignment.nextAction)}
            </Text>
            {activeAssignment.nextActionDeadline && (
              <Text style={[styles.deadlineText, { color: '#15803D' }]}>
                Deadline: {new Date(activeAssignment.nextActionDeadline).toLocaleString()}
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => onOpenAssignment(activeAssignment.id)}
            >
              <Text style={styles.primaryBtnText}>
                {activeAssignment.status === 'RESERVED'
                  ? 'View Print Guide'
                  : activeAssignment.status === 'INSTALLING' || activeAssignment.status === 'INSTALL_REJECTED'
                  ? 'Submit Photo'
                  : 'View Details'}
              </Text>
            </TouchableOpacity>

            {['RESERVED', 'INSTALLING'].includes(activeAssignment.status) && (
              <TouchableOpacity
                style={styles.withdrawBtn}
                onPress={() => handleWithdraw(activeAssignment.id)}
              >
                <Text style={styles.withdrawBtnText}>Withdraw</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Active Campaign</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            You don't have an enrolled campaign right now. Explore open campaigns and reserve an advertising slot.
          </Text>
          <TouchableOpacity
            style={[styles.exploreBtn, { backgroundColor: colors.primary }]}
            onPress={onExploreCampaigns}
          >
            <Text style={styles.exploreBtnText}>Browse Available Campaigns</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Past Assignments Section */}
      {pastAssignments.length > 0 && (
        <>
          <Text style={[styles.subheading, { color: colors.textSecondary, marginTop: 24 }]}>
            Past Campaigns
          </Text>
          {pastAssignments.map((pa) => (
            <View
              key={pa.id}
              style={[styles.pastCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.pastTitle, { color: colors.textPrimary }]}>{pa.campaignTitle ?? 'Campaign'}</Text>
                <Text style={[styles.pastSubtitle, { color: colors.textSecondary }]}>
                  {pa.vehicleRegistrationNumber ?? 'Auto'} • {pa.status}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: '#F1F5F9' }]}>
                <Text style={[styles.statusBadgeText, { color: '#475569' }]}>{pa.status}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function getStatusBg(status: string) {
  switch (status) {
    case 'RESERVED':
      return '#FEF3C7';
    case 'INSTALLING':
      return '#DBEAFE';
    case 'INSTALL_SUBMITTED':
      return '#EDE9FE';
    case 'INSTALL_APPROVED':
    case 'RUNNING':
      return '#DCFCE7';
    case 'INSTALL_REJECTED':
      return '#FEE2E2';
    default:
      return '#F1F5F9';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'RESERVED':
      return '#92400E';
    case 'INSTALLING':
      return '#1E40AF';
    case 'INSTALL_SUBMITTED':
      return '#6B21A8';
    case 'INSTALL_APPROVED':
    case 'RUNNING':
      return '#166534';
    case 'INSTALL_REJECTED':
      return '#991B1B';
    default:
      return '#475569';
  }
}

function formatNextAction(action: string) {
  switch (action) {
    case 'START_INSTALLING':
      return 'Download print design & prepare auto';
    case 'SUBMIT_PHOTO':
      return 'Stick poster and submit verification photo';
    case 'WAIT_FOR_REVIEW':
      return 'Photo under review by platform team';
    case 'FIX_INSTALLATION':
      return 'Fix installation defects and re-submit photo';
    case 'READY_TO_RUN':
      return 'Approved! Campaign will start on scheduled date';
    case 'RUNNING_DAILY_PHOTOS':
      return 'Active! Upload daily check-in photos';
    default:
      return action;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  subheading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  campaignTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  autoText: { fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  actionPromptBox: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 14 },
  actionPromptTitle: { fontSize: 13, fontWeight: '700' },
  deadlineText: { fontSize: 11, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  primaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  withdrawBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#FEE2E2' },
  withdrawBtnText: { color: '#991B1B', fontWeight: '700', fontSize: 13 },
  emptyCard: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  exploreBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  exploreBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  pastCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  pastTitle: { fontSize: 14, fontWeight: '600' },
  pastSubtitle: { fontSize: 12, marginTop: 2 },
  errorBanner: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 12 },
  errorBannerText: { color: '#991B1B', fontSize: 13 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
});

