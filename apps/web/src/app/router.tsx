import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROLES } from '@ap/shared-constants';
import { PublicLayout } from './layouts/PublicLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { RoleGuard } from './guards/RoleGuard';
import { Spinner } from '../shared/components/Spinner';

// Lazy load both portals to generate separate chunks in Vite build
const CompanyPortalRoutes = lazy(() => import('../portals/company/routes'));
const AdminPortalRoutes = lazy(() => import('../portals/admin/routes'));

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Spinner />
        </div>
      }
    >
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Company Portal */}
        <Route
          path="/company/*"
          element={
            <RoleGuard allowedRoles={[ROLES.COMPANY]}>
              <CompanyPortalRoutes />
            </RoleGuard>
          }
        />

        {/* Admin Portal */}
        <Route
          path="/admin/*"
          element={
            <RoleGuard allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MODERATOR, ROLES.FINANCE]}>
              <AdminPortalRoutes />
            </RoleGuard>
          }
        />

        {/* Default fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
