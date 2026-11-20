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
  Rocket,
  Gauge,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { CommandPalette } from '../../portals/admin/components/CommandPalette';
import { KeyboardShortcutsModal } from '../../portals/admin/components/KeyboardShortcutsModal';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { EnvironmentRibbon } from '../../shared/components/EnvironmentRibbon';
import { useAuthStore } from '../../shared/store/authStore';
import { useApiClient } from '../../shared/lib/api';
import { hasPermission, type Permission } from '../../shared/permissions';
import { ACCOUNT_STATUS } from '@ap/shared-constants';

export function AdminLayout() {
  const { t } = useTranslation(['common', 'auth', 'status']);
  const { user, clearAuth } = useAuthStore();
  const permissions = useAuthStore((s) => s.permissions);
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
    { to: '/admin/pilot-command-center', label: 'Pilot Command Center', icon: Gauge, permission: 'system.view' },
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
    { to: '/admin/launch-readiness', label: 'Launch Readiness', icon: Rocket, permission: 'system.view' },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(user?.role, item.permission);
  });

  return (
    <div className="h-screen w-screen flex bg-background text-textPrimary overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-e border-border bg-surface flex flex-col shrink-0 h-full overflow-hidden select-none">
        <div className="p-5 border-b border-border flex items-center gap-3 shrink-0">
          <img
            src="/logo.png"
            alt="Auto Poster"
            className="w-10 h-10 rounded-xl object-cover shadow-sm shrink-0"
          />
          <div>
            <h2 className="text-base font-bold text-primary leading-tight">{t('common:appName')}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-surfaceAlt text-textSecondary font-semibold">
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
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
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border shrink-0">
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
            <KeyRound className="w-4 h-4 shrink-0" />
            <span>Change Password</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surfaceAlt rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{t('auth:logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <EnvironmentRibbon />
        <header className="h-16 px-4 sm:px-8 border-b border-border bg-surface flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-surfaceAlt/60 text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt text-xs font-medium transition-colors w-40 sm:w-64"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="truncate">Search or jump to...</span>
              <kbd className="hidden sm:inline ml-auto px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono">
                Ctrl+K
              </kbd>
            </button>
            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="p-1.5 rounded-lg border border-border text-textSecondary hover:text-textPrimary hover:bg-surfaceAlt text-xs shrink-0"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <span className="text-xs text-textSecondary hidden xl:inline">
              {user?.role} &bull; {user?.email}
            </span>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </header>

        {user?.status === ACCOUNT_STATUS.SUSPENDED ? (
          <div className="bg-danger/10 border-b border-danger/20 px-8 py-3 flex items-center gap-3 text-danger shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Your admin account is suspended. Write operations are disabled.
            </p>
          </div>
        ) : null}

        <main className="flex-1 p-6 sm:p-8 overflow-y-auto min-h-0">
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
