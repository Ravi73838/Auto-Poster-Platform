import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useMobileTheme } from '../../src/theme/ThemeProvider';
import { setMobileLanguage } from '../../src/i18n';
import { useMobileAuthStore } from '../../src/store/authStore';
import { LANGUAGES, THEMES, type Language, type Theme } from '@ap/shared-constants';

const LANGUAGE_OPTIONS: { lang: Language; label: string }[] = [
  { lang: LANGUAGES.EN, label: 'English' },
  { lang: LANGUAGES.HI, label: 'हिन्दी' },
  { lang: LANGUAGES.GU, label: 'ગુજરાતી' },
];

export default function ProfileScreen() {
  const { colors, theme, setTheme } = useMobileTheme();
  const { t, i18n } = useTranslation(['settings', 'common', 'auth']);
  const { user, logout } = useMobileAuthStore();
  const router = useRouter();

  const currentLang = (i18n.language?.slice(0, 2) as Language) || LANGUAGES.EN;

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Driver info */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{user?.name ?? 'Driver'}</Text>
        <Text style={[styles.phone, { color: colors.textSecondary }]}>{user?.phone ?? '9876543210'}</Text>
      </View>

      {/* Language Selector */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('settings:language')}</Text>
        <View style={styles.buttonRow}>
          {LANGUAGE_OPTIONS.map((opt) => {
            const isSelected = currentLang === opt.lang;
            return (
              <TouchableOpacity
                key={opt.lang}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setMobileLanguage(opt.lang)}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: isSelected ? colors.primaryText : colors.textPrimary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Theme Selector */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('settings:theme')}</Text>
        <View style={styles.buttonRow}>
          {[
            { value: THEMES.LIGHT, label: t('settings:themeLight') },
            { value: THEMES.DARK, label: t('settings:themeDark') },
            { value: THEMES.SYSTEM, label: t('settings:themeSystem') },
          ].map((opt) => {
            const isSelected = theme === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setTheme(opt.value as Theme)}
              >
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: isSelected ? colors.primaryText : colors.textPrimary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: colors.danger }]}
        onPress={handleLogout}
      >
        <Text style={[styles.logoutText, { color: colors.danger }]}>{t('auth:logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  phone: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 13,
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
