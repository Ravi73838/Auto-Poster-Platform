import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Building2,
  Megaphone,
  MapPin,
  CreditCard,
  BarChart3,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { useAuthStore } from '../../shared/store/authStore';

export function CompanyLayout() {
  const { t } = useTranslation(['common', 'auth', 'status']);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/company/dashboard', label: t('common:dashboard'), icon: LayoutDashboard },
    { to: '/company/business-profile', label: 'Business Profile', icon: Building2 },
    { to: '/company/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/company/tracking', label: 'Tracking', icon: MapPin },
    { to: '/company/payments', label: 'Payments', icon: CreditCard },
    { to: '/company/reports', label: 'Reports', icon: BarChart3 },
    { to: '/company/support', label: 'Support', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen flex bg-background text-textPrimary">
      {/* Sidebar */}
      <aside className="w-64 border-e border-border bg-surface flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-bold text-primary">{t('common:appName')}</h2>
            <p className="text-xs text-textSecondary mt-1">Company Portal</p>
          </div>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primaryText'
                        : 'text-textSecondary hover:bg-surfaceAlt hover:text-textPrimary'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <div className="mb-3 px-2">
            <p className="text-xs font-semibold text-textPrimary truncate">{user?.name}</p>
            <p className="text-xs text-textSecondary">{user?.phone}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surfaceAlt rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('auth:logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 px-8 border-b border-border bg-surface flex items-center justify-between">
          <div className="text-sm font-medium text-textSecondary">
            {user?.name}
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
