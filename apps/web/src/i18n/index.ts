import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from '@ap/shared-i18n';

function detectLanguage(): Language {
  const saved = localStorage.getItem('ap_language') as Language | null;
  if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
    return saved;
  }

  const browser = navigator.language?.slice(0, 2).toLowerCase();
  if (browser && (SUPPORTED_LANGUAGES as readonly string[]).includes(browser)) {
    return browser as Language;
  }

  return DEFAULT_LANGUAGE;
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
});

export function setLanguage(lang: Language): void {
  localStorage.setItem('ap_language', lang);
  i18n.changeLanguage(lang);
}

export default i18n;

