import { useTranslation } from 'react-i18next';
import { LANGUAGES, type Language } from '@ap/shared-constants';
import { setLanguage } from '../../i18n';

const LANGUAGE_LABELS: Record<Language, string> = {
  [LANGUAGES.EN]: 'English',
  [LANGUAGES.HI]: 'हिन्दी',
  [LANGUAGES.GU]: 'ગુજરાતી',
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language?.slice(0, 2) as Language) || LANGUAGES.EN;

  return (
    <div className="flex items-center gap-1 bg-surfaceAlt border border-border rounded-lg p-0.5 text-xs font-medium">
      {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => {
        const isActive = currentLang === lang;
        return (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              isActive
                ? 'bg-surface text-primary shadow-xs font-semibold'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        );
      })}
    </div>
  );
}
