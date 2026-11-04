import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { apiClient } from '../../services/api';
import { DAY_STATUS, ERROR_CODES } from '@ap/shared-constants';
import type { TodayStatusDto, DailyPhotoSubmissionDto } from '@ap/shared-types';

interface DailyPhotoCaptureScreenProps {
  assignmentId: string;
  onBack: () => void;
  onSubmitSuccess?: () => void;
}

export function DailyPhotoCaptureScreen({
  assignmentId,
  onBack,
  onSubmitSuccess,
}: DailyPhotoCaptureScreenProps) {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);

  const [todayData, setTodayData] = useState<TodayStatusDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<DailyPhotoSubmissionDto | null>(null);

  const loadTodayData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getTodayStatus(assignmentId);
      setTodayData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today status');
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    loadTodayData();
  }, [loadTodayData]);

  const handleCaptureAndSubmit = async () => {
    if (!todayData) return;

    if (todayData.isPastCutoff) {
      Alert.alert('Cutoff Passed', 'Today cutoff (22:00 IST) has passed. You cannot submit photos for today.');
      return;
    }

    if (todayData.attemptsLeft <= 0) {
      Alert.alert('Daily Limit Reached', 'You have used all 5 submission attempts for today.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // In real Expo app, camera picker + Location.getCurrentPositionAsync()
      // Simulate clean capture with GPS coordinates inside city zone
      const now = new Date();
      const mockFileKey = `daily-proofs/dev-sim-${Date.now()}.jpg`;

      // Simulating upload through api client presign
      const uploadInit = await apiClient.request<{
        uploadedFileId: string;
        uploadUrl?: string;
      }>('uploads/presign', {
        method: 'POST',
        body: JSON.stringify({
          purpose: 'DAILY_PHOTO',
          mimeType: 'image/jpeg',
          sizeBytes: 150000,
          fileName: 'daily_auto.jpg',
        }),
      });

      // Submit daily photo
      const result = await apiClient.submitDailyPhoto(assignmentId, {
        uploadedFileId: uploadInit.uploadedFileId,
        latitude: 21.205, // Standard city zone center
        longitude: 72.855,
        accuracyMeters: 12.0,
        capturedAt: now.toISOString(),
        clientSentAt: now.toISOString(),
        isMockLocation: false,
        deviceInfo: {
          platform: 'android',
          model: 'Driver Device',
          osVersion: '14',
          appVersion: '1.0.0',
          deviceInstallId: 'dev-install-device',
        },
      });

      setSubmissionResult(result);
      await loadTodayData();
      onSubmitSuccess?.();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to submit daily photo';
      if (err?.code === ERROR_CODES.PHOTO_MOCK_LOCATION_DETECTED) {
        Alert.alert('Mock Location Blocked', 'GPS spoofing/mock location apps are strictly prohibited.');
      } else if (err?.code === ERROR_CODES.DUPLICATE_PHOTO) {
        Alert.alert('Duplicate Photo', 'This exact photo has already been uploaded. Please take a fresh live photo.');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case DAY_STATUS.VERIFIED:
        return '#16A34A';
      case DAY_STATUS.UNDER_REVIEW:
        return '#D97706';
      case DAY_STATUS.MISSED:
        return '#DC2626';
      case DAY_STATUS.EXCUSED:
        return '#2563EB';
      default:
        return '#64748B';
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading today's verification status...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>&larr; Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Daily Photo Proof</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Today Status Card */}
      {todayData && (
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              Cutoff: {todayData.cutoffTime}
            </Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: `${getStatusColor(todayData.dayStatus)}15` },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: getStatusColor(todayData.dayStatus) },
                ]}
              >
                {todayData.dayStatus}
              </Text>
            </View>
          </View>

          {/* Details breakdown */}
          <View style={styles.metricGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Attempts Left</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {todayData.attemptsLeft} / 5
              </Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Cutoff Time</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {todayData.cutoffTime}
              </Text>
            </View>
          </View>

          {todayData.dayStatus === DAY_STATUS.VERIFIED && (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>✓ Verified for Today</Text>
              <Text style={styles.successDesc}>
                Your daily proof photo is approved. Rent for today has been credited to your running earnings.
              </Text>
            </View>
          )}

          {todayData.dayStatus === DAY_STATUS.UNDER_REVIEW && (
            <View style={styles.reviewBox}>
              <Text style={styles.reviewTitle}>⏳ Under Moderator Review</Text>
              <Text style={styles.reviewDesc}>
                Your photo was submitted and is queued for verification by platform operators.
              </Text>
            </View>
          )}

          {todayData.dayStatus === DAY_STATUS.MISSED && (
            <View style={styles.missedBox}>
              <Text style={styles.missedTitle}>⚠ Day Missed</Text>
              <Text style={styles.missedDesc}>
                No verified photo was recorded before 22:00 IST cutoff.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Submission Result Feedback */}
      {submissionResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            {submissionResult.status === 'VERIFIED'
              ? 'Instant Auto-Verification Succeeded!'
              : 'Photo Sent to Moderator Queue'}
          </Text>
          <Text style={styles.resultText}>
            Risk Score: {submissionResult.autoCheckResult.riskScore} &bull; Attempts left today:{' '}
            {submissionResult.attemptsLeftToday}
          </Text>
        </View>
      )}

      {/* Instructions Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          Live Photo Guidelines
        </Text>
        <Text style={[styles.ruleItem, { color: colors.textSecondary }]}>
          1. Step 2 meters back from the rear of the auto rickshaw.
        </Text>
        <Text style={[styles.ruleItem, { color: colors.textSecondary }]}>
          2. Ensure the vehicle registration plate is clearly readable.
        </Text>
        <Text style={[styles.ruleItem, { color: colors.textSecondary }]}>
          3. Ensure the campaign poster is 100% visible and unblocked.
        </Text>
        <Text style={[styles.ruleItem, { color: colors.textSecondary }]}>
          4. Take photos in daytime light (06:00 to 22:00 IST).
        </Text>
        <Text style={[styles.ruleItem, { color: colors.textSecondary }]}>
          5. Stand with phone GPS enabled inside your registered city zone.
        </Text>
      </View>

      {/* Capture Button */}
      {todayData?.dayStatus !== DAY_STATUS.VERIFIED && (
        <TouchableOpacity
          onPress={handleCaptureAndSubmit}
          disabled={isSubmitting || todayData?.isPastCutoff || todayData?.attemptsLeft === 0}
          style={[
            styles.submitButton,
            {
              backgroundColor:
                isSubmitting || todayData?.isPastCutoff || todayData?.attemptsLeft === 0
                  ? '#94A3B8'
                  : colors.primary,
            },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              📷 Take Live Photo & Verify
            </Text>
          )}
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  backBtn: {
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
  },
  statusCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricBox: {
    flex: 1,
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  successBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  successTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 2,
  },
  successDesc: {
    fontSize: 12,
    color: '#166534',
  },
  reviewBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  reviewTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#B45309',
    marginBottom: 2,
  },
  reviewDesc: {
    fontSize: 12,
    color: '#92400E',
  },
  missedBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  missedTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#B91C1C',
    marginBottom: 2,
  },
  missedDesc: {
    fontSize: 12,
    color: '#991B1B',
  },
  resultCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 12,
    color: '#1E40AF',
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  ruleItem: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  submitButton: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
