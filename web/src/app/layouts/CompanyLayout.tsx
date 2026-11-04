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
  AlertTriangle,
  LogOut,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { useAuthStore } from '../../shared/store/authStore';
import { useApiClient } from '../../shared/lib/api';
import { ACCOUNT_STATUS } from '@ap/shared-constants';

export function CompanyLayout() {
  const { t } = useTranslation(['common', 'auth', 'status']);
  const { user, clearAuth } = useAuthStore();
  const client = useApiClient();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await client.logout();
    } catch {
      // ignore
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  const navItems = [
    { to: '/company/dashboard', label: t('common:dashboard'), icon: LayoutDashboard },
    { to: '/company/business-profile', label: 'Business Profile', icon: Building2 },
    { to: '/company/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/company/tracking', label: 'Tracking', icon: MapPin },
    { to: '/company/payments', label: 'Payments', icon: CreditCard },
    { to: '/company/reports', label: 'Reports', icon: BarChart3 },
    { to: '/company/disputes', label: 'Disputes & Claims', icon: AlertTriangle },
    { to: '/company/support', label: 'Support', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen flex bg-background text-textPrimary">
      {/* Sidebar */}
      <aside className="w-64 border-e border-border bg-surface flex flex-col justify-between shrink-0">
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
            <p className="text-xs font-semibold text-textPrimary truncate">
              {user?.email || user?.mobile}
            </p>
            <p className="text-xs text-textSecondary capitalize">{user?.status.toLowerCase()}</p>
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-8 border-b border-border bg-surface flex items-center justify-between shrink-0">
          <div className="text-sm font-medium text-textSecondary truncate">
            {user?.email || user?.mobile}
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </header>

        {/* Account status banners */}
        {user?.status === ACCOUNT_STATUS.PENDING ? (
          <div className="bg-warning/10 border-b border-warning/20 px-8 py-3 flex items-center gap-3 text-warning">
            <Clock className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Your company account is pending review by the admin team. Certain features will be enabled once approved.
            </p>
          </div>
        ) : null}

        {user?.status === ACCOUNT_STATUS.SUSPENDED ? (
          <div className="bg-danger/10 border-b border-danger/20 px-8 py-3 flex items-center gap-3 text-danger">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Your account has been suspended. Modification actions are disabled. Please contact support.
            </p>
          </div>
        ) : null}

        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
