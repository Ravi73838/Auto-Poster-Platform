import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleGuard } from '../RoleGuard';
import { useAuthStore } from '../../../shared/store/authStore';
import { ROLES, ACCOUNT_STATUS } from '@ap/shared-constants';

describe('RoleGuard', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().setInitialized(true);
  });

  it('redirects unauthenticated user to /login', () => {
    render(
      <MemoryRouter initialEntries={['/company/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/company/dashboard"
            element={
              <RoleGuard allowedRoles={[ROLES.COMPANY]}>
                <div>Company Dashboard</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects company user trying to visit /admin/dashboard to /company/dashboard', () => {
    useAuthStore.getState().setAuth({
      user: {
        id: 'u1',
        role: ROLES.COMPANY,
        status: ACCOUNT_STATUS.APPROVED,
        mobile: '+919876543210',
        email: 'company@test.com',
        preferredLanguage: 'en',
        preferredTheme: 'system',
        twoFactorEnabled: false,
        mustChangePassword: false,
        mobileVerifiedAt: new Date().toISOString(),
        emailVerifiedAt: new Date().toISOString(),
      },
      token: 'mock-jwt-token',
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/company/dashboard" element={<div>Company Dashboard</div>} />
          <Route
            path="/admin/dashboard"
            element={
              <RoleGuard allowedRoles={[ROLES.SUPER_ADMIN]}>
                <div>Admin Dashboard</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Company Dashboard')).toBeInTheDocument();
  });

  it('allows authorized role to access protected route', () => {
    useAuthStore.getState().setAuth({
      user: {
        id: 'u2',
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.APPROVED,
        mobile: '+919876543211',
        email: 'admin@test.com',
        preferredLanguage: 'en',
        preferredTheme: 'system',
        twoFactorEnabled: true,
        mustChangePassword: false,
        mobileVerifiedAt: new Date().toISOString(),
        emailVerifiedAt: new Date().toISOString(),
      },
      token: 'mock-jwt-token',
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <RoleGuard allowedRoles={[ROLES.SUPER_ADMIN]}>
                <div>Admin Dashboard</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });
});
