import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../src/theme/ThemeProvider';

export default function UpdateRequiredScreen() {
  const { colors } = useMobileTheme();
  const { t: _t } = useTranslation(['common']);

  const handleUpdate = () => {
    Linking.openURL('market://details?id=in.autoposter.driver').catch(() => {
      Linking.openURL('https://play.google.com/store/apps/details?id=in.autoposter.driver').catch(() => {});
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="screen-update-required">
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🚀</Text>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>App Update Required</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          A critical update is available with required improvements to location accuracy verification and proof uploads. Please update your Auto Poster app to continue.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={handleUpdate}
          testID="btn-update-playstore"
          accessibilityRole="button"
          accessibilityLabel="Open Google Play Store to update app"
        >
          <Text style={styles.primaryBtnText}>Update via Play Store</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconText: { fontSize: 36 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  primaryBtn: { width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
