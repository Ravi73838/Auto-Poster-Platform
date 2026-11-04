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
import type { DriverDisciplineDto } from '@ap/shared-types';

interface DriverDisciplineScreenProps {
  onBack: () => void;
  onOpenDisputes?: () => void;
}

export function DriverDisciplineScreen({
  onBack,
  onOpenDisputes,
}: DriverDisciplineScreenProps) {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);

  const [discipline, setDiscipline] = useState<DriverDisciplineDto | null>(null);
  const [rules, setRules] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [discData, rulesData] = await Promise.all([
        apiClient.driverGetDisciplineMe(),
        apiClient.driverGetDisciplineRules(),
      ]);
      setDiscipline(discData);
      setRules(rulesData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load discipline record');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const strikeCount = discipline?.activeStrikes?.length || 0;
  const isBanned = discipline?.isBanned || false;

  const getMeterColor = (count: number) => {
    if (count === 0) return '#16A34A';
    if (count === 1) return '#EAB308';
    if (count === 2) return '#F97316';
    return '#DC2626';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discipline & Strikes</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading driver record...</Text>
        </View>
      ) : (
        <>
          {/* Ban Warning Banner if Banned */}
          {isBanned ? (
            <View style={styles.bannedCard}>
              <Text style={styles.bannedTitle}>Account Suspended</Text>
              <Text style={styles.bannedText}>
                Your account is suspended due to discipline violations until{' '}
                {discipline?.bannedUntil ? new Date(discipline.bannedUntil).toLocaleDateString() : 'notice'}.
              </Text>
              <Text style={styles.bannedSubtext}>
                All active campaign assignments have been cancelled. You cannot accept new campaigns while suspended.
              </Text>
            </View>
          ) : null}

          {/* Strikes Meter Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Strike Meter</Text>
              <View
                style={[
                  styles.strikeBadge,
                  { backgroundColor: getMeterColor(strikeCount) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.strikeBadgeText,
                    { color: getMeterColor(strikeCount) },
                  ]}
                >
                  {strikeCount} / 3 Strikes
                </Text>
              </View>
            </View>

            {/* Meter Dots */}
            <View style={styles.meterContainer}>
              {[1, 2, 3].map((step) => {
                const isTriggered = step <= strikeCount;
                return (
                  <View
                    key={step}
                    style={[
                      styles.meterBar,
                      {
                        backgroundColor: isTriggered
                          ? getMeterColor(strikeCount)
                          : '#E2E8F0',
                      },
                    ]}
                  />
                );
              })}
            </View>

            <Text style={styles.cardInfo}>
              {strikeCount === 0
                ? 'Your record is clean! Keep submitting genuine daily photos to maintain your good standing.'
                : strikeCount < 3
                ? `You have ${strikeCount} active strike(s). A 3rd strike results in an automatic 90-day suspension.`
                : '3 strikes reached: Your driver account is temporarily suspended.'}
            </Text>

            <View style={styles.cleanRecordBox}>
              <Text style={styles.cleanRecordText}>
                Clean record: Strikes expire after 90 days. Maintain genuine submissions to keep your record clear!
              </Text>
            </View>
          </View>

          {/* Active Strikes List */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Active Strikes History</Text>
            {discipline?.activeStrikes && discipline.activeStrikes.length > 0 ? (
              discipline.activeStrikes.map((s) => (
                <View key={s.id} style={styles.strikeRow}>
                  <View style={styles.strikeRowHeader}>
                    <Text style={styles.strikeReason}>{s.reason.replace(/_/g, ' ')}</Text>
                    <Text style={styles.strikeDate}>
                      {new Date(s.issuedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {s.notes ? <Text style={styles.strikeNotes}>{s.notes}</Text> : null}
                  {s.canAppeal && onOpenDisputes ? (
                    <TouchableOpacity onPress={onOpenDisputes} style={styles.appealBtn}>
                      <Text style={styles.appealBtnText}>Appeal This Strike →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No active strikes on your record.</Text>
            )}
          </View>

          {/* Platform Rules Summary */}
          <View style={styles.rulesCard}>
            <Text style={styles.rulesHeading}>Platform Discipline Rules</Text>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleIcon}>📸</Text>
              <View style={styles.ruleDetails}>
                <Text style={styles.ruleTitle}>Genuine Live Photos Only</Text>
                <Text style={styles.ruleDesc}>
                  Uploading a fake, reused, or manipulated photo results in an immediate strike.
                </Text>
              </View>
            </View>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleIcon}>🛠️</Text>
              <View style={styles.ruleDetails}>
                <Text style={styles.ruleTitle}>48-Hour Poster Fix Notice</Text>
                <Text style={styles.ruleDesc}>
                  If your poster is damaged or peeling, you have 48 hours to reprint and re-verify before a strike is issued.
                </Text>
              </View>
            </View>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleIcon}>🚫</Text>
              <View style={styles.ruleDetails}>
                <Text style={styles.ruleTitle}>3 Strikes = 90-Day Ban</Text>
                <Text style={styles.ruleDesc}>
                  Receiving 3 strikes suspends your account for 90 days and removes you from active campaigns.
                </Text>
              </View>
            </View>
            <View style={styles.ruleItem}>
              <Text style={styles.ruleIcon}>⏰</Text>
              <View style={styles.ruleDetails}>
                <Text style={styles.ruleTitle}>7 Consecutive Missed Days</Text>
                <Text style={styles.ruleDesc}>
                  Missing 7 consecutive daily photos marks the assignment as abandoned and cancels your participation.
                </Text>
              </View>
            </View>
          </View>
        </>
      )}
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
    marginBottom: 20,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    marginRight: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  bannedCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  bannedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  bannedText: {
    fontSize: 14,
    color: '#B91C1C',
    lineHeight: 20,
  },
  bannedSubtext: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  strikeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  strikeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  meterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  meterBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  cardInfo: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginTop: 4,
  },
  cleanRecordBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  cleanRecordText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  strikeRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 12,
  },
  strikeRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strikeReason: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  strikeDate: {
    fontSize: 12,
    color: '#64748B',
  },
  strikeNotes: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  appealStatus: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 6,
  },
  appealBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  appealBtnText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    paddingVertical: 8,
  },
  rulesCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
  },
  rulesHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ruleIcon: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 2,
  },
  ruleDetails: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  ruleDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
});
