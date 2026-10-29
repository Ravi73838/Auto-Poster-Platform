import React from 'react';
import { useAuthStore } from '../../shared/store/authStore';
import { hasPermission, type Permission } from '../../shared/permissions';
import { useTranslation } from 'react-i18next';

interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation('auth');

  if (!hasPermission(user?.role, permission)) {
    return (
      fallback ?? (
        <div className="p-8 text-center text-danger">
          <p className="font-semibold">{t('unauthorized')}</p>
        </div>
      )
    );
  }

  return <>{children}</>;
}
