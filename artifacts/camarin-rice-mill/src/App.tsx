import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AccessDeniedPage, DashboardPage, FarmersPage, InventoryPage, LoginPage, MillingPage, NotificationsPage, PaymentsPage, ReportsPage, SettingsPage } from '@/pages/app-pages';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
         <Route path="/" component={LoginPage} />
         <Route path="/dashboard" component={DashboardPage} />
         <Route path="/farmers" component={FarmersPage} />
         <Route path="/milling" component={MillingPage} />
         <Route path="/inventory" component={InventoryPage} />
         <Route path="/payments" component={PaymentsPage} />
         <Route path="/reports" component={ReportsPage} />
         <Route path="/notifications" component={NotificationsPage} />
         <Route path="/settings" component={SettingsPage} />
         <Route path="/my-dashboard"><DashboardPage portal /></Route>
         <Route path="/my-transactions"><MillingPage /></Route>
         <Route path="/my-payments"><PaymentsPage portal /></Route>
         <Route path="/my-receipts"><PaymentsPage portal /></Route>
         <Route path="/403" component={AccessDeniedPage} />
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
