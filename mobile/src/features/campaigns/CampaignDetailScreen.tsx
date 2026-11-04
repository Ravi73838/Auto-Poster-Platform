import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_STATUS } from '@ap/shared-constants';
import type { DriverCampaignDto } from '@ap/shared-types';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { useMobileAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api';

interface CampaignDetailScreenProps {
  campaignId: string;
  onBack: () => void;
  onSelectSuccess?: (assignmentId: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function CampaignDetailScreen({
  campaignId,
  onBack,
  onSelectSuccess,
}: CampaignDetailScreenProps) {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);
  const user = useMobileAuthStore((s) => s.user);

  const [campaign, setCampaign] = useState<DriverCampaignDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPosterModal, setShowPosterModal] = useState(false);

  const handleSelectCampaign = async () => {
    try {
      setIsSelecting(true);
      const assignment = await apiClient.selectCampaign(campaignId);
      Alert.alert(
        'Slot Reserved!',
        'Your advertising slot is reserved for 48 hours. Download the print guide to print and stick the poster.',
        [
          {
            text: 'View Print Guide',
            onPress: () => onSelectSuccess?.(assignment.id),
          },
        ],
      );
    } catch (err) {
      Alert.alert('Selection Failed', err instanceof Error ? err.message : 'Could not select campaign');
    } finally {
      setIsSelecting(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadDetail() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient.getDriverCampaignDetail(campaignId);
        if (isMounted) {
          setCampaign(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load campaign');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [campaignId]);

  if (isLoading) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading campaign details...</Text>
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={[styles.centerBox, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error || 'Campaign not found'}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={onBack}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isApproved = user?.status === ACCOUNT_STATUS.APPROVED;
  const posterUrl = campaign.posterPreviewUrl || campaign.posterThumbnailUrl;
  const totalEarningsRupees = Math.round(campaign.estimatedEarningsPaise / 100);
  const rentRupees = Math.round(campaign.rentForCampaignPaise / 100);
  const printingRupees = Math.round(campaign.printingAllowancePaise / 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header bar */}
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          Campaign Details
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Poster Preview Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {posterUrl ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowPosterModal(true)}
              style={styles.posterContainer}
            >
              <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="contain" />
              <View style={styles.zoomHintBadge}>
                <Text style={styles.zoomHintText}>Tap to enlarge 🔍</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.noPosterBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.noPosterText, { color: colors.textSecondary }]}>No poster artwork uploaded yet</Text>
            </View>
          )}

          <View style={styles.titleSection}>
            <View style={styles.badgeRow}>
              <View style={[styles.slotsBadge, { backgroundColor: '#EEF2FF' }]}>
                <Text style={styles.slotsBadgeText}>{campaign.slotsAvailable} Slots Available</Text>
              </View>
            </View>
            <Text style={[styles.campaignTitle, { color: colors.textPrimary }]}>{campaign.title}</Text>
            <Text style={[styles.companyName, { color: colors.textSecondary }]}>by {campaign.companyName}</Text>
          </View>
        </View>

        {/* Payout & Earnings Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Estimated Driver Earnings</Text>
          <View style={[styles.payoutHighlight, { backgroundColor: colors.background }]}>
            <Text style={[styles.payoutLabel, { color: colors.textSecondary }]}>Total Payout for Full Campaign</Text>
            <Text style={[styles.payoutValue, { color: colors.primary }]}>₹{totalEarningsRupees.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.breakdownList}>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Poster Rent ({campaign.durationDays} days):</Text>
              <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>₹{rentRupees.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Printing & Sticking Allowance:</Text>
              <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>₹{printingRupees.toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <Text style={[styles.payoutNote, { color: colors.textSecondary }]}>
            * Printing allowance is credited to your wallet once your installation photo is verified and approved. Rent is credited after campaign completion based on daily verified photos.
          </Text>
        </View>

        {/* Campaign Schedule & Area */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Schedule & Operating Area</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Duration:</Text>
            <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{campaign.durationDays} Days</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Start Date:</Text>
            <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{campaign.startDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: colors.textSecondary }]}>End Date:</Text>
            <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{campaign.endDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: colors.textSecondary }]}>City:</Text>
            <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{campaign.cityName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Target Zones:</Text>
            <Text style={[styles.detailVal, { color: colors.textPrimary }]}>
              {campaign.zoneNames && campaign.zoneNames.length > 0 ? campaign.zoneNames.join(', ') : 'City-wide (All Zones)'}
            </Text>
          </View>
        </View>

        {/* Print Specifications */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Poster Specifications</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Material:</Text>
            <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{campaign.printMaterial.replace('_', ' ')}</Text>
          </View>
          {campaign.printSize && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Dimensions:</Text>
              <Text style={[styles.detailVal, { color: colors.textPrimary }]}>{campaign.printSize}</Text>
            </View>
          )}
          <View style={styles.guidelineBox}>
            <Text style={[styles.guidelineTitle, { color: colors.textPrimary }]}>Sticking Instructions</Text>
            <Text style={[styles.guidelineText, { color: colors.textSecondary }]}>
              • Clean the auto-rickshaw rear panel thoroughly before sticking.{'\n'}
              • Ensure the poster is placed flat without air bubbles.{'\n'}
              • The poster must NOT cover the registration number plate or rear indicators.
            </Text>
          </View>
        </View>

        {/* Daily Rules */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Daily Verification Rules</Text>
          <Text style={[styles.ruleItem, { color: colors.textSecondary }]}>
            📸 <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Daily Live Photo:</Text> You must upload one live photo with GPS every day between 6:00 AM and 10:00 PM.
          </Text>
          <Text style={[styles.ruleItem, { color: colors.textSecondary }]}>
            📍 <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Location Match:</Text> The photo must be taken inside your designated operating city or zones.
          </Text>
          <Text style={[styles.ruleItem, { color: colors.textSecondary }]}>
            ⏳ <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Fair Payout:</Text> You are compensated for every day your photo is verified and approved.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Footer */}
      <View style={[styles.footerBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {!isApproved ? (
          <View style={styles.disabledActionBox}>
            <Text style={styles.disabledReasonText}>KYC Approval Required to Select Campaign</Text>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.selectButton, { backgroundColor: colors.primary }]}
              onPress={handleSelectCampaign}
              disabled={isSelecting}
            >
              {isSelecting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.selectButtonText}>Accept & Reserve Slot (48h)</Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.phaseNoticeText, { color: colors.textSecondary }]}>
              Reserves 1 auto slot for 48 hours. Print & stick poster within deadline.
            </Text>
          </View>
        )}
      </View>

      {/* Fullscreen Poster Modal */}
      <Modal visible={showPosterModal} transparent animationType="fade" onRequestClose={() => setShowPosterModal(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowPosterModal(false)}>
            <Text style={styles.modalCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {posterUrl && (
            <Image source={{ uri: posterUrl }} style={styles.modalPosterImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  posterContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  noPosterBox: {
    height: 120,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPosterText: {
    fontSize: 13,
  },
  titleSection: {
    marginTop: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  slotsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  slotsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  campaignTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  companyName: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  payoutHighlight: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  payoutLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  payoutValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  breakdownList: {
    gap: 8,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  payoutNote: {
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  detailKey: {
    fontSize: 13,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  guidelineBox: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  guidelineTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  guidelineText: {
    fontSize: 12,
    lineHeight: 18,
  },
  ruleItem: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  disabledActionBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledReasonText: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 13,
  },
  actionContainer: {
    alignItems: 'center',
    width: '100%',
  },
  selectButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  disabledSelectButton: {
    backgroundColor: '#94A3B8',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  disabledSelectButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  comingSoonPill: {
    backgroundColor: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  comingSoonPillText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  phaseNoticeText: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalPosterImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH * 1.2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

