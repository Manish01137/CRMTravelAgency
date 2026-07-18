import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { FullPageLoader } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LeadsPage } from '@/pages/LeadsPage';
import { BookingsPage } from '@/pages/BookingsPage';
import { BookingDetailPage } from '@/pages/BookingDetailPage';
import { ItinerariesPage } from '@/pages/ItinerariesPage';
import { ItineraryComposerPage } from '@/pages/ItineraryComposerPage';
import { ItineraryPrintPage } from '@/pages/ItineraryPrintPage';
import { PackagesPage } from '@/pages/PackagesPage';
import { PackageBuilderPage } from '@/pages/PackageBuilderPage';
import { PackageBrochurePage } from '@/pages/PackageBrochurePage';
import { TasksPage } from '@/pages/TasksPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { InvoiceViewPage } from '@/pages/InvoiceViewPage';
import { BillsPage } from '@/pages/BillsPage';
import { HotelsPage } from '@/pages/HotelsPage';
import { SightseeingPage } from '@/pages/SightseeingPage';
import { HostPageAdminPage } from '@/pages/HostPageAdminPage';
import { HostPage } from '@/pages/HostPage';
import { UsersPage } from '@/pages/UsersPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { OrgSettingsPage } from '@/pages/OrgSettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry auth/permission/validation errors.
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

/** Requires a session; otherwise redirects to /login. Wraps everything in the shell. */
function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

/** Requires a session but renders WITHOUT the app shell (print views). */
function ProtectedBareRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Admin-only sub-tree. */
function AdminRoute() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Redirects already-authenticated users away from login/signup. */
function PublicOnlyRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing landing — visible to everyone. */}
      <Route path="/" element={<LandingPage />} />

      {/* Public agency host page (Linktree-style mini site). */}
      <Route path="/a/:slug" element={<HostPage />} />

      {/* Public shareable package brochure — anyone with the link can view/print. */}
      <Route path="/p/:id" element={<PackageBrochurePage />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      {/* Print-friendly views: authenticated but outside the app shell */}
      <Route element={<ProtectedBareRoute />}>
        <Route path="/invoices/:id" element={<InvoiceViewPage />} />
        <Route path="/packages/:id/brochure" element={<PackageBrochurePage />} />
        <Route path="/bookings/:id/itinerary/print" element={<ItineraryPrintPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/itineraries" element={<ItinerariesPage />} />
        <Route path="/bookings/:id/itinerary" element={<ItineraryComposerPage />} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/packages/new" element={<PackageBuilderPage />} />
        <Route path="/packages/:id/edit" element={<PackageBuilderPage />} />
        <Route path="/hotels" element={<HotelsPage />} />
        <Route path="/sightseeing" element={<SightseeingPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/settings/profile" element={<ProfilePage />} />
        <Route element={<AdminRoute />}>
          <Route path="/host-page" element={<HostPageAdminPage />} />
          <Route path="/team" element={<UsersPage />} />
          <Route path="/settings/organization" element={<OrgSettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster richColors position="top-right" closeButton />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
