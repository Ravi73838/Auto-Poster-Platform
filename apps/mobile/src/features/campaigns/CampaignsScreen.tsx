import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_STATUS } from '@ap/shared-constants';
import type { DriverCampaignDto } from '@ap/shared-types';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { useMobileAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api';

interface CampaignsScreenProps {
  onSelectCampaign: (id: string) => void;
}

export function CampaignsScreen({ onSelectCampaign }: CampaignsScreenProps) {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);
  const user = useMobileAuthStore((s) => s.user);

  const [campaigns, setCampaigns] = useState<DriverCampaignDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [selectedSort, setSelectedSort] = useState<'STARTING_SOON' | 'HIGHEST_RENT' | 'NEWEST'>('STARTING_SOON');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.listDriverCampaigns({
        sort: selectedSort,
        limit: 20,
      });
      setCampaigns(res.items || []);
      setIsBanned(Boolean(res.isBanned));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedSort]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchCampaigns();
  }, [fetchCampaigns]);

  const isApproved = user?.status === ACCOUNT_STATUS.APPROVED;

  const renderCampaignCard = ({ item }: { item: DriverCampaignDto }) => {
    const totalEarningsRupees = Math.round(item.estimatedEarningsPaise / 100);
    const rentRupees = Math.round(item.rentForCampaignPaise / 100);
    const printingRupees = Math.round(item.printingAllowancePaise / 100);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => onSelectCampaign(item.id)}
      >
        {/* Poster Thumbnail or Placeholder */}
        <View style={styles.cardHeader}>
          {item.posterThumbnailUrl || item.posterPreviewUrl ? (
            <Image
              source={{ uri: item.posterThumbnailUrl || item.posterPreviewUrl || '' }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.background }]}>
              <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>POSTER</Text>
            </View>
          )}

          <View style={styles.headerInfo}>
            <View style={styles.badgeRow}>
              <View style={[styles.slotsBadge, { backgroundColor: '#EEF2FF' }]}>
                <Text style={styles.slotsBadgeText}>{item.slotsAvailable} Slots Available</Text>
              </View>
            </View>
            <Text style={[styles.campaignTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.companyName, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.companyName}
            </Text>
          </View>
        </View>

        {/* Location & Dates */}
        <View style={[styles.metaContainer, { borderTopColor: colors.border }]}>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Area:</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.cityName}
              {item.zoneNames && item.zoneNames.length > 0 ? ` (${item.zoneNames.join(', ')})` : ' (All Zones)'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Dates:</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
              {item.startDate} to {item.endDate} ({item.durationDays} days)
            </Text>
          </View>
        </View>

        {/* Earnings Highlight */}
        <View style={[styles.earningsBox, { backgroundColor: colors.background }]}>
          <View>
            <Text style={[styles.earningsSubtitle, { color: colors.textSecondary }]}>Total Payout</Text>
            <Text style={[styles.earningsAmount, { color: colors.primary }]}>₹{totalEarningsRupees.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.earningsBreakdown}>
            <Text style={[styles.breakdownItem, { color: colors.textSecondary }]}>
              Rent: ₹{rentRupees.toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.breakdownItem, { color: colors.textSecondary }]}>
              Printing: ₹{printingRupees.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.cardFooter}>
          <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View Details & Rules →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Driver Status Banner if not approved */}
      {!isApproved && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerTitle}>KYC Verification Required</Text>
          <Text style={styles.warningBannerText}>
            Your account is currently {user?.status || 'PENDING'}. You can explore available campaigns, but you cannot select or participate until your KYC is approved by an administrator.
          </Text>
        </View>
      )}

      {/* Account Suspended Banner */}
      {isBanned && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>Account Restricted</Text>
          <Text style={styles.errorBannerText}>
            Your account is currently suspended from selecting new campaigns. Contact support for assistance.
          </Text>
        </View>
      )}

      {/* Top Filter & Sort Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.campaignCountText, { color: colors.textSecondary }]}>
          {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'} available
        </Text>
        <TouchableOpacity
          style={[styles.sortButton, { borderColor: colors.border }]}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={[styles.sortButtonText, { color: colors.textPrimary }]}>
            Sort: {selectedSort === 'STARTING_SOON' ? 'Starting Soon' : selectedSort === 'HIGHEST_RENT' ? 'Highest Rent' : 'Newest'} ▾
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading available campaigns...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={fetchCampaigns}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : campaigns.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Campaigns Available</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            There are currently no active poster campaigns in your city. Check back soon!
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          renderItem={renderCampaignCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        />
      )}

      {/* Sort Selection Modal */}
      <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sort Campaigns</Text>

            {(['STARTING_SOON', 'HIGHEST_RENT', 'NEWEST'] as const).map((sortOpt) => (
              <TouchableOpacity
                key={sortOpt}
                style={[
                  styles.modalOption,
                  selectedSort === sortOpt && { backgroundColor: colors.background },
                ]}
                onPress={() => {
                  setSelectedSort(sortOpt);
                  setShowFilterModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    { color: selectedSort === sortOpt ? colors.primary : colors.textPrimary },
                    selectedSort === sortOpt && { fontWeight: '700' },
                  ]}
                >
                  {sortOpt === 'STARTING_SOON' && 'Starting Soonest'}
                  {sortOpt === 'HIGHEST_RENT' && 'Highest Rent'}
                  {sortOpt === 'NEWEST' && 'Newly Added'}
                </Text>
                {selectedSort === sortOpt && <Text style={{ color: colors.primary, fontWeight: 'bold' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    padding: 12,
    margin: 12,
    marginBottom: 4,
    borderRadius: 8,
  },
  warningBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  warningBannerText: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 16,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    padding: 12,
    margin: 12,
    marginBottom: 4,
    borderRadius: 8,
  },
  errorBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  campaignCountText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sortButton: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  slotsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  campaignTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 2,
  },
  companyName: {
    fontSize: 13,
  },
  metaContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    width: 50,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  earningsBox: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsSubtitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  earningsAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  earningsBreakdown: {
    alignItems: 'flex-end',
  },
  breakdownItem: {
    fontSize: 11,
  },
  cardFooter: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    alignItems: 'flex-end',
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '700',
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 6,
  },
  modalOptionText: {
    fontSize: 15,
  },
});
