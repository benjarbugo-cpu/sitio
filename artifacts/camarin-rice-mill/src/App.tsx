import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AccessDeniedPage, BillingPage, DashboardPage, FarmersPage, InventoryPage, LoginPage, MillingPage, NotificationsPage, PaymentsPage, ReportsPage, SettingsPage } from '@/pages/app-pages';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/">{() => <LoginPage />}</Route>
        <Route path="/dashboard">{() => <DashboardPage />}</Route>
        <Route path="/farmers">{() => <FarmersPage />}</Route>
        <Route path="/milling">{() => <MillingPage />}</Route>
        <Route path="/inventory">{() => <InventoryPage />}</Route>
        <Route path="/billing">{() => <BillingPage />}</Route>
        <Route path="/payments">{() => <PaymentsPage />}</Route>
        <Route path="/reports">{() => <ReportsPage />}</Route>
        <Route path="/notifications">{() => <NotificationsPage />}</Route>
        <Route path="/settings">{() => <SettingsPage />}</Route>
        <Route path="/my-dashboard">{() => <DashboardPage portal />}</Route>
        <Route path="/my-transactions">{() => <MillingPage />}</Route>
        <Route path="/my-billing">{() => <BillingPage portal />}</Route>
        <Route path="/my-payments">{() => <PaymentsPage portal />}</Route>
        <Route path="/my-receipts">{() => <PaymentsPage portal />}</Route>
        <Route path="/403">{() => <AccessDeniedPage />}</Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
