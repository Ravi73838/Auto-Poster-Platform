import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Users,
  Building,
  CheckSquare,
  Camera,
  CreditCard,
  Banknote,
  AlertTriangle,
  Settings,
  Shield,
  FileText,
  BarChart2,
  LogOut,
} from 'lucide-react';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { useAuthStore } from '../../shared/store/authStore';
import { hasPermission, type Permission } from '../../shared/permissions';

export function AdminLayout() {
  const { t } = useTranslation(['common', 'auth', 'status']);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems: {
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    permission?: Permission;
  }[] = [
    { to: '/admin/dashboard', label: t('common:dashboard'), icon: LayoutDashboard },
    { to: '/admin/drivers', label: 'Drivers', icon: Users, permission: 'kyc.approve' },
    { to: '/admin/companies', label: 'Companies', icon: Building, permission: 'kyc.approve' },
    { to: '/admin/campaign-review', label: 'Campaign Review', icon: CheckSquare, permission: 'campaign.approve' },
    { to: '/admin/photo-review', label: 'Daily Photo Review', icon: Camera, permission: 'photo.approve' },
    { to: '/admin/payments', label: 'Escrow Payments', icon: CreditCard, permission: 'payout.approve' },
    { to: '/admin/payouts', label: 'Driver Payouts', icon: Banknote, permission: 'payout.approve' },
    { to: '/admin/disputes', label: 'Disputes', icon: AlertTriangle, permission: 'dispute.resolve' },
    { to: '/admin/reports', label: 'Analytics & Reports', icon: BarChart2, permission: 'audit.view' },
    { to: '/admin/audit-log', label: 'Audit Log', icon: FileText, permission: 'audit.view' },
    { to: '/admin/team-roles', label: 'Team Roles', icon: Shield, permission: 'settings.manage' },
    { to: '/admin/settings', label: 'System Settings', icon: Settings, permission: 'settings.manage' },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(user?.role, item.permission);
  });

  return (
    <div className="min-h-screen flex bg-background text-textPrimary">
      {/* Sidebar */}
      <aside className="w-64 border-e border-border bg-surface flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-bold text-primary">{t('common:appName')}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded bg-surfaceAlt text-textSecondary font-semibold">
                {user?.role}
              </span>
            </div>
          </div>
          <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
            {visibleNavItems.map((item) => {
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
            Admin Portal ({user?.role})
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
