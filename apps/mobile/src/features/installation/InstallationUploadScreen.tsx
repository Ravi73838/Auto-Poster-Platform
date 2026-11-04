import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { apiClient } from '../../services/api';
import type { AssignmentDetailDto } from '@ap/shared-types';

interface InstallationUploadScreenProps {
  assignmentId: string;
  onBack: () => void;
  onSubmitSuccess: () => void;
}

export function InstallationUploadScreen({
  assignmentId,
  onBack,
  onSubmitSuccess,
}: InstallationUploadScreenProps) {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);

  const [assignment, setAssignment] = useState<AssignmentDetailDto | null>(null);
  const [printGuide, setPrintGuide] = useState<{
    material: string;
    size: string;
    printingAllowancePaise: number;
    checklist: string[];
    tips: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        const [assignData, guideData] = await Promise.all([
          apiClient.getDriverAssignment(assignmentId),
          apiClient.getPrintGuide(assignmentId),
        ]);
        if (isMounted) {
          setAssignment(assignData);
          setPrintGuide(guideData);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load installation guide');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [assignmentId]);

  const handleDownloadPoster = async () => {
    try {
      setIsDownloading(true);
      const res = await apiClient.getPosterDownloadUrl(assignmentId);
      if (res.downloadUrl) {
        await Linking.openURL(res.downloadUrl);
      }
    } catch (err) {
      Alert.alert('Download Failed', err instanceof Error ? err.message : 'Could not fetch poster URL');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartInstalling = async () => {
    try {
      setIsSubmitting(true);
      const updated = await apiClient.startInstalling(assignmentId);
      setAssignment((prev) => (prev ? { ...prev, assignment: updated } : null));
      Alert.alert('Status Updated', 'You are now ready to print and stick the poster on your auto.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading installation guide...</Text>
      </View>
    );
  }

  if (error || !assignment || !printGuide) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error || 'Assignment not found'}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={onBack}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allowanceRupees = Math.round(printGuide.printingAllowancePaise / 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Installation & Print Guide</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Campaign Info Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.campaignTitle, { color: colors.textPrimary }]}>{assignment.campaign.title}</Text>
          <Text style={[styles.autoPlate, { color: colors.textSecondary }]}>
            Vehicle: <Text style={{ color: colors.primary, fontWeight: '700' }}>{assignment.assignment.vehicleRegistrationNumber ?? 'Auto'}</Text>
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.statusBadgeText, { color: '#1E40AF' }]}>{assignment.assignment.status}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.statusBadgeText, { color: '#166534' }]}>Printing Allowance: ₹{allowanceRupees}</Text>
            </View>
          </View>
        </View>

        {/* Print Specifications */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Printing Specifications</Text>
          <View style={styles.specRow}>
            <Text style={[styles.specKey, { color: colors.textSecondary }]}>Material:</Text>
            <Text style={[styles.specVal, { color: colors.textPrimary }]}>{printGuide.material}</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={[styles.specKey, { color: colors.textSecondary }]}>Size:</Text>
            <Text style={[styles.specVal, { color: colors.textPrimary }]}>{printGuide.size}</Text>
          </View>

          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
            onPress={handleDownloadPoster}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.downloadBtnText}>📥 Download Print-Ready Artwork</Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.helpNote, { color: colors.textSecondary }]}>
            Take this downloaded file to any local digital printing shop to print on vinyl sticker.
          </Text>
        </View>

        {/* Installation Checklist */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Installation Checklist</Text>
          {printGuide.checklist.map((item, idx) => (
            <View key={idx} style={styles.checkItem}>
              <Text style={{ color: colors.primary, fontWeight: '700', marginRight: 8 }}>✓</Text>
              <Text style={[styles.checkText, { color: colors.textPrimary }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Photo Instructions */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Photo Verification Rules</Text>
          <Text style={[styles.ruleText, { color: colors.textSecondary }]}>
            • The rear number plate must be 100% visible and readable in the photo.
          </Text>
          <Text style={[styles.ruleText, { color: colors.textSecondary }]}>
            • The poster must be flat, unwrinkled, and firmly stuck on the auto.
          </Text>
          <Text style={[styles.ruleText, { color: colors.textSecondary }]}>
            • Capture in daylight with GPS enabled on your phone.
          </Text>
        </View>

        {/* Action Button */}
        {assignment.assignment.status === 'RESERVED' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleStartInstalling}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>Start Installing (Ready to Print)</Text>
            )}
          </TouchableOpacity>
        )}

        {(assignment.assignment.status === 'INSTALLING' || assignment.assignment.status === 'INSTALL_REJECTED') && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={onSubmitSuccess}
          >
            <Text style={styles.actionBtnText}>📷 Capture & Submit Verification Photo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { paddingVertical: 4, paddingHorizontal: 6 },
  backButtonText: { fontSize: 15, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  campaignTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  autoPlate: { fontSize: 13, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  specKey: { fontSize: 13 },
  specVal: { fontSize: 13, fontWeight: '600' },
  downloadBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  downloadBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  helpNote: { fontSize: 11, marginTop: 8, textAlign: 'center' },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  checkText: { fontSize: 13, flex: 1, lineHeight: 18 },
  ruleText: { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  actionBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  actionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});

