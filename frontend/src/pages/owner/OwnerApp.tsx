import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { PlatformAdminAuthProvider, usePlatformAdminAuth } from '@/context/PlatformAdminAuthContext';
import { FullPageLoader } from '@/components/ui/spinner';
import { OwnerLoginPage } from './OwnerLoginPage';
import { OwnerDashboardPage } from './OwnerDashboardPage';
import { OwnerOrganizationsPage } from './OwnerOrganizationsPage';
import { OwnerOrganizationDetailPage } from './OwnerOrganizationDetailPage';
import { OwnerUsersPage } from './OwnerUsersPage';
import { OwnerLeadsPage } from './OwnerLeadsPage';
import { OwnerBookingsPage } from './OwnerBookingsPage';
import { OwnerSubscriptionsPage } from './OwnerSubscriptionsPage';
import { OwnerRevenuePage } from './OwnerRevenuePage';
import { OwnerExpensesPage } from './OwnerExpensesPage';
import { OwnerProfitPage } from './OwnerProfitPage';
import { OwnerSystemHealthPage } from './OwnerSystemHealthPage';
import { OwnerChannelHealthPage } from './OwnerChannelHealthPage';
import { OwnerAuditLogPage } from './OwnerAuditLogPage';

function OwnerProtectedRoute() {
  const { status } = usePlatformAdminAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'unauthenticated') return <Navigate to="/owner/login" replace />;
  return <Outlet />;
}

function OwnerPublicOnlyRoute() {
  const { status } = usePlatformAdminAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to="/owner" replace />;
  return <Outlet />;
}

/**
 * Self-contained mini-app for the Super Admin panel, mounted at /owner/*.
 * Provides its OWN auth context (PlatformAdminAuthProvider) — deliberately
 * not nested under the tenant app's AuthProvider/ProtectedRoute, so this
 * surface never depends on, or interacts with, a tenant session.
 */
export function OwnerApp() {
  return (
    <PlatformAdminAuthProvider>
      <Routes>
        <Route element={<OwnerPublicOnlyRoute />}>
          <Route path="login" element={<OwnerLoginPage />} />
        </Route>
        <Route element={<OwnerProtectedRoute />}>
          <Route index element={<OwnerDashboardPage />} />
          <Route path="organizations" element={<OwnerOrganizationsPage />} />
          <Route path="organizations/:id" element={<OwnerOrganizationDetailPage />} />
          <Route path="users" element={<OwnerUsersPage />} />
          <Route path="leads" element={<OwnerLeadsPage />} />
          <Route path="bookings" element={<OwnerBookingsPage />} />
          <Route path="subscriptions" element={<OwnerSubscriptionsPage />} />
          <Route path="revenue" element={<OwnerRevenuePage />} />
          <Route path="expenses" element={<OwnerExpensesPage />} />
          <Route path="profit" element={<OwnerProfitPage />} />
          <Route path="system-health" element={<OwnerSystemHealthPage />} />
          <Route path="channel-health" element={<OwnerChannelHealthPage />} />
          <Route path="audit-log" element={<OwnerAuditLogPage />} />
        </Route>
      </Routes>
    </PlatformAdminAuthProvider>
  );
}
