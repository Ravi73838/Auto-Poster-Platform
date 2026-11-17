import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { apiClient } from '../../services/api';
import type { KycSubmissionStatus } from '@ap/shared-constants';

export interface KycStatusScreenProps {
  onReopenWizard?: () => void;
  onProceedToDashboard?: () => void;
}

export function KycStatusScreen({
  onReopenWizard,
  onProceedToDashboard,
}: KycStatusScreenProps) {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['kyc', 'common']);

  const [isLoading, setIsLoading] = useState(true);
  const [kycData, setKycData] = useState<{
    status: KycSubmissionStatus | string;
    submittedAt?: string;
    decisionNote?: string | null;
    rejectionReasons?: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.getDriverKyc();
      setKycData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verification status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (isLoading) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]} testID="kyc-status-loading">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Checking KYC status...</Text>
      </View>
    );
  }

  const status = kycData?.status || 'SUBMITTED';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Status Badge & Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>
            {status === 'APPROVED' ? '✓' : status === 'REJECTED' ? '✕' : status === 'NEED_MORE_INFO' ? '⚠' : '⏳'}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]} testID="kyc-status-title">
          {status === 'APPROVED'
            ? 'Account Verified!'
            : status === 'REJECTED'
            ? 'KYC Verification Rejected'
            : status === 'NEED_MORE_INFO'
            ? 'Additional Information Required'
            : 'Verification Under Review'}
        </Text>

        <Text style={[styles.desc, { color: colors.textSecondary }]} testID="kyc-status-desc">
          {status === 'APPROVED'
            ? 'Congratulations! Your auto-rickshaw and driver profile are approved. You can now browse and select advertising campaigns.'
            : status === 'REJECTED'
            ? 'Your document verification was rejected. Please review the reasons below and re-submit with clear documents.'
            : status === 'NEED_MORE_INFO'
            ? 'Our verification team needs more clarity on your submitted documents before approving your account.'
            : 'Your documents have been submitted and are currently in the moderation review queue. Approvals usually complete within 24 to 48 hours.'}
        </Text>

        {/* Reasons or decision notes */}
        {kycData?.decisionNote && (
          <View style={styles.noteBox} testID="kyc-decision-note">
            <Text style={styles.noteTitle}>Moderator Remarks:</Text>
            <Text style={styles.noteText}>{kycData.decisionNote}</Text>
          </View>
        )}

        {kycData?.rejectionReasons && kycData.rejectionReasons.length > 0 && (
          <View style={styles.reasonsBox} testID="kyc-rejection-reasons">
            <Text style={styles.reasonsTitle}>Issues Identified:</Text>
            {kycData.rejectionReasons.map((r, i) => (
              <Text key={i} style={styles.reasonItem}>
                • {r}
              </Text>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {status === 'APPROVED' && onProceedToDashboard && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={onProceedToDashboard}
            testID="btn-proceed-dashboard"
            accessibilityRole="button"
            accessibilityLabel="Proceed to campaigns dashboard"
          >
            <Text style={styles.primaryBtnText}>Browse Campaigns →</Text>
          </TouchableOpacity>
        )}

        {(status === 'NEED_MORE_INFO' || status === 'REJECTED') && onReopenWizard && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={onReopenWizard}
            testID="btn-reopen-kyc"
            accessibilityRole="button"
            accessibilityLabel="Update KYC information"
          >
            <Text style={styles.primaryBtnText}>Update & Re-Submit Documents</Text>
          </TouchableOpacity>
        )}

        {status === 'SUBMITTED' && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={loadStatus}
            testID="btn-refresh-kyc-status"
            accessibilityRole="button"
            accessibilityLabel="Refresh verification status"
          >
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Refresh Status</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconText: { fontSize: 32, color: '#2563EB' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  desc: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  noteBox: { width: '100%', backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12, marginBottom: 16 },
  noteTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  noteText: { fontSize: 13, color: '#78350F' },
  reasonsBox: { width: '100%', backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  reasonsTitle: { fontSize: 12, fontWeight: '700', color: '#991B1B', marginBottom: 4 },
  reasonItem: { fontSize: 13, color: '#B91C1C', marginTop: 2 },
  primaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginTop: 12 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
});
