import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../src/theme/ThemeProvider';

export default function DriverWalletScreen() {
  const { colors } = useMobileTheme();
  const { t } = useTranslation(['common']);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Driver Earnings & Wallet</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>{t('common:emptyState')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
  },
});

