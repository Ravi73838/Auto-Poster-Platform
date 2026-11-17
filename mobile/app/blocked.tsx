import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../src/theme/ThemeProvider';
import { useMobileAuthStore } from '../src/store/authStore';

export default function BlockedAccountScreen() {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);
  const router = useRouter();
  const logout = useMobileAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="screen-blocked-account">
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🚫</Text>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Account Blocked</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          Your driver partner account has been blocked due to policy violations or accumulated strikes. You cannot reserve new campaigns or submit photos.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/discipline')}
          accessibilityRole="button"
          accessibilityLabel="View discipline record and strikes"
          testID="btn-view-discipline"
        >
          <Text style={styles.primaryBtnText}>View Disciplinary Record</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => router.push('/disputes')}
          accessibilityRole="button"
          accessibilityLabel="File an appeal or dispute"
          testID="btn-file-appeal"
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>File an Appeal / Dispute</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out of account"
          testID="btn-blocked-logout"
        >
          <Text style={{ color: '#DC2626', fontWeight: '600' }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconText: { fontSize: 36 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  primaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginBottom: 16 },
  logoutBtn: { paddingVertical: 8, paddingHorizontal: 16 },
});
