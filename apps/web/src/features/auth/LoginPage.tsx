import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../shared/store/authStore';
import { ROLES, type Role } from '@ap/shared-constants';
import { Card } from '../../shared/components/Card';
import { Button } from '../../shared/components/Button';
import { ShieldAlert, Building2, Shield, UserCheck, DollarSign } from 'lucide-react';

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { loginAs, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDevLogin = (role: Role) => {
    loginAs(role);
    const origin = (location.state as { from?: { pathname: string } })?.from?.pathname;
    if (origin) {
      navigate(origin, { replace: true });
      return;
    }
    if (role === ROLES.COMPANY) {
      navigate('/company/dashboard', { replace: true });
    } else {
      navigate('/admin/dashboard', { replace: true });
    }
  };

  return (
    <div className="w-full max-w-md">
      <Card className="shadow-lg">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-textPrimary">{t('auth:welcomeBack')}</h2>
          <p className="text-sm text-textSecondary mt-1">{t('auth:enterPhone')}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-textSecondary mb-1.5">
              {t('auth:phone')}
            </label>
            <input
              type="tel"
              placeholder="9876543210"
              disabled
              className="w-full px-3.5 py-2 text-sm bg-surfaceAlt border border-border rounded-lg text-textSecondary opacity-75 cursor-not-allowed"
            />
          </div>

          <Button variant="primary" className="w-full" disabled>
            {t('auth:sendOtp')}
          </Button>

          {/* Dev Mode Switcher */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-warning mb-3">
              <ShieldAlert className="w-4 h-4" />
              <span>Phase 1 Dev Simulation</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => handleDevLogin(ROLES.COMPANY)}
              >
                <Building2 className="w-4 h-4 text-primary" />
                <span>{t('auth:devLoginCompany')}</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => handleDevLogin(ROLES.SUPER_ADMIN)}
              >
                <Shield className="w-4 h-4 text-warning" />
                <span>{t('auth:devLoginAdmin')} (Super Admin)</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => handleDevLogin(ROLES.MODERATOR)}
              >
                <UserCheck className="w-4 h-4 text-info" />
                <span>Dev: Login as Moderator</span>
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => handleDevLogin(ROLES.FINANCE)}
              >
                <DollarSign className="w-4 h-4 text-success" />
                <span>Dev: Login as Finance</span>
              </Button>
            </div>
          </div>

          {isAuthenticated && user ? (
            <div className="mt-4 p-3 bg-surfaceAlt rounded-lg text-xs text-textSecondary text-center">
              Active Session: <strong className="text-textPrimary">{user.name}</strong> ({user.role})
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
