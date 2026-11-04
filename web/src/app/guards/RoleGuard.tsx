import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../shared/store/authStore';
import { ROLES, type Role } from '@ap/shared-constants';
import { Spinner } from '../../shared/components/Spinner';

interface RoleGuardProps {
  allowedRoles: Role[];
  children?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, isAuthenticated, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const loginTarget = location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
    return <Navigate to={loginTarget} state={{ from: location }} replace />;
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === ROLES.COMPANY) {
      return <Navigate to="/company/dashboard" replace />;
    }
    const adminRoles: Role[] = [ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE];
    if (adminRoles.includes(user.role)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : null;
}
