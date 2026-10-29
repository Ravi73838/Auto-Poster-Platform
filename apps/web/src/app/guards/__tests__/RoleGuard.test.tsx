import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleGuard } from '../RoleGuard';
import { useAuthStore } from '../../../shared/store/authStore';
import { ROLES } from '@ap/shared-constants';

describe('RoleGuard', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
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
    useAuthStore.getState().loginAs(ROLES.COMPANY);

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
    useAuthStore.getState().loginAs(ROLES.SUPER_ADMIN);

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
