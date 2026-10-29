import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMobileTheme } from '../../src/theme/ThemeProvider';
import { useMobileAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const { colors } = useMobileTheme();
  const { t } = useTranslation(['auth', 'common']);
  const { loginAsDriver } = useMobileAuthStore();
  const router = useRouter();

  const handleLogin = () => {
    loginAsDriver();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('auth:welcomeBack')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('auth:enterPhone')}</Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleLogin}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>
            {t('auth:devLoginDriver')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
