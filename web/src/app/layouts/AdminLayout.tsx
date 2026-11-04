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
  AlertCircle,
  KeyRound,
  ShieldAlert,
  Megaphone,
  Inbox,
  FileCheck,
  HelpCircle,
  Activity,
  Search,
  Keyboard,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { CommandPalette } from '../../portals/admin/components/CommandPalette';
import { KeyboardShortcutsModal } from '../../portals/admin/components/KeyboardShortcutsModal';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { useAuthStore } from '../../shared/store/authStore';
import { useApiClient } from '../../shared/lib/api';
import { hasPermission, type Permission } from '../../shared/permissions';
import { ACCOUNT_STATUS } from '@ap/shared-constants';

export function AdminLayout() {
  const { t } = useTranslation(['common', 'auth', 'status']);
  const { user, clearAuth } = useAuthStore();
  const client = useApiClient();
  const navigate = useNavigate();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await client.logout();
    } catch {
      // ignore
    } finally {
      clearAuth();
      navigate('/admin/login');
    }
  };

  const navItems: {
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    permission?: Permission;
  }[] = [
    { to: '/admin/dashboard', label: t('common:dashboard'), icon: LayoutDashboard },
    { to: '/admin/my-work', label: 'My Work / Queues', icon: Inbox },
    { to: '/admin/drivers', label: 'Drivers', icon: Users, permission: 'kyc.approve' },
    { to: '/admin/companies', label: 'Companies', icon: Building, permission: 'kyc.approve' },
    { to: '/admin/campaign-review', label: 'Campaign Review', icon: CheckSquare, permission: 'campaign.approve' },
    { to: '/admin/photo-review', label: 'Daily Photo Review', icon: Camera, permission: 'photo.approve' },
    { to: '/admin/payments', label: 'Escrow Payments', icon: CreditCard, permission: 'payout.approve' },
    { to: '/admin/payouts', label: 'Driver Payouts', icon: Banknote, permission: 'payout.approve' },
    { to: '/admin/disputes', label: 'Disputes', icon: AlertTriangle, permission: 'dispute.resolve' },
    { to: '/admin/discipline', label: 'Strikes & Bans', icon: ShieldAlert, permission: 'strike.manage' },
    { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, permission: 'announcement.manage' },
    { to: '/admin/legal', label: 'Legal Policies', icon: FileCheck, permission: 'settings.manage' },
    { to: '/admin/help', label: 'Help Articles', icon: HelpCircle, permission: 'settings.manage' },
    { to: '/admin/reports', label: 'Analytics & Reports', icon: BarChart2, permission: 'audit.view' },
    { to: '/admin/audit-log', label: 'Audit Log', icon: FileText, permission: 'audit.view' },
    { to: '/admin/team-roles', label: 'Team Roles', icon: Shield, permission: 'team.manage' },
    { to: '/admin/settings', label: 'System Settings', icon: Settings, permission: 'settings.manage' },
    { to: '/admin/system', label: 'System Health', icon: Activity, permission: 'system.view' },
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
            <p className="text-xs font-semibold text-textPrimary truncate">
              {user?.email || user?.mobile}
            </p>
            <p className="text-xs text-textSecondary capitalize">{user?.status.toLowerCase()}</p>
          </div>
          <button
            onClick={() => navigate('/change-password')}
            className="w-full mb-1 flex items-center gap-2 px-3 py-2 text-sm text-textSecondary hover:bg-surfaceAlt rounded-lg transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password</span>
          </button>
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-surfaceAlt/60 text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt text-xs font-medium transition-colors w-64"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search or jump to...</span>
              <kbd className="ml-auto px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono">
                Ctrl+K
              </kbd>
            </button>
            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="p-1.5 rounded-lg border border-border text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt text-xs"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-textSecondary hidden md:inline">
              {user?.role} &bull; {user?.email}
            </span>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </header>

        {user?.status === ACCOUNT_STATUS.SUSPENDED ? (
          <div className="bg-danger/10 border-b border-danger/20 px-8 py-3 flex items-center gap-3 text-danger">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Your admin account is suspended. Write operations are disabled.
            </p>
          </div>
        ) : null}

        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
