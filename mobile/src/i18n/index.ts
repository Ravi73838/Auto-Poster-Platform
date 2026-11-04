import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { resources, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from '@ap/shared-i18n';

const LANGUAGE_STORAGE_KEY = 'ap_driver_language';

export async function initI18n(): Promise<void> {
  let initialLanguage = DEFAULT_LANGUAGE;

  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
      initialLanguage = saved as Language;
    } else {
      const locales = Localization.getLocales();
      const deviceLang = locales[0]?.languageCode?.toLowerCase();
      if (deviceLang && (SUPPORTED_LANGUAGES as readonly string[]).includes(deviceLang)) {
        initialLanguage = deviceLang as Language;
      }
    }
  } catch {
    initialLanguage = DEFAULT_LANGUAGE;
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });
}

export async function setMobileLanguage(lang: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;

