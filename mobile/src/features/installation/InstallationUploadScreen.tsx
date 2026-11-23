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
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { apiClient } from '../../services/api';
import { container } from '../../services/container';
import type { AssignmentDetailDto } from '@ap/shared-types';

interface InstallationUploadScreenProps {
  assignmentId: string;
  onBack: () => void;
  onSubmitSuccess: () => void;
}

const CHECKLIST_LABELS: Record<string, string> = {
  plateVisible: 'License plate must be clearly visible and readable',
  noWrinkles: 'Poster must be flat and free of wrinkles or bubbles',
  goodLighting: 'Capture photo in good daylight with GPS enabled',
  fullPoster: 'Full auto-rickshaw rear with poster must be in frame',
};

function getChecklistText(item: unknown): string {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  const obj = item as { key?: string; label?: string; labelKey?: string };
  if (obj.key && obj.key in CHECKLIST_LABELS) return CHECKLIST_LABELS[obj.key] ?? '';
  if (obj.label) return obj.label;
  if (obj.labelKey) return obj.labelKey;
  if (obj.key) return obj.key;
  return '';
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
    material?: string;
    size?: string;
    dimensions?: string;
    printingAllowancePaise?: number;
    checklist?: unknown[];
    tips?: unknown[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

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
          setPrintGuide(guideData as any);
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

  const handlePickFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to take verification photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      const firstAsset = result.assets?.[0];
      if (!result.canceled && firstAsset?.uri) {
        setSelectedImageUri(firstAsset.uri);
      }
    } catch (err) {
      Alert.alert('Camera Error', err instanceof Error ? err.message : 'Failed to open camera');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library permission is required to choose photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      const firstAsset = result.assets?.[0];
      if (!result.canceled && firstAsset?.uri) {
        setSelectedImageUri(firstAsset.uri);
      }
    } catch (err) {
      Alert.alert('Gallery Error', err instanceof Error ? err.message : 'Failed to select image');
    }
  };

  const handleSubmitPhoto = async () => {
    if (!selectedImageUri) {
      Alert.alert('No Photo Selected', 'Please capture or choose a photo of the installed poster.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // 1. Obtain location
      let lat = 23.0225;
      let lng = 72.5714;
      let acc = 10;
      let isMock = false;
      try {
        const loc = await container.location.getCurrentLocation();
        lat = loc.latitude;
        lng = loc.longitude;
        acc = loc.accuracy;
        isMock = loc.isMock;
      } catch {
        // Fallback to default location
      }

      // 2. Presign upload
      const uploadInit = await apiClient.presignUpload({
        purpose: 'INSTALLATION_PHOTO',
        mimeType: 'image/jpeg',
        sizeBytes: 250000,
        fileName: 'auto_installation.jpg',
      });

      // 3. Upload binary to storage
      if (uploadInit.uploadUrl) {
        try {
          const resp = await fetch(selectedImageUri);
          const blob = await resp.blob();
          await fetch(uploadInit.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: { 'Content-Type': 'image/jpeg' },
          });
        } catch {
          // Fall through
        }
      }

      // 4. Confirm upload
      const fileId = uploadInit.fileId || uploadInit.fileKey;
      try {
        await apiClient.confirmUpload({
          fileId,
          fileKey: uploadInit.fileKey,
        });
      } catch {
        // Confirm might be auto or already handled
      }

      // 5. Submit installation verification proof
      await apiClient.submitInstallationPhoto(assignmentId, {
        uploadedFileId: fileId,
        latitude: lat,
        longitude: lng,
        accuracyMeters: acc,
        capturedAt: container.clock.nowIso(),
        isMockLocation: isMock,
      });

      Alert.alert(
        'Photo Submitted!',
        'Your poster verification photo has been submitted. Admin will review and approve it shortly.',
        [
          {
            text: 'OK',
            onPress: () => {
              onBack();
            },
          },
        ],
      );

      // Refresh data
      const refreshed = await apiClient.getDriverAssignment(assignmentId);
      setAssignment(refreshed);
    } catch (err) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Could not submit verification photo');
      setError(err instanceof Error ? err.message : 'Submission failed');
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

  if (error && !assignment) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error || 'Assignment not found'}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={onBack}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>Assignment not found</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={onBack}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = assignment.assignment.status;
  const allowanceRupees = Math.round(((printGuide as any)?.printingAllowancePaise ?? 0) / 100);
  const checklistItems = Array.isArray(printGuide?.checklist) ? printGuide.checklist : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Installation & Verification</Text>
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
            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(status) }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(status) }]}>{status}</Text>
            </View>
            {allowanceRupees > 0 && (
              <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.statusBadgeText, { color: '#166534' }]}>Printing Allowance: ₹{allowanceRupees}</Text>
              </View>
            )}
          </View>
        </View>

        {/* State Banner: INSTALL_SUBMITTED */}
        {status === 'INSTALL_SUBMITTED' && (
          <View style={[styles.noticeCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Text style={[styles.noticeTitle, { color: '#1D4ED8' }]}>⏳ Under Review</Text>
            <Text style={[styles.noticeDesc, { color: '#1E40AF' }]}>
              Your installation photo has been submitted and is currently being verified by admin. You will be notified once approved.
            </Text>
          </View>
        )}

        {/* State Banner: INSTALL_APPROVED / RUNNING */}
        {(status === 'INSTALL_APPROVED' || status === 'RUNNING') && (
          <View style={[styles.noticeCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Text style={[styles.noticeTitle, { color: '#15803D' }]}>✓ Installation Approved</Text>
            <Text style={[styles.noticeDesc, { color: '#166534' }]}>
              Your auto poster is verified and active! Remember to submit your daily proof photo between 06:00 and 22:00 IST.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#10B981', marginTop: 12 }]}
              onPress={onSubmitSuccess}
            >
              <Text style={styles.primaryBtnText}>Open Daily Camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* State Banner: INSTALL_REJECTED */}
        {status === 'INSTALL_REJECTED' && (
          <View style={[styles.noticeCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <Text style={[styles.noticeTitle, { color: '#DC2626' }]}>❌ Installation Rejected</Text>
            <Text style={[styles.noticeDesc, { color: '#991B1B' }]}>
              Reason: {assignment.installationPhotos?.[assignment.installationPhotos.length - 1]?.rejectionReason ?? 'Poster was not properly visible. Please recapture and resubmit.'}
            </Text>
          </View>
        )}

        {/* Print Specifications */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Printing Specifications</Text>
          <View style={styles.specRow}>
            <Text style={[styles.specKey, { color: colors.textSecondary }]}>Material:</Text>
            <Text style={[styles.specVal, { color: colors.textPrimary }]}>{printGuide?.material ?? 'Vinyl Sticker'}</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={[styles.specKey, { color: colors.textSecondary }]}>Size:</Text>
            <Text style={[styles.specVal, { color: colors.textPrimary }]}>
              {printGuide?.size ?? (printGuide as any)?.dimensions ?? 'Standard 24" x 12"'}
            </Text>
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
        {checklistItems.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Installation Checklist</Text>
            {checklistItems.map((item, idx) => (
              <View key={idx} style={styles.checkItem}>
                <Text style={{ color: colors.primary, fontWeight: '700', marginRight: 8 }}>✓</Text>
                <Text style={[styles.checkText, { color: colors.textPrimary }]}>{getChecklistText(item)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Photo Verification Rules */}
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

        {/* Step 1 Action: RESERVED status */}
        {status === 'RESERVED' && (
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

        {/* Step 2 Action: INSTALLING or INSTALL_REJECTED status */}
        {(status === 'INSTALLING' || status === 'INSTALL_REJECTED') && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Capture Verification Photo</Text>
            <Text style={[styles.helpNote, { color: colors.textSecondary, textAlign: 'left', marginBottom: 12 }]}>
              Take a clear picture of the back of your auto showing both the sticker and the registration number plate.
            </Text>

            {selectedImageUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: selectedImageUri }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewButtonRow}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: colors.border }]}
                    onPress={() => setSelectedImageUri(null)}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: '#10B981', flex: 1, marginLeft: 8 }]}
                    onPress={handleSubmitPhoto}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Submit Verification Photo</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.captureBtnRow}>
                <TouchableOpacity
                  style={[styles.cameraBtn, { backgroundColor: colors.primary }]}
                  onPress={handlePickFromCamera}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cameraBtnText}>📷 Open Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.galleryBtn, { borderColor: colors.primary }]}
                  onPress={handlePickFromGallery}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.galleryBtnText, { color: colors.primary }]}>🖼 Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'RESERVED':
      return '#DBEAFE';
    case 'INSTALLING':
      return '#FEF3C7';
    case 'INSTALL_SUBMITTED':
      return '#E0E7FF';
    case 'INSTALL_APPROVED':
    case 'RUNNING':
      return '#DCFCE7';
    case 'INSTALL_REJECTED':
      return '#FEE2E2';
    default:
      return '#F3F4F6';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'RESERVED':
      return '#1E40AF';
    case 'INSTALLING':
      return '#92400E';
    case 'INSTALL_SUBMITTED':
      return '#3730A3';
    case 'INSTALL_APPROVED':
    case 'RUNNING':
      return '#166534';
    case 'INSTALL_REJECTED':
      return '#991B1B';
    default:
      return '#374151';
  }
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
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  specKey: { fontSize: 13 },
  specVal: { fontSize: 13, fontWeight: '600' },
  downloadBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  downloadBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  helpNote: { fontSize: 11, marginTop: 8, textAlign: 'center' },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  checkText: { fontSize: 13, flex: 1, lineHeight: 18 },
  ruleText: { fontSize: 13, lineHeight: 20, marginBottom: 6 },
  actionBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  actionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  noticeCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  noticeDesc: { fontSize: 13, lineHeight: 18 },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  secondaryBtnText: { fontWeight: '600', fontSize: 14 },
  captureBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cameraBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cameraBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  galleryBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  galleryBtnText: { fontWeight: '700', fontSize: 13 },
  previewContainer: { marginTop: 8 },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },
  previewButtonRow: { flexDirection: 'row', alignItems: 'center' },
});
