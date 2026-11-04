import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useMobileTheme } from '../../src/theme/ThemeProvider';
import { setMobileLanguage } from '../../src/i18n';
import { useMobileAuthStore } from '../../src/store/authStore';
import { apiClient } from '../../src/services/api';
import { LANGUAGES, type Language, type Theme } from '@ap/shared-constants';
import type { SessionDto } from '@ap/shared-types';

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

  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await apiClient.listSessions();
      setSessions(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiClient.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      Alert.alert('Error', 'Failed to revoke session');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Driver info */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>Auto Driver</Text>
        <Text style={[styles.phone, { color: colors.textSecondary }]}>{user?.mobile ?? 'Not signed in'}</Text>
        <View style={styles.statusChip}>
          <Text style={[styles.statusText, { color: colors.primary }]}>{user?.status ?? 'PENDING'}</Text>
        </View>
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
          {(['system', 'light', 'dark'] as Theme[]).map((thm) => {
            const isSelected = theme === thm;
            return (
              <TouchableOpacity
                key={thm}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setTheme(thm)}
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
                  {t(`settings:${thm}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Active Login Sessions */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Active Login Sessions</Text>
        {isLoadingSessions ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
        ) : (
          sessions.map((sess) => (
            <View key={sess.id} style={[styles.sessionRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionPlatform, { color: colors.textPrimary }]}>
                  {sess.platform} {sess.isCurrent ? '(This device)' : ''}
                </Text>
                <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
                  IP: {sess.ipAddress || 'Unknown'} &bull;{' '}
                  {new Date(sess.lastUsedAt).toLocaleDateString()}
                </Text>
              </View>
              {!sess.isCurrent ? (
                <TouchableOpacity
                  onPress={() => handleRevoke(sess.id)}
                  style={styles.revokeBtn}
                >
                  <Text style={styles.revokeText}>Revoke</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: colors.danger }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>{t('auth:logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    marginBottom: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F0F9FF',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
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
  },
  optionText: {
    fontSize: 13,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sessionPlatform: {
    fontSize: 13,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  revokeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  revokeText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
