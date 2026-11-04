import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROLES } from '@ap/shared-constants';
import { PublicLayout } from './layouts/PublicLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { VerifyMobilePage } from '../features/auth/VerifyMobilePage';
import { AdminLoginPage } from '../features/auth/AdminLoginPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';
import { RoleGuard } from './guards/RoleGuard';
import { AuthGuard } from './guards/AuthGuard';
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
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-mobile" element={<VerifyMobilePage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/change-password"
            element={
              <AuthGuard>
                <ChangePasswordPage />
              </AuthGuard>
            }
          />
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
