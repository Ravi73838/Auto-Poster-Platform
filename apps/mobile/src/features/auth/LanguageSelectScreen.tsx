import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type Language } from '@ap/shared-constants';
import { useMobileAuthStore } from '../../store/authStore';

interface Props {
  onSelectLanguage: (lang: Language) => void;
}

export function LanguageSelectScreen({ onSelectLanguage }: Props) {
  const { i18n } = useTranslation();
  const setLanguage = useMobileAuthStore((s) => s.setLanguage);

  const languages: { code: Language; title: string; subtitle: string }[] = [
    { code: LANGUAGES.EN, title: 'English', subtitle: 'Continue in English' },
    { code: LANGUAGES.HI, title: 'हिन्दी', subtitle: 'हिन्दी में जारी रखें' },
    { code: LANGUAGES.GU, title: 'ગુજરાતી', subtitle: 'ગુજરાતીમાં આગળ વધો' },
  ];

  const handleSelect = (code: Language) => {
    i18n.changeLanguage(code);
    setLanguage(code);
    onSelectLanguage(code);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>Auto Poster</Text>
        <Text style={styles.title}>Choose Your Language</Text>
        <Text style={styles.subtitle}>अपनी भाषा चुनें / તમારી ભાષા પસંદ કરો</Text>
      </View>

      <View style={styles.list}>
        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={styles.langButton}
            onPress={() => handleSelect(lang.code)}
            activeOpacity={0.7}
          >
            <Text style={styles.langTitle}>{lang.title}</Text>
            <Text style={styles.langSubtitle}>{lang.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0284C7',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  list: {
    gap: 16,
  },
  langButton: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  langTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  langSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
});

