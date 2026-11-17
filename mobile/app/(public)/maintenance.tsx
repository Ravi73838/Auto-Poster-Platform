import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../src/theme/ThemeProvider';

export default function MaintenanceScreen() {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="screen-maintenance">
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🛠️</Text>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>System Maintenance</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          Auto Poster platform is currently undergoing scheduled maintenance to improve service quality. Proof submissions and payouts will resume once maintenance is completed.
        </Text>

        <View style={[styles.timeBox, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Expected Window</Text>
          <Text style={[styles.timeVal, { color: colors.textPrimary }]}>Approximately 30 minutes</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => {}}
          testID="btn-refresh-maintenance"
          accessibilityRole="button"
          accessibilityLabel="Check if maintenance is completed"
        >
          <Text style={styles.primaryBtnText}>Check Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconText: { fontSize: 36 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  timeBox: { width: '100%', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 20 },
  timeLabel: { fontSize: 12, marginBottom: 4 },
  timeVal: { fontSize: 14, fontWeight: '600' },
  primaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
