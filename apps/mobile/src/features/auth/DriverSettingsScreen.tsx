import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMobileAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api';
import { LANGUAGES, type Language } from '@ap/shared-constants';
import type { SessionDto } from '@ap/shared-types';

interface Props {
  onBack: () => void;
}

export function DriverSettingsScreen({ onBack }: Props) {
  const { i18n } = useTranslation();
  const { user, language, setLanguage, logout } = useMobileAuthStore();

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

  const handleLanguageChange = (lang: Language) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>&larr; Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Driver info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Driver Account</Text>
        <Text style={styles.infoLabel}>Mobile Number</Text>
        <Text style={styles.infoValue}>{user?.mobile}</Text>
      </View>

      {/* Language Switcher */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>App Language</Text>
        <View style={styles.langRow}>
          {[
            { code: LANGUAGES.EN, label: 'English' },
            { code: LANGUAGES.HI, label: 'हिन्दी' },
            { code: LANGUAGES.GU, label: 'ગુજરાતી' },
          ].map((l) => (
            <TouchableOpacity
              key={l.code}
              onPress={() => handleLanguageChange(l.code)}
              style={[
                styles.langChip,
                language === l.code && styles.langChipActive,
              ]}
            >
              <Text
                style={[
                  styles.langChipText,
                  language === l.code && styles.langChipTextActive,
                ]}
              >
                {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Active Login Sessions */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Active Devices & Sessions</Text>
        {isLoadingSessions ? (
          <ActivityIndicator size="small" color="#0284C7" style={{ marginVertical: 12 }} />
        ) : (
          sessions.map((sess) => (
            <View key={sess.id} style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionPlatform}>
                  {sess.platform} {sess.isCurrent ? '(This device)' : ''}
                </Text>
                <Text style={styles.sessionMeta}>
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
        style={styles.logoutBtn}
        onPress={() => logout()}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    paddingRight: 16,
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 16,
    color: '#0284C7',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
  },
  langChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  langChipActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  langChipText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  langChipTextActive: {
    color: '#0284C7',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sessionPlatform: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  sessionMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  revokeText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  logoutBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

