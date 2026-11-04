import { useTheme } from '../../app/theme/ThemeProvider';
import { THEMES, type Theme } from '@ap/shared-constants';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation('settings');

  const options: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
    { value: THEMES.LIGHT, icon: Sun, labelKey: 'themeLight' },
    { value: THEMES.DARK, icon: Moon, labelKey: 'themeDark' },
    { value: THEMES.SYSTEM, icon: Laptop, labelKey: 'themeSystem' },
  ];

  return (
    <div className="flex items-center bg-surfaceAlt border border-border rounded-lg p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            title={t(opt.labelKey)}
            aria-label={t(opt.labelKey)}
            className={`p-1.5 rounded-md transition-colors ${
              isActive
                ? 'bg-surface text-primary shadow-xs'
                : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

