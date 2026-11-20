import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileAuthStore } from '../../store/authStore';
import { ACCOUNT_STATUS } from '@ap/shared-constants';

interface Props {
  onOpenSettings: () => void;
  onNavigateToKyc?: () => void;
  onNavigateToCampaigns?: () => void;
}

export function DriverStatusHomeScreen({ onOpenSettings, onNavigateToKyc, onNavigateToCampaigns }: Props) {
  const { t: _t } = useTranslation(['common', 'status']);
  const user = useMobileAuthStore((s) => s.user);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case ACCOUNT_STATUS.APPROVED:
        return '#16A34A';
      case ACCOUNT_STATUS.SUSPENDED:
      case ACCOUNT_STATUS.BLOCKED:
        return '#DC2626';
      default:
        return '#D97706';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.topBar}>
        <View style={styles.headerBrand}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="cover"
          />
          <View>
            <Text style={styles.greeting}>Auto Poster Driver</Text>
            <Text style={styles.mobileText}>{user?.mobile}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsBtnText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Account Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account Status</Text>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(user?.status) },
            ]}
          />
          <Text
            style={[
              styles.statusValue,
              { color: getStatusColor(user?.status) },
            ]}
          >
            {user?.status || 'PENDING'}
          </Text>
        </View>

        {user?.status === ACCOUNT_STATUS.PENDING ? (
          <Text style={styles.statusDesc}>
            Your documents are under review. Once approved by the moderator, you will be able to select campaigns.
          </Text>
        ) : null}

        {user?.status === ACCOUNT_STATUS.APPROVED ? (
          <Text style={styles.statusDesc}>
            Your account is verified and active. You are eligible for campaign assignments.
          </Text>
        ) : null}

        {user?.status === ACCOUNT_STATUS.SUSPENDED ? (
          <Text style={styles.statusDesc}>
            Your account has been suspended. Please check with customer support.
          </Text>
        ) : null}
      </View>

      {/* KYC Compulsory Card for Unapproved Drivers */}
      {user?.status !== ACCOUNT_STATUS.APPROVED && onNavigateToKyc ? (
        <View style={[styles.card, styles.kycPromptCard]}>
          <Text style={styles.kycPromptTitle}>⚠️ KYC Verification Compulsory</Text>
          <Text style={styles.kycPromptText}>
            Campaign banners select karne aur monthly auto rent earn karne ke liye aapka Driving License aur RC verify hona compulsory hai.
          </Text>
          <TouchableOpacity
            style={styles.kycPromptBtn}
            onPress={onNavigateToKyc}
            activeOpacity={0.8}
          >
            <Text style={styles.kycPromptBtnText}>Complete KYC Verification →</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Browse Campaigns Card */}
      {onNavigateToCampaigns ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Explore Active Campaigns</Text>
          <Text style={styles.cardText}>
            View advertising banners available in your city and check prospective payouts.
          </Text>
          <TouchableOpacity
            style={styles.browseCampaignsBtn}
            onPress={onNavigateToCampaigns}
            activeOpacity={0.8}
          >
            <Text style={styles.browseCampaignsBtnText}>Browse Available Campaigns →</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Daily Photo Reminder Placeholder */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Proof of Poster</Text>
        <Text style={styles.cardText}>
          Upload a live photo with GPS every day between 06:00 and 22:00 to earn rent.
        </Text>
        <View style={styles.bannerPlaceholder}>
          <Text style={styles.bannerText}>Daily camera check opens in Phase 5</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingTop: 50,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  mobileText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  settingsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  settingsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  bannerPlaceholder: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  kycPromptCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  kycPromptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 6,
  },
  kycPromptText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    marginBottom: 14,
  },
  kycPromptBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  kycPromptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  browseCampaignsBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  browseCampaignsBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
