import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { EnvironmentRibbon } from '../../shared/components/EnvironmentRibbon';

export function PublicLayout() {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen flex flex-col bg-background text-textPrimary">
      <EnvironmentRibbon />
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="Auto Poster"
            className="w-10 h-10 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
          />
          <span className="font-bold text-lg text-primary">{t('appName')}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <Outlet />
      </main>
    </div>
  );
}

