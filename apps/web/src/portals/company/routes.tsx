import { Route, Routes, Navigate } from 'react-router-dom';
import { CompanyLayout } from '../../app/layouts/CompanyLayout';
import { CompanyDashboardPage } from './features/dashboard/DashboardPage';
import { BusinessProfilePage } from './features/business-profile/BusinessProfilePage';
import { CampaignsPage } from './features/campaigns/CampaignsPage';
import { TrackingPage } from './features/tracking/TrackingPage';
import { CompanyPaymentsPage } from './features/payments/PaymentsPage';
import { CompanyReportsPage } from './features/reports/ReportsPage';
import { CompanySupportPage } from './features/support/SupportPage';

export default function CompanyPortalRoutes() {
  return (
    <Routes>
      <Route element={<CompanyLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CompanyDashboardPage />} />
        <Route path="business-profile" element={<BusinessProfilePage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="payments" element={<CompanyPaymentsPage />} />
        <Route path="reports" element={<CompanyReportsPage />} />
        <Route path="support" element={<CompanySupportPage />} />
      </Route>
    </Routes>
  );
}
