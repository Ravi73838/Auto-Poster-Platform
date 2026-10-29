import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';

export function PublicLayout() {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen flex flex-col bg-background text-textPrimary">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-primary">{t('appName')}</span>
        </div>
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
