import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../theme/ThemeProvider';
import { apiClient } from '../../services/api';
import type { DriverWalletDto, WalletStatementEntryDto } from '@ap/shared-types';

export function DriverWalletScreen() {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);

  const [wallet, setWallet] = useState<DriverWalletDto | null>(null);
  const [statement, setStatement] = useState<WalletStatementEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);
  const [withdrawRupees, setWithdrawRupees] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWalletData = useCallback(async () => {
    try {
      setError(null);
      const [walletRes, statementRes] = await Promise.all([
        apiClient.getDriverWalletBalance(),
        apiClient.getDriverWalletStatement(1, 50),
      ]);
      setWallet(walletRes);
      setStatement(statementRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadWalletData();
  };

  const formatINR = (paiseStr?: string) => {
    if (!paiseStr) return '₹0.00';
    const rupees = Number(paiseStr) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(rupees);
  };

  const handleWithdrawPress = () => {
    setWithdrawRupees('');
    setIsWithdrawModalVisible(true);
  };

  const handleConfirmWithdrawal = async () => {
    const rupeesNum = parseFloat(withdrawRupees);
    if (isNaN(rupeesNum) || rupeesNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
      return;
    }

    const requestedPaise = BigInt(Math.round(rupeesNum * 100));
    const availablePaise = wallet ? BigInt(wallet.availablePaise || wallet.balancePaise) : 0n;

    if (requestedPaise > availablePaise) {
      Alert.alert('Insufficient Balance', 'You cannot withdraw more than your available balance.');
      return;
    }

    if (requestedPaise < 10000n) {
      Alert.alert('Minimum Withdrawal', 'The minimum withdrawal amount is ₹100.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.requestDriverWithdrawal({
        amountPaise: requestedPaise.toString(),
      });
      setIsWithdrawModalVisible(false);
      Alert.alert(
        'Withdrawal Requested',
        'Your withdrawal has been queued for bank transfer. Funds usually arrive within 24 hours.',
      );
      await loadWalletData();
    } catch (err) {
      Alert.alert('Withdrawal Failed', err instanceof Error ? err.message : 'Could not process withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {/* Wallet Balance Hero Card */}
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Available Balance</Text>
        <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>
          {formatINR(wallet?.availablePaise || wallet?.balancePaise)}
        </Text>

        {BigInt(wallet?.activePayoutInTransitPaise || '0') > 0n && (
          <View style={styles.inTransitBadge}>
            <Text style={styles.inTransitText}>
              Processing transfer: {formatINR(wallet?.activePayoutInTransitPaise)}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.withdrawButton, { backgroundColor: colors.primary }]}
          onPress={handleWithdrawPress}
          activeOpacity={0.8}
        >
          <Text style={styles.withdrawButtonText}>Withdraw to Bank / UPI</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Summary Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Lifetime Earned</Text>
          <Text style={[styles.statValue, { color: '#10b981' }]}>
            {formatINR(wallet?.totalEarnedPaise)}
          </Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Withdrawn</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {formatINR(wallet?.totalWithdrawnPaise)}
          </Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Transaction Statement */}
      <View style={styles.statementSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Statement & Transactions</Text>

        {statement.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No transactions yet. Your printing allowance and campaign daily rent will be credited here.
            </Text>
          </View>
        ) : (
          statement.map((entry) => {
            const isCredit = entry.direction === 'CREDIT';
            return (
              <View
                key={entry.id}
                style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.entryInfo}>
                  <Text style={[styles.entryDesc, { color: colors.textPrimary }]}>
                    {entry.description || entry.refType}
                  </Text>
                  <Text style={[styles.entryDate, { color: colors.textSecondary }]}>
                    {new Date(entry.postedAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.entryAmountBox}>
                  <Text style={[styles.entryAmount, { color: isCredit ? '#10b981' : colors.textPrimary }]}>
                    {isCredit ? '+' : '-'}{formatINR(entry.amountPaise)}
                  </Text>
                  <Text style={[styles.balanceAfter, { color: colors.textSecondary }]}>
                    Bal: {formatINR(entry.balanceAfterPaise)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Withdrawal Modal */}
      <Modal
        visible={isWithdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Withdraw Earnings</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Available: {formatINR(wallet?.availablePaise || wallet?.balancePaise)}
            </Text>

            <View style={styles.inputWrapper}>
              <Text style={[styles.currencyPrefix, { color: colors.textPrimary }]}>₹</Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                keyboardType="numeric"
                placeholder="500"
                placeholderTextColor={colors.textSecondary}
                value={withdrawRupees}
                onChangeText={setWithdrawRupees}
                autoFocus
              />
            </View>

            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
              Minimum withdrawal: ₹100. Payout will be sent to your verified UPI ID or Bank Account on file.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsWithdrawModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmWithdrawal}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Transfer</Text>
                )}
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
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 12,
  },
  inTransitBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  inTransitText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '600',
  },
  withdrawButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  withdrawButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorBox: {
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
  },
  statementSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyBox: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  entryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  entryInfo: {
    flex: 1,
    paddingRight: 12,
  },
  entryDesc: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  entryDate: {
    fontSize: 11,
  },
  entryAmountBox: {
    alignItems: 'flex-end',
  },
  entryAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  balanceAfter: {
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '700',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingVertical: 6,
  },
  modalHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
