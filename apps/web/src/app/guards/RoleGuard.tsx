import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../shared/store/authStore';
import { ROLES, type Role } from '@ap/shared-constants';

interface RoleGuardProps {
  allowedRoles: Role[];
  children?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect based on user's active role
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
