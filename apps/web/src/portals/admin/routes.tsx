import { Route, Routes, Navigate } from 'react-router-dom';
import { AdminLayout } from '../../app/layouts/AdminLayout';
import { AdminDashboardPage } from './features/dashboard/DashboardPage';
import { DriversPage } from './features/drivers/DriversPage';
import { CompaniesPage } from './features/companies/CompaniesPage';
import { CampaignReviewPage } from './features/campaign-review/CampaignReviewPage';
import { PhotoReviewPage } from './features/photo-review/PhotoReviewPage';
import { AdminPaymentsPage } from './features/payments/PaymentsPage';
import { PayoutsPage } from './features/payouts/PayoutsPage';
import { DisputesPage } from './features/disputes/DisputesPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TeamRolesPage } from './features/team-roles/TeamRolesPage';
import { AuditLogPage } from './features/audit-log/AuditLogPage';
import { AdminReportsPage } from './features/reports/ReportsPage';
import { PermissionGuard } from '../../app/guards/PermissionGuard';

export default function AdminPortalRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route
          path="drivers"
          element={
            <PermissionGuard permission="kyc.approve">
              <DriversPage />
            </PermissionGuard>
          }
        />
        <Route
          path="companies"
          element={
            <PermissionGuard permission="kyc.approve">
              <CompaniesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="campaign-review"
          element={
            <PermissionGuard permission="campaign.approve">
              <CampaignReviewPage />
            </PermissionGuard>
          }
        />
        <Route
          path="photo-review"
          element={
            <PermissionGuard permission="photo.approve">
              <PhotoReviewPage />
            </PermissionGuard>
          }
        />
        <Route
          path="payments"
          element={
            <PermissionGuard permission="payout.approve">
              <AdminPaymentsPage />
            </PermissionGuard>
          }
        />
        <Route
          path="payouts"
          element={
            <PermissionGuard permission="payout.approve">
              <PayoutsPage />
            </PermissionGuard>
          }
        />
        <Route
          path="disputes"
          element={
            <PermissionGuard permission="dispute.resolve">
              <DisputesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="reports"
          element={
            <PermissionGuard permission="audit.view">
              <AdminReportsPage />
            </PermissionGuard>
          }
        />
        <Route
          path="audit-log"
          element={
            <PermissionGuard permission="audit.view">
              <AuditLogPage />
            </PermissionGuard>
          }
        />
        <Route
          path="team-roles"
          element={
            <PermissionGuard permission="settings.manage">
              <TeamRolesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="settings"
          element={
            <PermissionGuard permission="settings.manage">
              <SettingsPage />
            </PermissionGuard>
          }
        />
      </Route>
    </Routes>
  );
}
