import { useState, useMemo, useEffect, type FormEvent, type ReactNode } from 'react';
import { useLocation, Link } from 'wouter';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowDownRight, ArrowUpRight, Banknote, Bell, Camera, Check, ChevronDown, CircleAlert,
  ClipboardList, Edit3, Eye, FileDown, FileText, Filter, KeyRound, Layers, Loader2,
  Lock, Mail, MapPin, MoreHorizontal, PackageOpen, Phone, Plus, Printer, RefreshCw,
  Scale, Search, Settings2, ShieldCheck, SlidersHorizontal, Trash2,
  TrendingUp, Truck, Upload, User, UserCheck, UserPlus, UsersRound, Warehouse, Wheat, X
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey, getGetFarmerQueryKey, getGetMillingTransactionQueryKey, getGetReportsSummaryQueryKey,
  getGetDashboardSummaryQueryKey, getListFarmersQueryKey, getListInventoryQueryKey,
  getListMillingTransactionsQueryKey, getListNotificationsQueryKey, getListPaymentsQueryKey,
  useCreateFarmer, useCreateInventoryItem, useCreateMillingTransaction, useCreatePayment, useDeleteFarmer,
  useDemoLogin, useGetCurrentUser, useGetDashboardActivity, useGetDashboardSummary, useGetFarmer,
  useGetMillingTransaction, useGetReportsSummary, useHealthCheck, useListFarmers, useListInventory,
  useListMillingTransactions, useListNotifications, useListPayments, useUpdateFarmer, useUpdateInventoryItem,
  useUpdateMillingTransaction,
  type MillingTransaction, type Role,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppShell, Initials } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';

export const peso = (value = 0) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const date = (value?: string) => value ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
export const titleCase = (value = '') => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

// ==========================================
// Reusable UI Components
// ==========================================

function LoadingState({ label = 'Loading records' }: { label?: string }) {
  return (
    <div className="space-y-3" data-testid="state-loading">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/40" />
      ))}
      <div className="flex items-center gap-2 pt-2 font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">
        <Loader2 size={13} className="animate-spin text-primary" />
        {label}
      </div>
    </div>
  );
}

function ErrorState({ message = 'The records could not be loaded.', retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--chart-4)/.45)] bg-[hsl(var(--chart-4)/.05)] p-6 text-center" data-testid="state-error">
      <CircleAlert className="mb-3 text-[hsl(var(--chart-4))]" size={23} />
      <p className="text-sm font-bold">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">Check the mill connection, then try again.</p>
      {retry && (
        <Button onClick={retry} variant="outline" size="sm" className="mt-4" data-testid="button-retry">
          <RefreshCw size={14} /> Retry
        </Button>
      )}
    </div>
  );
}

function EmptyState({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center" data-testid="state-empty">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary">
        <PackageOpen size={20} />
      </span>
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">There is nothing here yet. New records will appear as they are added.</p>
      {action && onAction && (
        <Button size="sm" className="mt-4" onClick={onAction} data-testid="button-empty-action">
          <Plus size={14} /> {action}
        </Button>
      )}
    </div>
  );
}

function StatusPill({ value, tone }: { value: string; tone?: 'green' | 'gold' | 'red' | 'blue' }) {
  const color = tone ?? (
    value.includes('LOW') || value.includes('PENDING') || value.includes('WEIGHING') ? 'gold' :
    value.includes('OUT') || value.includes('CANCEL') || value.includes('INACTIVE') ? 'red' :
    value.includes('COMPLETED') || value.includes('HEALTHY') || value.includes('ACTIVE') || value.includes('READY') ? 'green' : 'blue'
  );
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono-app text-[9px] font-medium uppercase tracking-[.1em] ${
      color === 'green' ? 'bg-[hsl(var(--chart-1)/.15)] text-[hsl(var(--chart-1))] border border-[hsl(var(--chart-1)/.3)]' :
      color === 'gold' ? 'bg-[hsl(var(--accent)/.2)] text-[hsl(var(--primary))] border border-[hsl(var(--accent)/.3)]' :
      color === 'red' ? 'bg-[hsl(var(--chart-4)/.15)] text-[hsl(var(--chart-4))] border border-[hsl(var(--chart-4)/.3)]' :
      'bg-[hsl(var(--chart-5)/.15)] text-[hsl(var(--chart-5))] border border-[hsl(var(--chart-5)/.3)]'
    }`} data-testid={`status-${value.toLowerCase()}`}>
      {titleCase(value)}
    </span>
  );
}

function PageIntro({ eyebrow, title, description, action, onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end page-enter">
      <div>
        <div className="mb-2 flex items-center gap-2 font-mono-app text-[10px] uppercase tracking-[.2em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />{eyebrow}
        </div>
        <h2 className="font-display text-4xl leading-none tracking-[-.04em] text-primary md:text-[46px]">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action && onAction && (
        <Button onClick={onAction} className="self-start md:self-end shadow-md font-bold" data-testid="button-page-action">
          <Plus size={16} /> {action}
        </Button>
      )}
    </div>
  );
}

function StatCard({ label, value, meta, icon: Icon, accent = 'primary', delay = '' }: { label: string; value: string; meta: string; icon: typeof Wheat; accent?: string; delay?: string }) {
  return (
    <div className={`page-enter ${delay} group rounded-2xl border border-border bg-card p-5 shadow-lg transition-all hover:-translate-y-1 hover:border-primary/40`} data-testid={`card-stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className="mb-7 flex items-start justify-between">
        <span className="font-mono-app text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${accent === 'gold' ? 'bg-accent/30 text-primary' : accent === 'red' ? 'bg-[hsl(var(--chart-4)/.18)] text-[hsl(var(--chart-4))]' : 'bg-primary/20 text-primary'}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className="text-3xl font-extrabold tracking-[-.05em] text-primary">{value}</div>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        {meta.startsWith('+') ? <ArrowUpRight size={13} className="text-[hsl(var(--chart-1))]" /> : null}
        {meta}
      </div>
    </div>
  );
}

function Toolbar({ search, setSearch, placeholder = 'Search records' }: { search: string; setSearch: (value: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={placeholder}
          className="h-11 border-border bg-background pl-10"
          data-testid="input-search"
        />
      </div>
    </div>
  );
}

function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function TableEmpty({ colSpan = 5 }: { colSpan?: number }) {
  return (
    <tbody>
      <tr>
        <td colSpan={colSpan}>
          <EmptyState label="No records match this view" />
        </td>
      </tr>
    </tbody>
  );
}

function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 size={18} /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 1. Login Page
// ==========================================

export function LoginPage() {
  const [, setLocation] = useLocation();
  // Two portals: 'ops' for Admin/Staff, 'member' for Farmer/Buyer
  const [portal, setPortal] = useState<'ops' | 'member'>('ops');
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regForm, setRegForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'FARMER' as 'FARMER' | 'CUSTOMER',
    contactNumber: '',
    address: 'Sitio Camarin, Kaagwasan, Dimataling',
    farmArea: '2.0',
    riceVariety: 'Dinorado',
  });
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const health = useHealthCheck({ query: { retry: false } as any });
  const login = useDemoLogin();
  const { toast } = useToast();

  const isOps = portal === 'ops';

  const switchPortal = (p: 'ops' | 'member') => {
    setPortal(p);
    setTab('signin');
    setEmail('');
    setPassword('');
    setError(null);
  };

  const submitSignIn = (event: FormEvent) => {
    event.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setError(null);
    login.mutate(
      { data: { email, password: password || 'password' } },
      {
        onSuccess: (user) => {
          // Route based on role — always use role from server regardless of selected portal
          if (user.role === 'ADMIN' || user.role === 'STAFF') {
            setLocation('/dashboard');
          } else {
            setLocation('/my-dashboard');
          }
        },
        onError: (err: any) => {
          setError(err?.message || 'Authentication failed. Please check your credentials.');
        },
      }
    );
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!regForm.fullName || !regForm.email) {
      setError('Please fill in your full name and email address');
      return;
    }
    setError(null);
    setIsRegistering(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create member account');
      toast({ title: 'Account Created!', description: `Welcome ${data.name}! You are registered as ${data.role}.` });
      setLocation('/my-dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="grain flex min-h-[100dvh] bg-background text-foreground">
      {/* Left branding panel */}
      <div className="hidden w-[42%] flex-col justify-between border-r border-sidebar-border bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-sidebar-primary text-sidebar-primary-foreground shadow-lg">
              <Wheat size={24} />
            </span>
            <div>
              <div className="font-extrabold tracking-[-.04em] text-foreground text-lg">Sitio Camarin</div>
              <div className="font-mono-app text-[9px] uppercase tracking-[.22em] text-muted-foreground">Rice Mill Management</div>
            </div>
          </div>
          <div className="mt-16 max-w-md">
            <div className="font-mono-app text-[10px] uppercase tracking-[.24em] text-accent">Dimataling, Zamboanga del Sur</div>
            <h1 className="mt-5 font-display text-5xl leading-[.95] tracking-[-.05em] text-foreground">
              Smart milling.<br /><em className="text-accent">One platform.</em>
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
              A complete operations system for Sitio Camarin Rice Mill — managing palay batches, billing, inventory, and member records.
            </p>
          </div>
          {/* Portal descriptions on left panel */}
          <div className="mt-10 space-y-3">
            <div className={`rounded-xl border p-4 transition-all ${isOps ? 'border-primary/40 bg-primary/10' : 'border-border bg-card/30'}`}>
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className={isOps ? 'text-primary' : 'text-muted-foreground'} />
                <span className="text-xs font-bold">Operations Portal</span>
                {isOps && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">ACTIVE</span>}
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">For Mill Administrators & Staff managing day-to-day operations.</p>
            </div>
            <div className={`rounded-xl border p-4 transition-all ${!isOps ? 'border-accent/40 bg-accent/10' : 'border-border bg-card/30'}`}>
              <div className="flex items-center gap-2.5">
                <Wheat size={16} className={!isOps ? 'text-primary' : 'text-muted-foreground'} />
                <span className="text-xs font-bold">Member Portal</span>
                {!isOps && <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">ACTIVE</span>}
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">For Farmers and Buyers to view their transactions, billing, and receipts.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono-app text-[10px] uppercase tracking-[.16em] text-muted-foreground">
          <span className={`h-2.5 w-2.5 rounded-full ${health.isError ? 'bg-[hsl(var(--chart-4))]' : 'bg-[hsl(var(--chart-1))] animate-pulse'}`} />
          {health.isError ? 'Mill system offline' : 'Mill system operational'}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[440px] page-enter">
          <div className="mb-6 lg:hidden flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Wheat size={20} />
            </span>
            <div>
              <span className="font-display text-2xl font-bold text-foreground">Sitio Camarin</span>
              <span className="block font-mono-app text-[9px] uppercase tracking-[.2em] text-muted-foreground">Rice Mill</span>
            </div>
          </div>

          {/* Portal Switcher */}
          <div className="mb-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchPortal('ops')}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3.5 text-center transition-all ${isOps ? 'border-primary/60 bg-primary/10 text-primary shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'}`}
              data-testid="button-portal-ops"
            >
              <ShieldCheck size={20} />
              <span className="text-[11px] font-bold leading-tight">Operations<br />Portal</span>
              <span className="text-[9px] font-mono-app uppercase tracking-wider opacity-70">Admin / Staff</span>
            </button>
            <button
              type="button"
              onClick={() => switchPortal('member')}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3.5 text-center transition-all ${!isOps ? 'border-primary/60 bg-primary/10 text-primary shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'}`}
              data-testid="button-portal-member"
            >
              <Wheat size={20} />
              <span className="text-[11px] font-bold leading-tight">Member<br />Portal</span>
              <span className="text-[9px] font-mono-app uppercase tracking-wider opacity-70">Farmer / Buyer</span>
            </button>
          </div>

          {/* Tab switcher — only show Register tab for member portal */}
          {!isOps && (
            <div className="mb-5 flex rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => { setTab('signin'); setError(null); }}
                className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${tab === 'signin' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Lock size={14} /> Sign In
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setError(null); }}
                className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${tab === 'register' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <UserPlus size={14} /> Create Account
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="mb-5">
            <div className="mb-1 font-mono-app text-[10px] uppercase tracking-[.2em] text-accent">
              {isOps ? 'Operations Workspace' : tab === 'register' ? 'New Member Registration' : 'Member Account'}
            </div>
            <h2 className="font-display text-3xl font-bold tracking-[-.04em] text-foreground">
              {isOps ? 'Sign In to Mill Desk' : tab === 'register' ? 'Create Your Account' : 'Welcome Back'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {isOps
                ? 'Enter your admin or staff credentials to access the operations dashboard.'
                : tab === 'register'
                ? 'Register as a Farmer or Buyer to access your personal portal.'
                : 'Sign in to view your milling transactions, billing, and receipts.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-[hsl(var(--chart-4)/.4)] bg-[hsl(var(--chart-4)/.12)] p-4 text-xs font-semibold text-[hsl(var(--chart-4))] flex items-center gap-2">
              <CircleAlert size={16} />
              {error}
            </div>
          )}

          {/* Sign In Form (both portals) */}
          {(isOps || tab === 'signin') && (
            <form onSubmit={submitSignIn} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-foreground">Email Address</span>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={isOps ? 'admin@camarinricemill.local' : 'juan@camarin.ph'}
                    className="h-12 bg-card pl-10 border-border"
                    data-testid="input-email"
                    autoComplete="email"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-foreground">Password</span>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="h-12 bg-card pl-10 border-border"
                    data-testid="input-password"
                    autoComplete="current-password"
                  />
                </div>
              </label>
              <Button type="submit" disabled={login.isPending} className="h-12 w-full text-sm font-bold shadow-md" data-testid="button-sign-in">
                {login.isPending ? <Loader2 className="animate-spin" size={17} /> : <ArrowUpRight size={17} />}
                {isOps ? ' Sign In to Operations' : ' Sign In to My Portal'}
              </Button>
              {isOps && (
                <p className="text-center text-[11px] text-muted-foreground">
                  Are you a farmer or buyer?{' '}
                  <button type="button" onClick={() => switchPortal('member')} className="font-bold text-primary hover:underline">Go to Member Portal →</button>
                </p>
              )}
            </form>
          )}

          {/* Register Form (member portal only) */}
          {!isOps && tab === 'register' && (
            <form onSubmit={submitRegister} className="space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-foreground">Full Name (Pangalan)</span>
                <Input
                  required
                  value={regForm.fullName}
                  onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                  placeholder="e.g. Juan Dela Cruz"
                  className="h-11 bg-card border-border"
                />
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-foreground">Email Address</span>
                  <Input
                    required
                    type="email"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    placeholder="juan@camarin.ph"
                    className="h-11 bg-card border-border"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-foreground">Contact (Cellphone)</span>
                  <Input
                    value={regForm.contactNumber}
                    onChange={(e) => setRegForm({ ...regForm, contactNumber: e.target.value })}
                    placeholder="09171234567"
                    className="h-11 bg-card border-border"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-foreground">Member Account Type</span>
                <Select value={regForm.role} onValueChange={(val: any) => setRegForm({ ...regForm, role: val })}>
                  <SelectTrigger className="h-11 bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FARMER">🌾 Farmer / Palay Producer</SelectItem>
                    <SelectItem value="CUSTOMER">🛒 Buyer / Rice Customer</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              {regForm.role === 'FARMER' && (
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-secondary/40 border border-border">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-foreground">Farm Area (Hectares)</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={regForm.farmArea}
                      onChange={(e) => setRegForm({ ...regForm, farmArea: e.target.value })}
                      className="h-9 bg-card border-border text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-foreground">Rice Variety</span>
                    <Input
                      value={regForm.riceVariety}
                      onChange={(e) => setRegForm({ ...regForm, riceVariety: e.target.value })}
                      placeholder="Dinorado, Jasmine..."
                      className="h-9 bg-card border-border text-xs"
                    />
                  </label>
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-foreground">Location / Barangay</span>
                <Input
                  value={regForm.address}
                  onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                  placeholder="Sitio Camarin, Kaagwasan, Dimataling"
                  className="h-11 bg-card border-border"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-foreground">Account Password</span>
                <Input
                  required
                  type="password"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="h-11 bg-card border-border"
                />
              </label>

              <Button type="submit" disabled={isRegistering} className="h-12 w-full text-sm font-bold shadow-md">
                {isRegistering ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />} Create Account & Sign In
              </Button>
            </form>
          )}

          <p className="mt-8 text-center font-mono-app text-[9px] uppercase tracking-[.18em] text-muted-foreground">
            Sitio Camarin Rice Mill Management · Dimataling, Zamboanga del Sur
          </p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. Dashboard Overview Page
// ==========================================

export function DashboardPage({ portal = false }: { portal?: boolean }) {
  const summary = useGetDashboardSummary({ period: 'month' }, { query: { retry: false } as any });
  const activity = useGetDashboardActivity({ query: { retry: false } as any });
  const current = useGetCurrentUser({ query: { retry: false } as any });
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const dynamicSummary = useGetDashboardSummary({ period }, { query: { retry: false, queryKey: getGetDashboardSummaryQueryKey({ period }) } as any });
  const data = dynamicSummary.data ?? summary.data;
  const kpis = (data?.kpis ?? {}) as any;
  const activities = activity.data ?? [];
  const role = current.data?.role as string | undefined;
  const isPortal = portal || role === 'FARMER' || role === 'CUSTOMER';
  const isFarmer = role === 'FARMER';

  return (
    <AppShell portal={isPortal}>
      <PageIntro
        eyebrow={isPortal ? (isFarmer ? 'Farmer account' : 'Buyer account') : 'Today at the mill'}
        title={isPortal ? (isFarmer ? 'Your harvest, in view.' : 'Your purchases, tracked.') : 'Keep the floor moving.'}
        description={
          isPortal
            ? isFarmer
              ? `Welcome back${current.data?.name ? `, ${current.data.name.split(' ')[0]}` : ''}. Track your palay submissions, milling status, balances, and receipts.`
              : `Welcome back${current.data?.name ? `, ${current.data.name.split(' ')[0]}` : ''}. View your rice purchases, billing statements, and payment history.`
            : `Good day${current.data?.name ? `, ${current.data.name.split(' ')[0]}` : ''}. Here is the shape of the operation for this period.`
        }
        action={!isPortal ? 'Receive palay' : undefined}
        onAction={!isPortal ? () => window.location.assign('/milling') : undefined}
      />
      <div className="mb-5 flex justify-end">
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(['today', 'week', 'month', 'year'] as const).map((item) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`rounded-lg px-3 py-2 font-mono-app text-[10px] uppercase tracking-wider transition ${period === item ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-primary'}`}
              data-testid={`button-period-${item}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {summary.isLoading || dynamicSummary.isLoading ? (
        <LoadingState label="Reading the mill ledger" />
      ) : summary.isError && !data ? (
        <ErrorState retry={() => summary.refetch()} />
      ) : isPortal ? (
        /* ====== FARMER / BUYER PORTAL DASHBOARD ====== */
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isFarmer ? (
              <>
                <StatCard label="Palay submitted" value={`${(kpis.riceReceivedToday ?? kpis.riceSubmitted ?? 0).toLocaleString()} kg`} meta="total this period" icon={Wheat} accent="gold" delay="stagger-1" />
                <StatCard label="My batches" value={`${kpis.completedMilling ?? kpis.processing ?? 0}`} meta="in milling pipeline" icon={ClipboardList} accent="primary" delay="stagger-2" />
                <StatCard label="My balance" value={peso(kpis.outstandingBalances ?? kpis.outstandingBalance ?? 0)} meta="total outstanding" icon={Banknote} accent="red" delay="stagger-3" />
                <StatCard label="Total paid" value={peso(kpis.totalRevenue ?? kpis.totalPaid ?? 0)} meta="lifetime payments" icon={TrendingUp} accent="primary" delay="stagger-4" />
              </>
            ) : (
              <>
                <StatCard label="Rice purchased" value={`${(kpis.riceReceivedToday ?? kpis.riceSubmitted ?? 0).toLocaleString()} kg`} meta="total this period" icon={Wheat} accent="gold" delay="stagger-1" />
                <StatCard label="My orders" value={`${kpis.completedMilling ?? kpis.processing ?? 0}`} meta="transactions" icon={ClipboardList} accent="primary" delay="stagger-2" />
                <StatCard label="My balance" value={peso(kpis.outstandingBalances ?? kpis.outstandingBalance ?? 0)} meta="total outstanding" icon={Banknote} accent="red" delay="stagger-3" />
                <StatCard label="Total paid" value={peso(kpis.totalRevenue ?? kpis.totalPaid ?? 0)} meta="lifetime payments" icon={TrendingUp} accent="primary" delay="stagger-4" />
              </>
            )}
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
            {/* Quick Links */}
            <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-lg">
              <div className="mb-5">
                <div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">Quick access</div>
                <h3 className="mt-1 text-lg font-extrabold tracking-[-.03em]">My account</h3>
              </div>
              <div className="space-y-2">
                <Link href="/my-transactions" className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4 transition hover:bg-secondary/60 hover:border-primary/30">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Wheat size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{isFarmer ? 'My milling transactions' : 'My purchase history'}</p>
                    <p className="text-[11px] text-muted-foreground">{isFarmer ? 'View all palay batches you have submitted' : 'View all rice purchases and orders'}</p>
                  </div>
                  <ArrowUpRight size={14} className="text-muted-foreground" />
                </Link>
                <Link href="/my-billing" className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4 transition hover:bg-secondary/60 hover:border-primary/30">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/20 text-primary"><FileText size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">My billing statements</p>
                    <p className="text-[11px] text-muted-foreground">View and download your billing invoices</p>
                  </div>
                  <ArrowUpRight size={14} className="text-muted-foreground" />
                </Link>
                <Link href="/my-receipts" className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4 transition hover:bg-secondary/60 hover:border-primary/30">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--chart-1)/.15)] text-[hsl(var(--chart-1))]"><Banknote size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">My payment receipts</p>
                    <p className="text-[11px] text-muted-foreground">Cash receipts and payment confirmations</p>
                  </div>
                  <ArrowUpRight size={14} className="text-muted-foreground" />
                </Link>
              </div>
            </section>
            {/* Recent activity */}
            <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-lg">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">Notifications</div>
                  <h3 className="mt-1 text-lg font-extrabold tracking-[-.03em]">Recent updates</h3>
                </div>
                <Link href="/notifications" className="text-xs font-bold text-accent hover:underline" data-testid="link-view-activity">
                  View all
                </Link>
              </div>
              <div className="space-y-4">
                {activities.length === 0 ? (
                  <EmptyState label="No activity yet" />
                ) : (
                  activities.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex gap-3" data-testid={`activity-${item.id}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.tone === 'warning' ? 'bg-accent' : item.tone === 'success' ? 'bg-[hsl(var(--chart-1))]' : item.tone === 'info' ? 'bg-[hsl(var(--chart-5))]' : 'bg-muted-foreground'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{item.description}</p>
                        <p className="mt-1 font-mono-app text-[9px] uppercase text-muted-foreground/70">{date(item.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        /* ====== ADMIN / STAFF OPERATIONS DASHBOARD ====== */
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Received this month" value={`${(kpis.riceReceivedToday ?? kpis.riceSubmitted ?? 0).toLocaleString()} kg`} meta="+8.4% vs last month" icon={Wheat} accent="gold" delay="stagger-1" />
            <StatCard label="In milling" value={`${kpis.completedMilling ?? kpis.processing ?? 0}`} meta="batches active" icon={ClipboardList} accent="primary" delay="stagger-2" />
            <StatCard label="Outstanding" value={peso(kpis.outstandingBalances ?? kpis.outstandingBalance ?? 0)} meta="across active accounts" icon={Banknote} accent="red" delay="stagger-3" />
            <StatCard label="Net revenue" value={peso(kpis.totalRevenue ?? kpis.totalPaid ?? 0)} meta="+12.1% vs last month" icon={TrendingUp} accent="primary" delay="stagger-4" />
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-lg">
              <div className="mb-7 flex items-start justify-between">
                <div>
                  <div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">Throughput</div>
                  <h3 className="mt-1 text-lg font-extrabold tracking-[-.03em]">Milling volume</h3>
                </div>
                <div className="rounded-lg bg-secondary px-2 py-1 font-mono-app text-[10px] text-muted-foreground">kg / day</div>
              </div>
              <div className="flex h-48 items-end gap-2 border-b border-border/70 pb-0 sm:gap-4">
                {(data?.millingVolume ?? []).length > 0 ? (
                  data?.millingVolume.map((item) => {
                    const max = Math.max(...(data?.millingVolume ?? []).map((point) => point.volume), 1);
                    return (
                      <div key={item.label} className="group flex flex-1 flex-col items-center gap-2">
                        <div className="relative w-full">
                          <div
                            className="mx-auto w-full max-w-11 rounded-t-lg bg-[hsl(var(--accent))] transition-all group-hover:bg-primary"
                            style={{ height: `${Math.max(10, (item.volume / max) * 155)}px` }}
                            title={`${item.volume} kg`}
                          />
                        </div>
                        <span className="font-mono-app text-[9px] text-muted-foreground">{item.label}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex w-full items-center justify-center text-xs text-muted-foreground">No volume recorded for this period</div>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-lg">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">Pulse</div>
                  <h3 className="mt-1 text-lg font-extrabold tracking-[-.03em]">Recent activity</h3>
                </div>
                <Link href="/notifications" className="text-xs font-bold text-accent hover:underline" data-testid="link-view-activity">
                  View all
                </Link>
              </div>
              <div className="space-y-4">
                {activities.length === 0 ? (
                  <EmptyState label="No activity yet" />
                ) : (
                  activities.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex gap-3" data-testid={`activity-${item.id}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.tone === 'warning' ? 'bg-accent' : item.tone === 'success' ? 'bg-[hsl(var(--chart-1))]' : item.tone === 'info' ? 'bg-[hsl(var(--chart-5))]' : 'bg-muted-foreground'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">{item.title}</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{item.description}</p>
                        <p className="mt-1 font-mono-app text-[9px] uppercase text-muted-foreground/70">{date(item.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}

// ==========================================
// 3. Farmers & Customers CRUD Page
// ==========================================

export function FarmersPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FARMER' | 'CUSTOMER'>('ALL');
  const [dialog, setDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<any | null>(null);
  const [viewProfileDialog, setViewProfileDialog] = useState(false);
  const [form, setForm] = useState({
    fullName: '', contactNumber: '', barangay: 'Kaagwasan', sitio: 'Sitio Camarin',
    customerType: 'FARMER', riceVariety: 'Dinorado', farmArea: ''
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const list = useListFarmers({ search: search || undefined, page: 1, pageSize: 100 }, { query: { placeholderData: (prev: any) => prev } as any });
  const create = useCreateFarmer();
  const update = useUpdateFarmer();
  const remove = useDeleteFarmer();

  const allItems = list.data?.items ?? [];
  const items = useMemo(() => {
    if (typeFilter === 'ALL') return allItems;
    return allItems.filter((farmer) => farmer.customerType === typeFilter);
  }, [allItems, typeFilter]);

  const openCreate = () => {
    setSelectedFarmer(null);
    setForm({ fullName: '', contactNumber: '', barangay: 'Kaagwasan', sitio: 'Sitio Camarin', customerType: 'FARMER', riceVariety: 'Dinorado', farmArea: '1.5' });
    setDialog(true);
  };

  const openEdit = (farmer: any) => {
    setSelectedFarmer(farmer);
    setForm({
      fullName: farmer.fullName,
      contactNumber: farmer.contactNumber ?? '',
      barangay: farmer.barangay ?? 'Kaagwasan',
      sitio: farmer.sitio ?? 'Sitio Camarin',
      customerType: farmer.customerType ?? 'FARMER',
      riceVariety: farmer.riceVariety ?? 'Dinorado',
      farmArea: String(farmer.farmArea ?? '0')
    });
    setDialog(true);
  };

  const openViewProfile = (farmer: any) => {
    setSelectedFarmer(farmer);
    setViewProfileDialog(true);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      farmArea: Number(form.farmArea || 0),
      customerType: form.customerType as 'FARMER' | 'CUSTOMER',
    };

    if (selectedFarmer) {
      update.mutate(
        { id: selectedFarmer.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListFarmersQueryKey() });
            setDialog(false);
            toast({ title: 'Record Updated', description: `${form.fullName} has been successfully updated.` });
          },
        }
      );
    } else {
      create.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListFarmersQueryKey() });
            setDialog(false);
            toast({ title: 'Record Added', description: `${form.fullName} has been added to the registry.` });
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!selectedFarmer) return;
    remove.mutate(
      { id: selectedFarmer.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFarmersQueryKey() });
          setDeleteDialog(false);
          toast({ title: 'Record Removed', description: `${selectedFarmer.fullName} has been removed.` });
        },
      }
    );
  };

  return (
    <AppShell>
      <PageIntro
        eyebrow="Registry & Accounts"
        title="Farmers & Customers"
        description="Complete CRUD management for agricultural producers and customer accounts at Sitio Camarin."
        action="Add Person"
        onAction={openCreate}
      />

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Toolbar search={search} setSearch={setSearch} placeholder="Search name, code, barangay..." />
        <div className="flex rounded-xl border border-border bg-secondary/50 p-1">
          {(['ALL', 'FARMER', 'CUSTOMER'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`rounded-lg px-3 py-1.5 font-mono-app text-[10px] uppercase tracking-wider transition ${
                typeFilter === type ? 'bg-primary text-primary-foreground font-bold shadow' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {type === 'ALL' ? 'All People' : `${typeCase(type)}s`}
            </button>
          ))}
        </div>
      </div>

      {list.isLoading ? (
        <LoadingState label="Loading registry" />
      ) : list.isError ? (
        <ErrorState retry={() => list.refetch()} />
      ) : (
        <TableFrame>
          <table className="w-full min-w-[840px] text-left">
            <thead className="border-b border-border bg-secondary/45">
              <tr>
                {['Person / Account', 'Location', 'Type', 'Variety / Land', 'Milling Batches', 'Balance', 'Actions'].map((head) => (
                  <th key={head} className="px-5 py-4 font-mono-app text-[9px] uppercase tracking-[.16em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            {items.length === 0 ? (
              <TableEmpty colSpan={7} />
            ) : (
              <tbody className="divide-y divide-border/70">
                {items.map((farmer) => (
                  <tr key={farmer.id} className="group transition hover:bg-secondary/25" data-testid={`row-farmer-${farmer.id}`}>
                    <td className="px-5 py-4">
                      <button className="flex items-center gap-3 text-left group-hover:text-primary transition" onClick={() => openViewProfile(farmer)}>
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/30 text-xs font-extrabold text-primary shadow-sm">
                          {farmer.fullName.split(' ').map((part: string) => part[0]).join('').slice(0, 2)}
                        </span>
                        <div>
                          <span className="block text-sm font-bold">{farmer.fullName}</span>
                          <span className="font-mono-app text-[10px] text-muted-foreground">{farmer.farmerCode} · {farmer.customerNumber}</span>
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{farmer.barangay}</span>
                      <br />
                      <span className="text-[11px]">{farmer.sitio}</span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill value={farmer.customerType} tone="blue" />
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <span className="font-bold text-foreground">{farmer.riceVariety ?? '—'}</span>
                      <br />
                      <span className="text-muted-foreground font-mono-app text-[10px]">{farmer.farmArea ? `${farmer.farmArea} ha` : '—'}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold">
                      {farmer.transactionCount ?? 0}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">batches</span>
                    </td>
                    <td className="px-5 py-4 font-mono-app text-xs font-bold text-primary">
                      {peso(farmer.balance)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs font-bold text-primary hover:bg-primary/10"
                          onClick={() => openEdit(farmer)}
                          title="Edit Farmer"
                        >
                          <Edit3 size={14} className="mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                          onClick={() => { setSelectedFarmer(farmer); setDeleteDialog(true); }}
                          title="Delete Farmer"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </TableFrame>
      )}

      {/* CREATE / EDIT FARMER DIALOG */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedFarmer ? 'Edit Person Record' : 'Register New Person'}</DialogTitle>
            <DialogDescription>
              {selectedFarmer ? 'Update contact, variety, and land profile.' : 'Add a new farmer or customer to the Sitio Camarin Registry.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2 mt-2">
            <label className="sm:col-span-2">
              <span className="field-label font-bold text-xs">Full Name *</span>
              <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Juan Dela Cruz" />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Contact Number *</span>
              <Input required value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} placeholder="0917XXXXXXX" />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Account Type *</span>
              <select
                value={form.customerType}
                onChange={(e) => setForm({ ...form, customerType: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="FARMER">Farmer (Producer)</option>
                <option value="CUSTOMER">Customer (Buyer)</option>
              </select>
            </label>
            <label>
              <span className="field-label font-bold text-xs">Barangay</span>
              <Input value={form.barangay} onChange={(e) => setForm({ ...form, barangay: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Sitio</span>
              <Input value={form.sitio} onChange={(e) => setForm({ ...form, sitio: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Primary Rice Variety</span>
              <Input value={form.riceVariety} onChange={(e) => setForm({ ...form, riceVariety: e.target.value })} placeholder="e.g. Dinorado, Jasmine" />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Farm Area (Hectares)</span>
              <Input type="number" min="0" step=".01" value={form.farmArea} onChange={(e) => setForm({ ...form, farmArea: e.target.value })} placeholder="e.g. 2.5" />
            </label>
            <DialogFooter className="sm:col-span-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending} className="font-bold">
                {create.isPending || update.isPending ? <Loader2 className="animate-spin mr-1" size={15} /> : <Check className="mr-1" size={15} />}
                {selectedFarmer ? 'Save Changes' : 'Create Person'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW PROFILE MODAL */}
      {selectedFarmer && (
        <Dialog open={viewProfileDialog} onOpenChange={setViewProfileDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/30 text-xs font-bold text-primary">
                  {selectedFarmer.fullName.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}
                </span>
                {selectedFarmer.fullName}
              </DialogTitle>
              <DialogDescription>{selectedFarmer.farmerCode} · Registered {date(selectedFarmer.registrationDate)}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
              <div className="rounded-xl bg-secondary/50 p-3">
                <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Phone</span>
                <b>{selectedFarmer.contactNumber || '—'}</b>
              </div>
              <div className="rounded-xl bg-secondary/50 p-3">
                <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Account Type</span>
                <b>{selectedFarmer.customerType}</b>
              </div>
              <div className="rounded-xl bg-secondary/50 p-3">
                <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Location</span>
                <b>{selectedFarmer.sitio}, {selectedFarmer.barangay}</b>
              </div>
              <div className="rounded-xl bg-secondary/50 p-3">
                <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Rice Variety / Area</span>
                <b>{selectedFarmer.riceVariety} ({selectedFarmer.farmArea} ha)</b>
              </div>
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 sm:col-span-2 flex justify-between items-center">
                <div>
                  <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Active Balance</span>
                  <span className="text-xl font-extrabold text-primary">{peso(selectedFarmer.balance)}</span>
                </div>
                <Button size="sm" onClick={() => { setViewProfileDialog(false); openEdit(selectedFarmer); }}>
                  <Edit3 size={14} className="mr-1" /> Edit Profile
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDeleteDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title="Delete Person Record"
        description={`Are you sure you want to remove ${selectedFarmer?.fullName} (${selectedFarmer?.farmerCode}) from the registry?`}
        onConfirm={handleDelete}
        isPending={remove.isPending}
      />
    </AppShell>
  );
}

function typeCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ==========================================
// 4. Milling Pipeline CRUD Page
// ==========================================

export function MillingPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dialog, setDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [detailModal, setDetailModal] = useState(false);

  const [form, setForm] = useState({
    farmerId: '', riceVariety: 'Dinorado', riceType: 'Palay',
    quantityReceived: '500', millingType: 'Regular Milling', millingRate: '4.5',
    remarks: '', operator: 'Ramil Dela Cruz'
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const list = useListMillingTransactions({ search: search || undefined, page: 1, pageSize: 100 }, { query: { placeholderData: (prev: any) => prev } as any });
  const farmers = useListFarmers({ page: 1, pageSize: 100 }, { query: { staleTime: 60000 } as any });
  const create = useCreateMillingTransaction();
  const update = useUpdateMillingTransaction();

  const allItems = list.data?.items ?? [];
  const items = useMemo(() => {
    if (statusFilter === 'ALL') return allItems;
    return allItems.filter((item) => item.status === statusFilter);
  }, [allItems, statusFilter]);

  const stages = ['PENDING', 'RECEIVED', 'WEIGHING', 'PROCESSING', 'QUALITY_CHECK', 'READY_FOR_RELEASE', 'COMPLETED'];

  const openReceive = () => {
    setSelectedBatch(null);
    setForm({
      farmerId: farmers.data?.items[0]?.id ? String(farmers.data.items[0].id) : '',
      riceVariety: 'Dinorado',
      riceType: 'Palay',
      quantityReceived: '500',
      millingType: 'Regular Milling',
      millingRate: '4.5',
      remarks: '',
      operator: 'Ramil Dela Cruz'
    });
    setDialog(true);
  };

  const openEdit = (batch: any) => {
    setSelectedBatch(batch);
    setForm({
      farmerId: String(batch.farmerId),
      riceVariety: batch.riceVariety,
      riceType: batch.riceType,
      quantityReceived: String(batch.quantityReceived),
      millingType: batch.millingType,
      millingRate: String(batch.millingRate || '4.5'),
      remarks: batch.remarks ?? '',
      operator: batch.operator ?? 'Ramil Dela Cruz'
    });
    setEditDialog(true);
  };

  const handleSaveReceive = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        data: {
          farmerId: Number(form.farmerId),
          riceVariety: form.riceVariety,
          riceType: form.riceType,
          quantityReceived: Number(form.quantityReceived),
          millingType: form.millingType,
          remarks: form.remarks,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
          setDialog(false);
          toast({ title: 'Batch Received', description: `Palay batch received and registered on the milling floor.` });
        }
      }
    );
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedBatch) return;

    try {
      const res = await fetch(`/api/milling-transactions/${selectedBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityReceived: Number(form.quantityReceived),
          riceVariety: form.riceVariety,
          riceType: form.riceType,
          millingType: form.millingType,
          millingRate: Number(form.millingRate),
          operator: form.operator,
          remarks: form.remarks,
        }),
      });

      if (!res.ok) throw new Error('Failed to update batch');
      queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
      setEditDialog(false);
      toast({ title: 'Batch Updated', description: `${selectedBatch.transactionCode} details updated.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAdvance = (transaction: any) => {
    const currentIndex = stages.indexOf(transaction.status);
    const nextStatus = stages[Math.min(currentIndex + 1, stages.length - 1)] as any;
    update.mutate(
      { id: transaction.id, data: { status: nextStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
          toast({ title: 'Stage Advanced', description: `${transaction.transactionCode} moved to ${titleCase(nextStatus)}.` });
        }
      }
    );
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    try {
      const res = await fetch(`/api/milling-transactions/${selectedBatch.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete batch');
      queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
      setDeleteDialog(false);
      toast({ title: 'Batch Deleted', description: `${selectedBatch.transactionCode} was removed.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const calculatedServiceFee = (Number(form.quantityReceived || 0) * Number(form.millingRate || 4.5)) / 100;

  return (
    <AppShell>
      <PageIntro
        eyebrow="Floor Control & Operations"
        title="Milling Pipeline"
        description="Track harvest batches from weigh-in, processing, quality checking, to release and final milling slips."
        action="Receive Palay"
        onAction={openReceive}
      />

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Toolbar search={search} setSearch={setSearch} placeholder="Search batch code, farmer name, variety..." />
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 rounded-xl border border-border bg-background px-3 text-xs font-bold text-primary"
          >
            <option value="ALL">All Stages ({allItems.length})</option>
            {stages.map((s) => (
              <option key={s} value={s}>{titleCase(s)} ({allItems.filter((i) => i.status === s).length})</option>
            ))}
          </select>
        </div>
      </div>

      {list.isLoading ? (
        <LoadingState label="Loading milling pipeline" />
      ) : list.isError ? (
        <ErrorState retry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState label="No batches match this stage" action="Receive New Palay" onAction={openReceive} />
      ) : (
        <TableFrame>
          <table className="w-full min-w-[980px] text-left">
            <thead className="border-b border-border bg-secondary/45">
              <tr>
                {['Batch Code', 'Farmer / Customer', 'Input / Variety', 'Date Received', 'Expected Release', 'Total Value', 'Current Stage', 'Actions'].map((head) => (
                  <th key={head} className="px-5 py-4 font-mono-app text-[9px] uppercase tracking-[.16em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {items.map((item) => (
                <tr key={item.id} className="group transition hover:bg-secondary/25" data-testid={`row-milling-${item.id}`}>
                  <td className="px-5 py-4">
                    <button onClick={() => { setSelectedBatch(item); setDetailModal(true); }} className="text-left group-hover:text-primary transition">
                      <span className="block font-mono-app text-xs font-bold text-primary">{item.transactionCode}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground font-mono-app">ID: #{item.id}</span>
                    </button>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold">{item.farmerName}</td>
                  <td className="px-5 py-4">
                    <span className="block text-sm font-extrabold text-foreground">{item.quantityReceived.toLocaleString()} kg</span>
                    <span className="text-[11px] text-muted-foreground">{item.riceVariety} · {item.riceType}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">{date(item.dateReceived)}</td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">{date(item.expectedCompletion)}</td>
                  <td className="px-5 py-4 font-mono-app text-xs font-bold text-primary">
                    {peso(item.totalAmount)}
                    <span className="block text-[10px] text-muted-foreground font-normal">Paid: {peso(item.amountPaid)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleAdvance(item)}
                      title="Click to advance to next stage"
                      className="group/btn inline-flex items-center gap-1.5"
                    >
                      <StatusPill value={item.status} />
                      {item.status !== 'COMPLETED' && (
                        <span className="text-[10px] font-bold text-accent group-hover/btn:underline">Next ➔</span>
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-bold"
                        onClick={() => { setSelectedBatch(item); setDetailModal(true); }}
                        title="View Batch Slip"
                      >
                        <Eye size={14} className="mr-1" /> Slip
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-bold"
                        onClick={() => openEdit(item)}
                        title="Edit Batch"
                      >
                        <Edit3 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                        onClick={() => { setSelectedBatch(item); setDeleteDialog(true); }}
                        title="Cancel / Delete Batch"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}

      {/* RECEIVE PALAY (CREATE) DIALOG */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wheat className="text-primary" size={20} /> Receive New Palay Batch
            </DialogTitle>
            <DialogDescription>Record incoming harvest at the weighing scale and assign milling queue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveReceive} className="grid gap-4 sm:grid-cols-2 mt-2">
            <label className="sm:col-span-2">
              <span className="field-label font-bold text-xs">Farmer / Customer *</span>
              <select
                required
                value={form.farmerId}
                onChange={(e) => setForm({ ...form, farmerId: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="">Select Farmer</option>
                {(farmers.data?.items ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.fullName} ({f.farmerCode})</option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label font-bold text-xs">Quantity (kg) *</span>
              <Input
                required
                type="number"
                min="1"
                value={form.quantityReceived}
                onChange={(e) => setForm({ ...form, quantityReceived: e.target.value })}
              />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Milling Rate (₱/kg)</span>
              <Input
                type="number"
                step="0.1"
                value={form.millingRate}
                onChange={(e) => setForm({ ...form, millingRate: e.target.value })}
              />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Rice Variety *</span>
              <Input
                required
                value={form.riceVariety}
                onChange={(e) => setForm({ ...form, riceVariety: e.target.value })}
                placeholder="Dinorado, Jasmine, etc."
              />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Milling Type</span>
              <select
                value={form.millingType}
                onChange={(e) => setForm({ ...form, millingType: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Regular Milling">Regular Milling</option>
                <option value="Custom Milling">Custom Milling</option>
                <option value="Premium Polish">Premium Polish</option>
              </select>
            </label>
            <div className="sm:col-span-2 rounded-xl bg-secondary/50 border border-border p-3 flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-bold">Estimated Service Charge:</span>
              <span className="font-extrabold text-primary font-mono-app text-lg">{peso(calculatedServiceFee)}</span>
            </div>
            <label className="sm:col-span-2">
              <span className="field-label font-bold text-xs">Remarks / Notes</span>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="e.g. Sacks marked in shed B, keep dry"
              />
            </label>
            <DialogFooter className="sm:col-span-2 mt-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending} className="font-bold">
                {create.isPending ? <Loader2 className="animate-spin mr-1" size={15} /> : <Check className="mr-1" size={15} />}
                Start Milling Batch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT BATCH DIALOG */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Batch: {selectedBatch?.transactionCode}</DialogTitle>
            <DialogDescription>Modify batch specifications, assigned operator, and rate.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="grid gap-4 sm:grid-cols-2 mt-2">
            <label>
              <span className="field-label font-bold text-xs">Quantity (kg)</span>
              <Input
                required
                type="number"
                value={form.quantityReceived}
                onChange={(e) => setForm({ ...form, quantityReceived: e.target.value })}
              />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Milling Rate (₱/kg)</span>
              <Input
                type="number"
                step="0.1"
                value={form.millingRate}
                onChange={(e) => setForm({ ...form, millingRate: e.target.value })}
              />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Rice Variety</span>
              <Input value={form.riceVariety} onChange={(e) => setForm({ ...form, riceVariety: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Milling Type</span>
              <Input value={form.millingType} onChange={(e) => setForm({ ...form, millingType: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label font-bold text-xs">Assigned Operator</span>
              <Input value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label font-bold text-xs">Remarks</span>
              <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </label>
            <DialogFooter className="sm:col-span-2 mt-3">
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button type="submit" className="font-bold">
                <Check className="mr-1" size={15} /> Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW BATCH SLIP & STEPPER DIALOG */}
      {selectedBatch && (
        <Dialog open={detailModal} onOpenChange={setDetailModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="font-display text-2xl">{selectedBatch.transactionCode}</DialogTitle>
                  <DialogDescription>{selectedBatch.farmerName} · {selectedBatch.riceVariety}</DialogDescription>
                </div>
                <StatusPill value={selectedBatch.status} />
              </div>
            </DialogHeader>

            {/* 6-Stage Progress Tracker */}
            <div className="my-4 rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex justify-between text-xs font-mono-app text-muted-foreground uppercase mb-2">
                <span>Stage Progress</span>
                <span className="font-bold text-primary">{titleCase(selectedBatch.status)}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.max(14, ((stages.indexOf(selectedBatch.status) + 1) / stages.length) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono-app text-muted-foreground mt-2">
                <span>Received</span>
                <span>Weighed</span>
                <span>Milling</span>
                <span>QA</span>
                <span>Ready</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-card border border-border p-3">
                <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Quantity In</span>
                <b className="text-base">{Number(selectedBatch.quantityReceived).toLocaleString()} kg</b>
              </div>
              <div className="rounded-xl bg-card border border-border p-3">
                <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Service Charge</span>
                <b className="text-base text-primary">{peso(selectedBatch.totalAmount)}</b>
              </div>
              <div className="rounded-xl bg-card border border-border p-3">
                <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Amount Paid</span>
                <b className="text-base text-[hsl(var(--chart-1))]">{peso(selectedBatch.amountPaid)}</b>
              </div>
              <div className="rounded-xl bg-card border border-border p-3">
                <span className="block font-mono-app text-[10px] text-muted-foreground uppercase">Remaining Balance</span>
                <b className="text-base text-destructive">{peso(selectedBatch.balance)}</b>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold">
                <Printer size={14} className="mr-1" /> Print Slip
              </Button>
              {selectedBatch.status !== 'COMPLETED' && (
                <Button size="sm" onClick={() => { handleAdvance(selectedBatch); setDetailModal(false); }}>
                  Advance Stage ➔
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDeleteDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title="Delete Milling Batch"
        description={`Are you sure you want to delete batch ${selectedBatch?.transactionCode}? Associated payment records will also be removed.`}
        onConfirm={handleDeleteBatch}
      />
    </AppShell>
  );
}

// ==========================================
// 5. Inventory Management CRUD Page
// ==========================================

export function InventoryPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dialog, setDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [form, setForm] = useState({
    itemName: '', category: 'RAW_MATERIAL', variety: 'Dinorado', unit: 'kg',
    currentStock: '1000', minimumStock: '500', maximumStock: '5000',
    unitCost: '25', sellingPrice: '35', supplier: 'Camarin Producers', storageLocation: 'Warehouse A'
  });

  const [adjustAmount, setAdjustAmount] = useState('100');
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const list = useListInventory({ search: search || undefined, page: 1, pageSize: 100 }, { query: { placeholderData: (prev: any) => prev } as any });
  const create = useCreateInventoryItem();

  const allItems = list.data?.items ?? [];
  const items = useMemo(() => {
    if (categoryFilter === 'ALL') return allItems;
    if (categoryFilter === 'LOW_STOCK') return allItems.filter((i) => i.stockStatus !== 'HEALTHY');
    return allItems.filter((i) => i.category === categoryFilter);
  }, [allItems, categoryFilter]);

  const openAdd = () => {
    setSelectedItem(null);
    setForm({
      itemName: '', category: 'RAW_MATERIAL', variety: 'Standard', unit: 'kg',
      currentStock: '500', minimumStock: '200', maximumStock: '2000',
      unitCost: '20', sellingPrice: '30', supplier: 'Local farmers', storageLocation: 'Shed 1'
    });
    setDialog(true);
  };

  const openEdit = (item: any) => {
    setSelectedItem(item);
    setForm({
      itemName: item.itemName,
      category: item.category,
      variety: item.variety ?? '',
      unit: item.unit ?? 'kg',
      currentStock: String(item.currentStock),
      minimumStock: String(item.minimumStock),
      maximumStock: String(item.maximumStock),
      unitCost: String(item.unitCost),
      sellingPrice: String(item.sellingPrice || '0'),
      supplier: item.supplier ?? '',
      storageLocation: item.storageLocation ?? ''
    });
    setEditDialog(true);
  };

  const openAdjust = (item: any) => {
    setSelectedItem(item);
    setAdjustAmount('50');
    setAdjustType('ADD');
    setAdjustDialog(true);
  };

  const handleSaveAdd = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        data: {
          ...form,
          category: form.category as 'RAW_MATERIAL',
          currentStock: Number(form.currentStock),
          minimumStock: Number(form.minimumStock),
          maximumStock: Number(form.maximumStock),
          unitCost: Number(form.unitCost),
          sellingPrice: Number(form.sellingPrice || 0),
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
          setDialog(false);
          toast({ title: 'Item Added', description: `${form.itemName} has been added to inventory.` });
        }
      }
    );
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/inventory/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: form.itemName,
          category: form.category,
          variety: form.variety,
          unit: form.unit,
          currentStock: Number(form.currentStock),
          minimumStock: Number(form.minimumStock),
          maximumStock: Number(form.maximumStock),
          unitCost: Number(form.unitCost),
          sellingPrice: Number(form.sellingPrice),
          supplier: form.supplier,
          storageLocation: form.storageLocation,
        }),
      });
      if (!res.ok) throw new Error('Failed to update inventory');
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      setEditDialog(false);
      toast({ title: 'Item Updated', description: `${form.itemName} has been updated.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSaveAdjust = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedItem) return;
    const delta = adjustType === 'ADD' ? Number(adjustAmount) : -Number(adjustAmount);
    try {
      const res = await fetch(`/api/inventory/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment: delta }),
      });
      if (!res.ok) throw new Error('Failed to adjust stock');
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      setAdjustDialog(false);
      toast({
        title: adjustType === 'ADD' ? 'Stock Added' : 'Stock Deducted',
        description: `${selectedItem.itemName}: ${adjustType === 'ADD' ? '+' : '-'}${adjustAmount} ${selectedItem.unit}.`
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch(`/api/inventory/${selectedItem.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      setDeleteDialog(false);
      toast({ title: 'Item Deleted', description: `${selectedItem.itemName} removed from stock registry.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const low = allItems.filter((item) => item.stockStatus !== 'HEALTHY').length;

  return (
    <AppShell>
      <PageIntro
        eyebrow="Stock Control & Par Levels"
        title="Inventory"
        description="Monitor raw harvest supplies, milled stock, packaging, and by-products with live stock adjustments."
        action="Add Inventory Item"
        onAction={openAdd}
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <StatCard label="Tracked items" value={String(allItems.length)} meta="across all categories" icon={PackageOpen} />
        <StatCard label="Needs attention" value={String(low)} meta="low or out of stock" icon={CircleAlert} accent="gold" />
        <StatCard label="Total stock value" value={peso(allItems.reduce((sum, i) => sum + i.currentStock * i.unitCost, 0))} meta="current cost basis" icon={Banknote} />
      </div>

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Toolbar search={search} setSearch={setSearch} placeholder="Search item, variety, location..." />
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'RAW_MATERIAL', 'FINISHED_PRODUCT', 'BY_PRODUCT', 'PACKAGING', 'LOW_STOCK'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-2.5 py-1.5 font-mono-app text-[10px] uppercase tracking-wider transition ${
                categoryFilter === cat ? 'bg-primary text-primary-foreground font-bold shadow' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {cat === 'ALL' ? 'All Items' : cat === 'LOW_STOCK' ? '⚠️ Low Stock' : titleCase(cat)}
            </button>
          ))}
        </div>
      </div>

      {list.isLoading ? (
        <LoadingState label="Checking inventory ledger" />
      ) : list.isError ? (
        <ErrorState retry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState label="No inventory items in this view" action="Add First Item" onAction={openAdd} />
      ) : (
        <TableFrame>
          <table className="w-full min-w-[880px] text-left">
            <thead className="border-b border-border bg-secondary/45">
              <tr>
                {['Item & Code', 'Category', 'Current Stock Level', 'Par Range', 'Cost / Selling', 'Storage Bay', 'Status', 'Actions'].map((head) => (
                  <th key={head} className="px-5 py-4 font-mono-app text-[9px] uppercase tracking-[.16em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {items.map((item) => (
                <tr key={item.id} className="group transition hover:bg-secondary/25" data-testid={`row-inventory-${item.id}`}>
                  <td className="px-5 py-4">
                    <span className="block text-sm font-bold">{item.itemName}</span>
                    <span className="font-mono-app text-[10px] text-muted-foreground">{item.itemCode} {item.variety ? `· ${item.variety}` : ''}</span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill value={item.category} tone="blue" />
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-sm font-extrabold ${item.stockStatus !== 'HEALTHY' ? 'text-destructive' : 'text-primary'}`}>
                      {item.currentStock.toLocaleString()} {item.unit}
                    </span>
                    <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full ${item.stockStatus === 'OUT_OF_STOCK' ? 'bg-destructive' : item.stockStatus === 'LOW_STOCK' ? 'bg-accent' : 'bg-[hsl(var(--chart-1))]'}`}
                        style={{ width: `${Math.min(100, (item.currentStock / Math.max(item.maximumStock, 1)) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground font-mono-app">
                    {item.minimumStock} – {item.maximumStock} {item.unit}
                  </td>
                  <td className="px-5 py-4 font-mono-app text-xs">
                    <span className="font-semibold">{peso(item.unitCost)}</span>
                    <span className="block text-[10px] text-muted-foreground">Sell: {peso(item.sellingPrice)}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">{item.storageLocation ?? 'Main Bay'}</td>
                  <td className="px-5 py-4"><StatusPill value={item.stockStatus} /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs font-bold"
                        onClick={() => openAdjust(item)}
                        title="Quick Restock / Deduct"
                      >
                        Adjust
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-bold"
                        onClick={() => openEdit(item)}
                        title="Edit Item Details"
                      >
                        <Edit3 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                        onClick={() => { setSelectedItem(item); setDeleteDialog(true); }}
                        title="Delete Item"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}

      {/* CREATE ITEM DIALOG */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>Add raw palay, milled rice, by-products, or packaging to the tracking system.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAdd} className="grid gap-4 sm:grid-cols-2 mt-2">
            <label className="sm:col-span-2">
              <span className="field-label font-bold text-xs">Item Name *</span>
              <Input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="e.g. Premium Dinorado Milled Rice" />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Category *</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="RAW_MATERIAL">Raw Material (Palay)</option>
                <option value="FINISHED_PRODUCT">Finished Product (Rice)</option>
                <option value="BY_PRODUCT">By-Product (Bran/Husk)</option>
                <option value="PACKAGING">Packaging (Sacks)</option>
              </select>
            </label>
            <label>
              <span className="field-label font-bold text-xs">Unit of Measurement *</span>
              <Input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, pcs, sacks" />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Current Stock *</span>
              <Input required type="number" min="0" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Minimum Par Level *</span>
              <Input required type="number" min="0" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Unit Cost (₱)</span>
              <Input type="number" step="0.1" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Selling Price (₱)</span>
              <Input type="number" step="0.1" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Storage Location</span>
              <Input value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} placeholder="Warehouse 1, Shed A" />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Supplier</span>
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Local Mill" />
            </label>
            <DialogFooter className="sm:col-span-2 mt-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending} className="font-bold">
                <Check className="mr-1" size={15} /> Add to Inventory
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* FULL EDIT ITEM DIALOG */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit: {selectedItem?.itemName}</DialogTitle>
            <DialogDescription>Update pricing, par ranges, and item details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="grid gap-4 sm:grid-cols-2 mt-2">
            <label className="sm:col-span-2">
              <span className="field-label font-bold text-xs">Item Name</span>
              <Input required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Unit Cost (₱)</span>
              <Input type="number" step="0.1" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Selling Price (₱)</span>
              <Input type="number" step="0.1" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Minimum Stock (Low Alert)</span>
              <Input type="number" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: e.target.value })} />
            </label>
            <label>
              <span className="field-label font-bold text-xs">Maximum Stock (Capacity)</span>
              <Input type="number" value={form.maximumStock} onChange={(e) => setForm({ ...form, maximumStock: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label font-bold text-xs">Storage Location</span>
              <Input value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} />
            </label>
            <DialogFooter className="sm:col-span-2 mt-3">
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button type="submit" className="font-bold">
                <Check className="mr-1" size={15} /> Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QUICK STOCK ADJUST DIALOG */}
      {selectedItem && (
        <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adjust Stock: {selectedItem.itemName}</DialogTitle>
              <DialogDescription>Current on-hand: {selectedItem.currentStock} {selectedItem.unit}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveAdjust} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('ADD')}
                  className={`p-3 rounded-xl border text-center font-bold text-xs transition ${
                    adjustType === 'ADD' ? 'border-primary bg-primary/20 text-primary' : 'border-border bg-secondary text-muted-foreground'
                  }`}
                >
                  + Restock (Stock In)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('DEDUCT')}
                  className={`p-3 rounded-xl border text-center font-bold text-xs transition ${
                    adjustType === 'DEDUCT' ? 'border-destructive bg-destructive/20 text-destructive' : 'border-border bg-secondary text-muted-foreground'
                  }`}
                >
                  - Deduct / Release
                </button>
              </div>
              <label className="block">
                <span className="field-label font-bold text-xs">Adjustment Amount ({selectedItem.unit})</span>
                <Input
                  required
                  type="number"
                  min="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                />
              </label>
              <div className="rounded-xl bg-secondary/50 p-3 text-xs flex justify-between font-mono-app">
                <span>New Total Result:</span>
                <b className="text-primary">
                  {adjustType === 'ADD'
                    ? selectedItem.currentStock + Number(adjustAmount || 0)
                    : Math.max(0, selectedItem.currentStock - Number(adjustAmount || 0))} {selectedItem.unit}
                </b>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setAdjustDialog(false)}>Cancel</Button>
                <Button type="submit" className="font-bold">Apply Adjustment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDeleteDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title="Delete Inventory Item"
        description={`Are you sure you want to remove ${selectedItem?.itemName} (${selectedItem?.itemCode}) from the stock ledger?`}
        onConfirm={handleDeleteItem}
      />
    </AppShell>
  );
}

// ==========================================
// 5.5. Dedicated Billing & Invoicing Page
// ==========================================

export function BillingPage({ portal = false }: { portal?: boolean }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'>('ALL');
  const [createDialog, setCreateDialog] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [payCashDialog, setPayCashDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Billing Invoice Form
  const [form, setForm] = useState({
    farmerId: '',
    riceVariety: 'Dinorado',
    riceType: 'Palay',
    quantityReceived: '1000',
    millingRate: '4.50',
    dryingFee: '0',
    sacksQuantity: '20',
    sacksRate: '25',
    haulingLabor: '0',
    branCredit: '0',
    discount: '0',
    remarks: 'Payment terms: CASH ONLY upon release.',
    expectedCompletion: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
  });

  // Cash payment form for settling invoice
  const [cashForm, setCashForm] = useState({
    cashTendered: '',
    remarks: 'Full Cash Settlement on Pickup',
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const transactions = useListMillingTransactions(
    { search: search || undefined },
    { query: { retry: false, queryKey: getListMillingTransactionsQueryKey({ search: search || undefined }) } as any }
  );
  const farmers = useListFarmers({}, { query: { retry: false } as any });

  const createBatch = useCreateMillingTransaction();
  const createPayment = useCreatePayment();

  // Calculated items for Invoice Form
  const palayWeight = Number(form.quantityReceived || 0);
  const ratePerKg = Number(form.millingRate || 0);
  const millingCharge = palayWeight * ratePerKg;
  const dryingCharge = Number(form.dryingFee || 0);
  const sacksTotal = Number(form.sacksQuantity || 0) * Number(form.sacksRate || 0);
  const haulingCharge = Number(form.haulingLabor || 0);
  const branDeduction = Number(form.branCredit || 0);
  const discountAmount = Number(form.discount || 0);

  const subtotalAmount = millingCharge + dryingCharge + sacksTotal + haulingCharge - branDeduction;
  const netTotalPayable = Math.max(0, subtotalAmount - discountAmount);

  const items = transactions.data?.items ?? [];

  // Filter items based on status tab
  const filteredInvoices = items.filter((inv) => {
    if (statusFilter === 'UNPAID') return inv.amountPaid === 0;
    if (statusFilter === 'PARTIALLY_PAID') return inv.amountPaid > 0 && inv.balance > 0;
    if (statusFilter === 'PAID') return inv.balance <= 0;
    return true;
  });

  const totalBilled = items.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalCollected = items.reduce((sum, item) => sum + item.amountPaid, 0);
  const totalUnpaid = items.reduce((sum, item) => sum + item.balance, 0);

  const handleCreateInvoice = (e: FormEvent) => {
    e.preventDefault();
    if (!form.farmerId) {
      toast({ title: 'Missing Customer', description: 'Please select a registered farmer or customer.', variant: 'destructive' });
      return;
    }

    const otherCharges = dryingCharge + sacksTotal + haulingCharge - branDeduction;

    createBatch.mutate(
      {
        data: {
          farmerId: Number(form.farmerId),
          riceVariety: form.riceVariety,
          riceType: form.riceType || 'Palay',
          quantityReceived: palayWeight,
          millingRate: ratePerKg,
          serviceCharge: millingCharge,
          otherCharges: Math.max(0, otherCharges),
          discount: discountAmount,
          totalAmount: netTotalPayable,
          millingType: 'Regular Milling',
          expectedCompletion: form.expectedCompletion,
          remarks: form.remarks,
        } as any,
      },
      {
        onSuccess: (newTrx: any) => {
          queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
          setCreateDialog(false);
          setSelectedInvoice(newTrx);
          setInvoiceModal(true);
          toast({ title: 'Billing Statement Created', description: `Invoice for ${peso(netTotalPayable)} generated.` });
        },
        onError: (err: any) => {
          toast({ title: 'Error', description: err.message || 'Failed to create invoice.', variant: 'destructive' });
        },
      }
    );
  };

  const handlePayCashSettlement = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const due = selectedInvoice.balance;
    const tendered = Number(cashForm.cashTendered || due);

    if (tendered < due) {
      toast({ title: 'Insufficient Cash', description: `Tendered cash must at least cover ${peso(due)}.`, variant: 'destructive' });
      return;
    }

    createPayment.mutate(
      {
        data: {
          transactionId: selectedInvoice.id,
          amount: due,
          paymentMethod: 'CASH',
          receivedBy: 'Mila Santos (Cashier)',
          remarks: cashForm.remarks,
        } as any,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
          setPayCashDialog(false);
          toast({ title: 'Cash Payment Recorded', description: `Invoice ${selectedInvoice.transactionCode} marked as FULLY PAID IN CASH.` });
        },
        onError: (err: any) => {
          toast({ title: 'Error', description: err.message || 'Payment failed.', variant: 'destructive' });
        },
      }
    );
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return;
    try {
      const res = await fetch(`/api/milling-transactions/${selectedInvoice.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete invoice');
      queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      setDeleteDialog(false);
      toast({ title: 'Invoice Deleted', description: `${selectedInvoice.transactionCode} removed from ledger.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppShell portal={portal}>
      <PageIntro
        eyebrow={portal ? 'Personal Billing' : 'Billing & Statement of Accounts'}
        title={portal ? 'My Billing Statements' : 'Billing Statements & Invoicing'}
        description={portal ? 'View your official billing statements (kuwentada) and milling invoices.' : 'Generate itemized billing invoices, calculate drying & sack charges, settle in cash, and print official statements.'}
        action={!portal ? '+ Create Billing Invoice' : undefined}
        onAction={!portal ? () => setCreateDialog(true) : undefined}
      />

      {/* KPI Stats */}
      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Invoiced" value={peso(totalBilled)} meta="all billing records" icon={FileText} />
        <StatCard label="Cash Collected" value={peso(totalCollected)} meta="paid in cash" icon={Banknote} accent="chart-1" />
        <StatCard label="Pending Balance" value={peso(totalUnpaid)} meta="unpaid customer balance" icon={CircleAlert} accent="gold" />
        <StatCard label="Total Invoices" value={String(items.length)} meta="statement count" icon={ClipboardList} />
      </div>

      {/* Toolbar & Filter Tabs */}
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Toolbar search={search} setSearch={setSearch} placeholder="Search invoice code, customer, variety..." />
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-secondary/50 p-1">
          {(['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === st ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st === 'ALL' ? 'All Invoices' : st === 'UNPAID' ? 'Unpaid (Cash Due)' : st === 'PARTIALLY_PAID' ? 'Partial' : 'Paid in Full'}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      {transactions.isLoading ? (
        <LoadingState label="Loading billing statements..." />
      ) : filteredInvoices.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <FileText size={48} className="mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-bold">No Billing Statements Found</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            {search ? 'No invoices match your search query.' : 'Click "Create Billing Invoice" to generate an itemized billing statement for a customer.'}
          </p>
          {!portal && (
            <Button onClick={() => setCreateDialog(true)} className="mt-5 font-bold">
              <Plus size={16} /> Create First Invoice
            </Button>
          )}
        </div>
      ) : (
        <TableFrame>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/30 font-mono-app uppercase text-muted-foreground">
              <tr>
                <th className="p-3.5">Invoice / Batch</th>
                <th className="p-3.5">Customer / Farmer</th>
                <th className="p-3.5">Variety & Palay</th>
                <th className="p-3.5">Total Billed</th>
                <th className="p-3.5">Paid in Cash</th>
                <th className="p-3.5">Balance Due</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((inv) => {
                const isPaid = inv.balance <= 0;
                const isPartial = inv.amountPaid > 0 && inv.balance > 0;
                return (
                  <tr key={inv.id} className="transition hover:bg-secondary/20">
                    <td className="p-3.5 font-mono-app font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <FileText size={14} className="text-accent" />
                        {inv.transactionCode}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-normal">{inv.dateReceived}</div>
                    </td>
                    <td className="p-3.5 font-semibold text-foreground">
                      {inv.farmerName || 'Registered Customer'}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-foreground">{inv.riceVariety}</span>
                      <span className="block text-[10px] text-muted-foreground font-mono-app">{inv.quantityReceived.toLocaleString()} kg Palay</span>
                    </td>
                    <td className="p-3.5 font-mono-app font-bold text-foreground">{peso(inv.totalAmount)}</td>
                    <td className="p-3.5 font-mono-app text-[hsl(var(--chart-1))] font-bold">{peso(inv.amountPaid)}</td>
                    <td className="p-3.5 font-mono-app font-bold">
                      {inv.balance > 0 ? (
                        <span className="text-[hsl(var(--chart-4))]">{peso(inv.balance)}</span>
                      ) : (
                        <span className="text-muted-foreground">₱0.00</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--chart-1)/.15)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--chart-1))] border border-[hsl(var(--chart-1)/.3)]">
                          <Check size={12} /> PAID IN FULL
                        </span>
                      ) : isPartial ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--chart-3)/.15)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--chart-3))] border border-[hsl(var(--chart-3)/.3)]">
                          PARTIAL ({peso(inv.balance)} due)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--chart-4)/.15)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--chart-4))] border border-[hsl(var(--chart-4)/.3)]">
                          UNPAID (CASH DUE)
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs font-bold border-accent/40 text-accent hover:bg-accent/10"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setInvoiceModal(true);
                          }}
                        >
                          <Printer size={13} /> Print Statement
                        </Button>
                        {!isPaid && !portal && (
                          <Button
                            size="sm"
                            className="h-8 gap-1 text-xs font-bold bg-[hsl(var(--chart-1))] text-white hover:bg-[hsl(var(--chart-1)/.9)]"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setCashForm({ cashTendered: String(inv.balance), remarks: 'Full Cash Settlement on Pickup' });
                              setPayCashDialog(true);
                            }}
                          >
                            <Banknote size={13} /> Pay Cash
                          </Button>
                        )}
                        {!portal && (
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setDeleteDialog(true);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition"
                            title="Delete invoice"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableFrame>
      )}

      {/* CREATE BILLING INVOICE MODAL */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-display text-xl font-bold">
              <FileText className="text-accent" size={20} /> Create Billing Statement & Invoice
            </DialogTitle>
            <DialogDescription>
              Generate an itemized billing statement (kuwentada) for custom milling, drying, and sacks.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInvoice} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label font-bold text-xs">Customer / Farmer (Magsasaka)</span>
                <Select value={form.farmerId} onValueChange={(val) => setForm({ ...form, farmerId: val })}>
                  <SelectTrigger className="h-11 bg-card border-border">
                    <SelectValue placeholder="Select registered farmer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {farmers.data?.items.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.fullName} ({f.farmerCode}) · {f.barangay}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="block">
                <span className="field-label font-bold text-xs">Rice Variety (Uri ng Palay)</span>
                <Select value={form.riceVariety} onValueChange={(val) => setForm({ ...form, riceVariety: val })}>
                  <SelectTrigger className="h-11 bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinorado">Dinorado (Special Grain)</SelectItem>
                    <SelectItem value="Jasmine">Jasmine (Aromatic)</SelectItem>
                    <SelectItem value="NSIC Rc222">NSIC Rc222 (Triple Two)</SelectItem>
                    <SelectItem value="Inbred">Inbred / Regular Variety</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>

            {/* Itemized Line Charges */}
            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
              <div className="font-mono-app text-[11px] uppercase tracking-wider text-accent font-bold">
                Itemized Service Breakdown (Kuwentada ng Bayarin)
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="field-label text-xs">Palay Weight (kg)</span>
                  <Input
                    required
                    type="number"
                    min="1"
                    value={form.quantityReceived}
                    onChange={(e) => setForm({ ...form, quantityReceived: e.target.value })}
                    className="h-9 bg-card border-border"
                  />
                </label>
                <label className="block">
                  <span className="field-label text-xs">Milling Rate (₱/kg)</span>
                  <Input
                    required
                    type="number"
                    step="0.1"
                    value={form.millingRate}
                    onChange={(e) => setForm({ ...form, millingRate: e.target.value })}
                    className="h-9 bg-card border-border"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="field-label text-xs">Solar/Dryer Fee (₱)</span>
                  <Input
                    type="number"
                    value={form.dryingFee}
                    onChange={(e) => setForm({ ...form, dryingFee: e.target.value })}
                    placeholder="0.00"
                    className="h-9 bg-card border-border"
                  />
                </label>
                <label className="block">
                  <span className="field-label text-xs">Sacks (Pcs @ ₱25)</span>
                  <Input
                    type="number"
                    value={form.sacksQuantity}
                    onChange={(e) => setForm({ ...form, sacksQuantity: e.target.value })}
                    className="h-9 bg-card border-border"
                  />
                </label>
                <label className="block">
                  <span className="field-label text-xs">Hauling / Labor (₱)</span>
                  <Input
                    type="number"
                    value={form.haulingLabor}
                    onChange={(e) => setForm({ ...form, haulingLabor: e.target.value })}
                    placeholder="0.00"
                    className="h-9 bg-card border-border"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                <label className="block">
                  <span className="field-label text-xs text-muted-foreground">Less: Darak/Bran Buyback (-₱)</span>
                  <Input
                    type="number"
                    value={form.branCredit}
                    onChange={(e) => setForm({ ...form, branCredit: e.target.value })}
                    placeholder="0.00"
                    className="h-9 bg-card border-border"
                  />
                </label>
                <label className="block">
                  <span className="field-label text-xs text-muted-foreground">Less: Cash Discount (-₱)</span>
                  <Input
                    type="number"
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    placeholder="0.00"
                    className="h-9 bg-card border-border"
                  />
                </label>
              </div>
            </div>

            {/* Total Summary Box */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center justify-between font-mono-app">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Net Total Cash Payable:</span>
                <span className="font-display text-2xl font-bold text-primary">{peso(netTotalPayable)}</span>
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-0.5">
                <div>Milling Charge: {peso(millingCharge)}</div>
                <div>Add'l Sacks & Drying: {peso(dryingCharge + sacksTotal + haulingCharge)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label font-bold text-xs">Estimated Release Date</span>
                <Input
                  type="date"
                  value={form.expectedCompletion}
                  onChange={(e) => setForm({ ...form, expectedCompletion: e.target.value })}
                  className="h-11 bg-card border-border"
                />
              </label>
              <label className="block">
                <span className="field-label font-bold text-xs">Payment Terms</span>
                <Input
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="h-11 bg-card border-border"
                />
              </label>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createBatch.isPending} className="font-bold">
                {createBatch.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Generate & Save Billing Statement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SETTLE IN CASH DIALOG */}
      {selectedInvoice && (
        <Dialog open={payCashDialog} onOpenChange={setPayCashDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-display text-xl font-bold">
                <Banknote className="text-[hsl(var(--chart-1))]" size={22} /> Settle Invoice in Cash
              </DialogTitle>
              <DialogDescription>
                Record cash payment for invoice <b>{selectedInvoice.transactionCode}</b>.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handlePayCashSettlement} className="space-y-4 mt-2">
              <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <b className="text-foreground">{selectedInvoice.farmerName || 'Customer'}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Invoiced:</span>
                  <span className="font-mono-app">{peso(selectedInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-border">
                  <span className="text-destructive">Outstanding Cash Balance:</span>
                  <span className="font-mono-app text-destructive text-sm">{peso(selectedInvoice.balance)}</span>
                </div>
              </div>

              <label className="block">
                <span className="field-label font-bold text-xs">Cash Handed by Customer (Bayad)</span>
                <Input
                  required
                  type="number"
                  min={selectedInvoice.balance}
                  step="0.5"
                  value={cashForm.cashTendered}
                  onChange={(e) => setCashForm({ ...cashForm, cashTendered: e.target.value })}
                  placeholder={`Min ${selectedInvoice.balance}`}
                  className="h-12 bg-card border-border text-lg font-mono-app font-bold"
                />
              </label>

              {/* Quick Cash Buttons */}
              <div className="flex gap-2">
                {[100, 200, 500, 1000].map((denom) => {
                  const target = Math.ceil(selectedInvoice.balance / denom) * denom;
                  return (
                    <button
                      key={denom}
                      type="button"
                      onClick={() => setCashForm({ ...cashForm, cashTendered: String(target) })}
                      className="flex-1 rounded-lg border border-border bg-secondary py-1.5 text-center font-mono-app text-xs font-bold hover:bg-primary/20 hover:text-primary transition"
                    >
                      ₱{target}
                    </button>
                  );
                })}
              </div>

              {/* Change (Sukli) Calculator */}
              <div className="rounded-xl border border-[hsl(var(--chart-1)/.4)] bg-[hsl(var(--chart-1)/.1)] p-3 text-center">
                <span className="block font-mono-app text-[10px] uppercase tracking-wider text-muted-foreground">Change Given (Sukli):</span>
                <span className="font-display text-2xl font-bold text-[hsl(var(--chart-1))]">
                  {peso(Math.max(0, Number(cashForm.cashTendered || 0) - selectedInvoice.balance))}
                </span>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => setPayCashDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createPayment.isPending} className="font-bold bg-[hsl(var(--chart-1))] text-white hover:bg-[hsl(var(--chart-1)/.9)]">
                  {createPayment.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Confirm Cash Collection
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* PRINT-READY OFFICIAL BILLING STATEMENT & INVOICE MODAL */}
      {selectedInvoice && (
        <Dialog open={invoiceModal} onOpenChange={setInvoiceModal}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
            <DialogHeader className="no-print">
              <DialogTitle className="flex items-center gap-2">
                <Printer className="text-accent" size={20} /> Official Statement of Account & Invoice
              </DialogTitle>
              <DialogDescription>
                Print-ready official billing statement formatted for standard Letter/A4 paper and client billing records.
              </DialogDescription>
            </DialogHeader>

            {/* PRINTABLE BILLING CONTAINER */}
            <div
              id="printable-billing-invoice"
              className="rounded-2xl border border-border bg-white text-black p-6 font-sans shadow-sm"
              style={{ color: '#000000', backgroundColor: '#ffffff' }}
            >
              {/* Header */}
              <div className="text-center pb-4 border-b-2 border-dashed border-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <Wheat size={24} className="text-amber-800" />
                  <h1 className="text-xl font-black uppercase tracking-wider text-black">Sitio Camarin Rice Mill</h1>
                </div>
                <p className="text-xs text-gray-700 font-semibold mt-0.5">
                  Sitio Camarin, Brgy. Kaagwasan, Dimataling, Zamboanga del Sur
                </p>
                <p className="text-[10px] text-gray-600 font-mono">
                  Tel: (0917) 123-4567 / (0918) 987-6543 · Open Mon-Sat 7:00 AM - 5:00 PM
                </p>
                <div className="mt-2 inline-block rounded border border-black bg-gray-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-black">
                  Billing Statement & Official Invoice (Kuwentada)
                </div>
              </div>

              {/* Invoice Metadata */}
              <div className="grid grid-cols-2 gap-4 py-4 text-xs border-b border-gray-300">
                <div>
                  <div className="font-mono text-[10px] uppercase text-gray-500 font-bold">Billed To (Customer):</div>
                  <div className="text-sm font-bold text-black uppercase">{selectedInvoice.farmerName || 'Customer / Magsasaka'}</div>
                  <div className="text-[11px] text-gray-600 font-mono">Customer ID: {selectedInvoice.farmerCode || 'CUS-001'}</div>
                  <div className="text-[11px] text-gray-600">Location: Dimataling, Zamboanga del Sur</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase text-gray-500 font-bold">Invoice & Date:</div>
                  <div className="font-mono font-bold text-sm text-black">{selectedInvoice.transactionCode}</div>
                  <div className="text-[11px] text-gray-600 font-mono">Billing Date: {selectedInvoice.dateReceived || new Date().toISOString().slice(0, 10)}</div>
                  <div className="text-[11px] text-gray-600 font-mono">Due Date: {selectedInvoice.expectedCompletion || 'Upon Release'}</div>
                </div>
              </div>

              {/* Itemized Table */}
              <table className="w-full my-4 text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black font-mono uppercase text-[10px] bg-gray-100">
                    <th className="py-2 px-2">Description / Service</th>
                    <th className="py-2 px-2 text-right">Quantity</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 px-2 text-right">Amount (₱)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-2 px-2">
                      <b className="text-black">Custom Rice Milling ({selectedInvoice.riceVariety})</b>
                      <div className="text-[10px] text-gray-600">Standard de-hulling, polishing & separation</div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{Number(selectedInvoice.quantityReceived).toLocaleString()} kg</td>
                    <td className="py-2 px-2 text-right font-mono">₱{Number(selectedInvoice.millingRate || 4.5).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-black">
                      {peso(selectedInvoice.serviceCharge || selectedInvoice.quantityReceived * Number(selectedInvoice.millingRate || 4.5))}
                    </td>
                  </tr>

                  {Number(selectedInvoice.otherCharges || 0) > 0 && (
                    <tr>
                      <td className="py-2 px-2">
                        <b className="text-black">Packaging Bags & Additional Processing</b>
                        <div className="text-[10px] text-gray-600">50kg woven sacks & handling fees</div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono">—</td>
                      <td className="py-2 px-2 text-right font-mono">—</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-black">
                        {peso(selectedInvoice.otherCharges)}
                      </td>
                    </tr>
                  )}

                  {Number(selectedInvoice.discount || 0) > 0 && (
                    <tr>
                      <td className="py-2 px-2 text-gray-600 italic">
                        Less: Special Volume Discount / By-Product Credit
                      </td>
                      <td className="py-2 px-2 text-right font-mono">—</td>
                      <td className="py-2 px-2 text-right font-mono">—</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-red-700">
                        -{peso(selectedInvoice.discount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Financial Totals */}
              <div className="pt-3 border-t-2 border-black space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-700">Subtotal Service Charges:</span>
                  <span className="font-bold text-black">{peso(selectedInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>Cash Amount Paid (Bayad):</span>
                  <span className="font-bold">{peso(selectedInvoice.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-base font-black pt-2 border-t border-gray-400">
                  <span>OUTSTANDING BALANCE DUE:</span>
                  <span className="text-red-700">{peso(selectedInvoice.balance)}</span>
                </div>
              </div>

              {/* Payment Terms Box */}
              <div className="my-4 rounded border border-black bg-amber-50 p-2 text-center text-xs">
                <span className="font-bold text-black">PAYMENT TERMS: STRICTLY CASH ONLY (KABUUANG BAYAD BAGO ILABAS ANG BIGAS)</span>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 mt-4 border-t border-dashed border-gray-400 text-xs">
                <div className="text-center">
                  <div className="border-b border-black w-44 mx-auto mb-1"></div>
                  <div className="font-bold text-black">MILA SANTOS</div>
                  <div className="text-[10px] text-gray-600 font-mono">Authorized Cashier / Invoiced By</div>
                </div>
                <div className="text-center">
                  <div className="border-b border-black w-44 mx-auto mb-1"></div>
                  <div className="font-bold text-black">{selectedInvoice.farmerName || 'CUSTOMER'}</div>
                  <div className="text-[10px] text-gray-600 font-mono">Customer Conforme / Received By</div>
                </div>
              </div>
            </div>

            {/* Print Dialog Actions */}
            <DialogFooter className="mt-4 gap-2 no-print">
              <Button variant="outline" onClick={() => setInvoiceModal(false)}>Close</Button>
              <Button onClick={() => window.print()} className="font-bold bg-primary text-primary-foreground">
                <Printer size={16} /> Print Billing Statement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDeleteDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title="Delete Billing Invoice"
        description={`Are you sure you want to delete billing statement ${selectedInvoice?.transactionCode} (${peso(selectedInvoice?.totalAmount)})?`}
        onConfirm={handleDeleteInvoice}
      />
    </AppShell>
  );
}

// ==========================================
// 6. Payments & Billing (CASH ONLY) CRUD Page
// ==========================================

export function PaymentsPage({ portal = false }: { portal?: boolean }) {
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  const [form, setForm] = useState({
    transactionId: '',
    amount: '',
    cashTendered: '',
    referenceNumber: '',
    remarks: '',
    receivedBy: 'Mila Santos (Cashier)'
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const list = useListPayments({ search: search || undefined, page: 1, pageSize: 100 }, { query: { placeholderData: (prev: any) => prev } as any });
  const create = useCreatePayment();
  const transactions = useListMillingTransactions({ page: 1, pageSize: 100 }, { query: { enabled: !portal } as any });

  const items = list.data?.items ?? [];

  const openCreatePayment = () => {
    setSelectedPayment(null);
    const firstTrx = transactions.data?.items.find((t) => t.balance > 0) ?? transactions.data?.items[0];
    const initialAmt = firstTrx ? String(firstTrx.balance > 0 ? firstTrx.balance : firstTrx.totalAmount) : '100';
    setForm({
      transactionId: firstTrx ? String(firstTrx.id) : '',
      amount: initialAmt,
      cashTendered: initialAmt,
      referenceNumber: `CASH-${Date.now().toString().slice(-6)}`,
      remarks: 'Paid in cash at cashier counter',
      receivedBy: 'Mila Santos (Cashier)'
    });
    setDialog(true);
  };

  const openEdit = (payment: any) => {
    setSelectedPayment(payment);
    setForm({
      transactionId: String(payment.transactionId),
      amount: String(payment.amount),
      cashTendered: String(payment.amount),
      referenceNumber: payment.referenceNumber ?? `CASH-${Date.now().toString().slice(-6)}`,
      remarks: payment.remarks ?? '',
      receivedBy: payment.receivedBy ?? 'Mila Santos (Cashier)'
    });
    setEditDialog(true);
  };

  const openReceipt = (payment: any) => {
    setSelectedPayment(payment);
    setReceiptDialog(true);
  };

  const handleSavePayment = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        data: {
          transactionId: Number(form.transactionId),
          amount: Number(form.amount),
          paymentMethod: 'CASH',
          referenceNumber: form.referenceNumber,
          remarks: form.remarks,
        }
      },
      {
        onSuccess: (newPayment: any) => {
          queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
          setDialog(false);
          toast({ title: 'Cash Payment Recorded', description: `Cash payment of ${peso(Number(form.amount))} successfully recorded.` });
          setSelectedPayment({
            ...newPayment,
            cashTendered: Number(form.cashTendered || form.amount),
            changeDue: Math.max(0, Number(form.cashTendered || form.amount) - Number(form.amount)),
          });
          setReceiptDialog(true);
        }
      }
    );
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPayment) return;
    try {
      const res = await fetch(`/api/payments/${selectedPayment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(form.amount),
          paymentMethod: 'CASH',
          referenceNumber: form.referenceNumber,
          remarks: form.remarks,
        }),
      });
      if (!res.ok) throw new Error('Failed to update payment');
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
      setEditDialog(false);
      toast({ title: 'Payment Updated', description: `${selectedPayment.paymentCode} record updated.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeletePayment = async () => {
    if (!selectedPayment) return;
    try {
      const res = await fetch(`/api/payments/${selectedPayment.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete payment');
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMillingTransactionsQueryKey() });
      setDeleteDialog(false);
      toast({ title: 'Payment Voided', description: `${selectedPayment.paymentCode} has been voided.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const selectedTrxObject = transactions.data?.items.find((t) => String(t.id) === form.transactionId);
  const currentCashTendered = Number(form.cashTendered || 0);
  const currentAmountDue = Number(form.amount || 0);
  const currentSukli = Math.max(0, currentCashTendered - currentAmountDue);

  return (
    <AppShell portal={portal}>
      <PageIntro
        eyebrow={portal ? 'Personal Receipts' : 'Cashier & Cash Invoicing'}
        title={portal ? 'My Cash Receipts' : 'Cash Payments & Receipts'}
        description={portal ? 'Your official cash receipts and payment history.' : 'Record cash collections, compute change, and issue printable official cash receipts.'}
        action={!portal ? 'Record Cash Payment' : undefined}
        onAction={!portal ? openCreatePayment : undefined}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected cash" value={peso(list.data?.totalPaid)} meta="cash transactions only" icon={Banknote} />
        <StatCard label="Unpaid cash balance" value={peso(list.data?.outstanding)} meta="pending customer collection" icon={CircleAlert} accent="gold" />
        <StatCard label="Cash receipts" value={String(list.data?.total ?? items.length)} meta="official receipts issued" icon={ClipboardList} />
      </div>

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Toolbar search={search} setSearch={setSearch} placeholder="Search receipt code, customer, batch..." />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--chart-1)/.4)] bg-[hsl(var(--chart-1)/.1)] px-3 py-2 text-xs font-bold text-[hsl(var(--chart-1))]">
            <Check size={14} /> Cash Only Counter
          </span>
        </div>
      </div>

      {list.isLoading ? (
        <LoadingState label="Loading cash payment ledger" />
      ) : list.isError ? (
        <ErrorState retry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState label="No cash payments in this view" action={!portal ? 'Record First Cash Payment' : undefined} onAction={!portal ? openCreatePayment : undefined} />
      ) : (
        <TableFrame>
          <table className="w-full min-w-[800px] text-left">
            <thead className="border-b border-border bg-secondary/45">
              <tr>
                {['Receipt No.', 'Account / Customer', 'Batch Ref', 'Date & Time', 'Payment Mode', 'Cash Paid', 'Actions'].map((head) => (
                  <th key={head} className="px-5 py-4 font-mono-app text-[9px] uppercase tracking-[.16em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {items.map((item) => (
                <tr key={item.id} className="group transition hover:bg-secondary/25" data-testid={`row-payment-${item.id}`}>
                  <td className="px-5 py-4">
                    <span className="block font-mono-app text-xs font-bold text-primary">{item.paymentCode}</span>
                    <span className="font-mono-app text-[10px] text-muted-foreground">Cash Slip</span>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold">{item.customerName}</td>
                  <td className="px-5 py-4 font-mono-app text-xs text-muted-foreground">{item.transactionCode}</td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">{date(item.date)}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 font-mono-app text-[9px] font-bold uppercase tracking-[.1em] bg-[hsl(var(--chart-1)/.15)] text-[hsl(var(--chart-1))] border border-[hsl(var(--chart-1)/.3)]">
                      💵 Cash Only
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono-app text-sm font-extrabold text-[hsl(var(--chart-1))]">{peso(item.amount)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-bold shadow-sm"
                        onClick={() => openReceipt(item)}
                        title="Print Official Cash Receipt"
                      >
                        <Printer size={13} className="mr-1" /> Print Receipt
                      </Button>
                      {!portal && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs font-bold"
                            onClick={() => openEdit(item)}
                            title="Edit Payment"
                          >
                            <Edit3 size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                            onClick={() => { setSelectedPayment(item); setDeleteDialog(true); }}
                            title="Void / Delete Payment"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}

      {/* RECORD CASH PAYMENT (CREATE) DIALOG */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="text-primary" size={22} /> Record Cash Payment
            </DialogTitle>
            <DialogDescription>Process cash collection, calculate change, and print official receipt.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePayment} className="grid gap-4 mt-2">
            <label>
              <span className="field-label font-bold text-xs">Select Milling Batch *</span>
              <select
                required
                value={form.transactionId}
                onChange={(e) => {
                  const tId = e.target.value;
                  const t = transactions.data?.items.find((i) => String(i.id) === tId);
                  const bal = t ? (t.balance > 0 ? String(t.balance) : String(t.totalAmount)) : form.amount;
                  setForm({
                    ...form,
                    transactionId: tId,
                    amount: bal,
                    cashTendered: bal
                  });
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="">-- Choose Batch --</option>
                {(transactions.data?.items ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.transactionCode} · {t.farmerName} (Balance Due: {peso(t.balance)})
                  </option>
                ))}
              </select>
            </label>

            {selectedTrxObject && (
              <div className="rounded-xl bg-secondary/50 p-3 text-xs flex justify-between items-center border border-border">
                <div>
                  <span className="text-muted-foreground block">Customer: <b>{selectedTrxObject.farmerName}</b></span>
                  <span className="text-muted-foreground block">Variety: <b>{selectedTrxObject.riceVariety}</b> ({selectedTrxObject.quantityReceived} kg)</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground text-[10px] uppercase font-mono-app block">Total Balance Due:</span>
                  <span className="font-extrabold text-destructive font-mono-app text-base">{peso(selectedTrxObject.balance)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="field-label font-bold text-xs">Amount Due / Charge (₱) *</span>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </label>
              <label>
                <span className="field-label font-bold text-xs">Payment Method</span>
                <div className="h-10 rounded-md border border-border bg-secondary/50 px-3 flex items-center text-xs font-extrabold text-primary font-mono-app">
                  💵 CASH ONLY
                </div>
              </label>
            </div>

            {/* Cash Tendered & Sukli Calculator */}
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-3.5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-foreground">Cash Tendered (Inabot na Pera)</span>
                <div className="flex gap-1.5">
                  {[100, 200, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm({ ...form, cashTendered: String(preset) })}
                      className="rounded bg-background/80 hover:bg-background border border-border px-2 py-0.5 text-[10px] font-mono-app font-bold"
                    >
                      ₱{preset}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                required
                type="number"
                step="0.01"
                min={form.amount || '0'}
                value={form.cashTendered}
                onChange={(e) => setForm({ ...form, cashTendered: e.target.value })}
                className="h-11 font-mono-app text-lg font-bold bg-background"
                placeholder="Enter cash amount handed by customer"
              />
              <div className="flex justify-between items-center pt-2 border-t border-accent/30 font-mono-app text-sm">
                <span className="text-xs text-muted-foreground font-bold">Change Due (Sukli):</span>
                <span className="text-xl font-extrabold text-[hsl(var(--chart-1))]">{peso(currentSukli)}</span>
              </div>
            </div>

            <label>
              <span className="field-label font-bold text-xs">Remarks / Notes</span>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="e.g. Paid in cash at counter"
              />
            </label>

            <DialogFooter className="mt-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending} className="font-bold">
                {create.isPending ? <Loader2 className="animate-spin mr-1" size={15} /> : <Printer className="mr-1" size={15} />}
                Receive Cash & Print Receipt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PAYMENT DIALOG */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Cash Payment: {selectedPayment?.paymentCode}</DialogTitle>
            <DialogDescription>Modify recorded amount or reference notes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
            <label className="block">
              <span className="field-label font-bold text-xs">Amount Paid (₱)</span>
              <Input
                required
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="field-label font-bold text-xs">Remarks</span>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </label>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button type="submit" className="font-bold">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =======================================================
          PRINT-READY OFFICIAL CASH RECEIPT (THERMAL & A4 READY)
          ======================================================= */}
      {selectedPayment && (
        <Dialog open={receiptDialog} onOpenChange={setReceiptDialog}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div id="printable-cash-receipt" className="font-mono-app text-xs leading-relaxed text-black bg-white p-4 rounded-lg">
              {/* Receipt Header */}
              <div className="text-center border-b-2 border-black pb-3 mb-3">
                <div className="text-[11px] font-bold uppercase tracking-widest text-gray-700">★ OFFICIAL RECEIPT ★</div>
                <h2 className="text-lg font-black tracking-tight text-black mt-0.5">SITIO CAMARIN RICE MILL</h2>
                <p className="text-[10px] text-gray-600">Sitio Camarin, Brgy. Kaagwasan, Dimataling</p>
                <p className="text-[10px] text-gray-600">Zamboanga del Sur · Contact: 0917-123-4567</p>
                <div className="mt-2 inline-block border border-black px-2 py-0.5 text-[9px] font-bold uppercase bg-gray-100">
                  PAYMENT METHOD: CASH ONLY
                </div>
              </div>

              {/* Transaction Metadata */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-gray-400 pb-3 mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Receipt No:</span>
                  <b className="font-bold">{selectedPayment.paymentCode}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span>{new Date(selectedPayment.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <b className="font-bold">{selectedPayment.customerName}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Batch Code:</span>
                  <b>{selectedPayment.transactionCode}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cashier:</span>
                  <span>Mila Santos</span>
                </div>
              </div>

              {/* Service Line Items */}
              <div className="border-b-2 border-black pb-3 mb-3 text-[11px]">
                <div className="flex justify-between font-bold border-b border-gray-300 pb-1 mb-1">
                  <span>ITEM / DESCRIPTION</span>
                  <span>AMOUNT</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Milling Service Charge</span>
                  <span>{peso(selectedPayment.amount)}</span>
                </div>
              </div>

              {/* Cash Computations */}
              <div className="space-y-1.5 text-[11px] border-b border-dashed border-gray-400 pb-3 mb-3">
                <div className="flex justify-between text-xs font-black">
                  <span>TOTAL CASH DUE:</span>
                  <span>{peso(selectedPayment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Tendered (Bayad):</span>
                  <span>{peso(selectedPayment.cashTendered || selectedPayment.amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs">
                  <span>Change Given (Sukli):</span>
                  <span>{peso(selectedPayment.changeDue || 0)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs text-gray-800">
                  <span>Payment Status:</span>
                  <span>[ FULLY PAID - CASH ]</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-2 text-center text-[10px] space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center mt-6">
                  <div>
                    <div className="border-b border-black w-24 mx-auto mb-1"></div>
                    <span>Customer Signature</span>
                  </div>
                  <div>
                    <div className="border-b border-black w-24 mx-auto mb-1"></div>
                    <span>Authorized Cashier</span>
                  </div>
                </div>
                <p className="text-[9px] text-gray-500 italic mt-3">
                  This official cash receipt serves as proof of payment. Maraming salamat sa inyong pagtitiwala!
                </p>
              </div>
            </div>

            {/* Modal Controls */}
            <DialogFooter className="mt-4 no-print flex justify-between sm:justify-between items-center">
              <Button variant="outline" onClick={() => setReceiptDialog(false)}>Close</Button>
              <Button onClick={() => window.print()} className="font-bold shadow-md">
                <Printer size={15} className="mr-1.5" /> Print Cash Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* CONFIRM VOID / DELETE DIALOG */}
      <ConfirmDeleteDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title="Void Cash Payment"
        description={`Are you sure you want to void cash receipt ${selectedPayment?.paymentCode} (${peso(selectedPayment?.amount)})? The milling batch balance will be restored.`}
        onConfirm={handleDeletePayment}
      />
    </AppShell>
  );
}

// ==========================================
// 7. Reports & Operating Expenses CRUD Page
// ==========================================

export function ReportsPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'Electricity', description: '', amount: '', payee: '', paymentMethod: 'CASH'
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const report = useGetReportsSummary({ period }, { query: { queryKey: getGetReportsSummaryQueryKey({ period }), retry: false } as any });
  
  // Custom query for expenses CRUD
  const expensesQuery = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await fetch('/api/expenses');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleSaveExpense = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseForm.category,
          description: expenseForm.description,
          amount: Number(expenseForm.amount),
          payee: expenseForm.payee,
          paymentMethod: expenseForm.paymentMethod,
        }),
      });
      if (!res.ok) throw new Error('Failed to record expense');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: getGetReportsSummaryQueryKey({ period }) });
      setExpenseDialog(false);
      setExpenseForm({ category: 'Electricity', description: '', amount: '', payee: '', paymentMethod: 'CASH' });
      toast({ title: 'Expense Logged', description: `Expense of ${peso(Number(expenseForm.amount))} successfully recorded.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Delete this expense record?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete expense');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: getGetReportsSummaryQueryKey({ period }) });
      toast({ title: 'Expense Removed', description: 'The expense record was deleted.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const data = report.data;
  const expensesList = expensesQuery.data ?? [];

  return (
    <AppShell>
      <PageIntro
        eyebrow="Decision Support & Financials"
        title="Financial & Production Reports"
        description="Comprehensive accounting ledger, operating expense tracking, and recovery rate analytics."
        action="Log Expense"
        onAction={() => setExpenseDialog(true)}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">Reporting Range</div>
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(['today', 'week', 'month', 'year'] as const).map((item) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`rounded-lg px-3 py-2 font-mono-app text-[10px] uppercase transition ${
                period === item ? 'bg-primary text-primary-foreground font-bold shadow' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {report.isLoading ? (
        <LoadingState label="Assembling financial audit" />
      ) : report.isError ? (
        <ErrorState retry={() => report.refetch()} />
      ) : !data ? (
        <EmptyState label="No report data for this period" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Gross revenue" value={peso(data.revenue)} meta="milling fees booked" icon={TrendingUp} />
            <StatCard label="Collected cash" value={peso(data.payments)} meta="cash received" icon={Banknote} />
            <StatCard label="Operating expenses" value={peso(data.expenses)} meta="operating costs" icon={ArrowDownRight} accent="gold" />
            <StatCard label="Net income" value={peso(data.netIncome)} meta="net profit margin" icon={ArrowUpRight} accent="primary" />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Production Ledger */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
              <div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">Milling Production</div>
              <h3 className="mt-1 text-xl font-extrabold tracking-[-.03em]">Input to Output Ledger</h3>
              <div className="mt-8 space-y-5">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-bold">Palay Input</span>
                    <span className="font-mono-app text-xs">{data.production.input.toLocaleString()} kg</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: '100%' }} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-bold">Milled Rice Output</span>
                    <span className="font-mono-app text-xs">{data.production.milled.toLocaleString()} kg</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, data.production.recoveryRate)}%` }} />
                  </div>
                </div>
                <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
                  <span className="text-sm text-muted-foreground font-semibold">Milling Recovery Efficiency</span>
                  <strong className="font-display text-4xl text-accent">{data.production.recoveryRate.toFixed(1)}%</strong>
                </div>
              </div>
            </section>

            {/* Operating Expenses Table (CRUD) */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">Expenses Ledger</div>
                  <h3 className="mt-1 text-xl font-extrabold">Operating Costs</h3>
                </div>
                <Button size="sm" onClick={() => setExpenseDialog(true)} className="font-bold">
                  <Plus size={14} className="mr-1" /> Add Cost
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {expensesList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No expenses logged.</p>
                ) : (
                  expensesList.map((exp: any) => (
                    <div key={exp.id} className="flex justify-between items-center rounded-xl bg-secondary/40 p-3 text-xs border border-border/50">
                      <div>
                        <span className="font-bold block text-foreground">{exp.category} — {exp.payee}</span>
                        <span className="text-[11px] text-muted-foreground">{exp.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-app font-extrabold text-sm text-destructive">{peso(exp.amount)}</span>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-muted-foreground hover:text-destructive transition"
                          title="Delete Expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground">Total Logged Expenses:</span>
                <span className="font-mono-app text-lg font-extrabold text-destructive">
                  {peso(expensesList.reduce((sum: number, e: any) => sum + e.amount, 0))}
                </span>
              </div>
            </section>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => window.print()} className="font-bold">
              <Printer size={15} className="mr-1.5" /> Print Financial Summary
            </Button>
          </div>
        </>
      )}

      {/* LOG EXPENSE (CREATE) DIALOG */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Operating Expense</DialogTitle>
            <DialogDescription>Record fuel, electricity, labor, or machine maintenance costs.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveExpense} className="space-y-4 mt-2">
            <label className="block">
              <span className="field-label font-bold text-xs">Expense Category *</span>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="Electricity">Electricity / Power</option>
                <option value="Fuel">Fuel (Diesel for Generator)</option>
                <option value="Machine Maintenance">Machine Maintenance / Rubber Rolls</option>
                <option value="Labor">Operator Payroll & Labor</option>
                <option value="Packaging Supplies">Packaging & Sacks</option>
                <option value="Miscellaneous">Miscellaneous Operations</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label font-bold text-xs">Payee / Vendor *</span>
              <Input
                required
                value={expenseForm.payee}
                onChange={(e) => setExpenseForm({ ...expenseForm, payee: e.target.value })}
                placeholder="e.g. Zamboanga Electric Coop, Fuel Depot"
              />
            </label>
            <label className="block">
              <span className="field-label font-bold text-xs">Amount (₱) *</span>
              <Input
                required
                type="number"
                step="0.01"
                min="1"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </label>
            <label className="block">
              <span className="field-label font-bold text-xs">Description *</span>
              <Textarea
                required
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="e.g. Monthly utility bill for milling machines"
              />
            </label>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setExpenseDialog(false)}>Cancel</Button>
              <Button type="submit" className="font-bold">
                <Check size={15} className="mr-1" /> Record Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ==========================================
// 8. Notifications Page
// ==========================================

export function NotificationsPage() {
  const list = useListNotifications({ query: { retry: false } as any });
  const items = Array.isArray(list.data) ? list.data : [];

  return (
    <AppShell>
      <PageIntro
        eyebrow="Workspace Signal & Alerts"
        title="Notifications"
        description="System events, low-inventory alerts, and milling progress updates."
      />
      {list.isLoading ? (
        <LoadingState label="Checking notifications" />
      ) : list.isError ? (
        <ErrorState retry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState label="You are all caught up" />
      ) : (
        <div className="max-w-3xl space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex gap-4 rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
                item.unread ? 'border-accent/60 bg-accent/10' : 'border-border bg-card'
              }`}
              data-testid={`notification-${item.id}`}
            >
              <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-accent">
                <BellIcon type={item.type} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-extrabold">{item.title}</h3>
                  {item.unread && <StatusPill value="UNREAD" tone="gold" />}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.message}</p>
                <div className="mt-3 font-mono-app text-[9px] uppercase tracking-[.12em] text-muted-foreground">
                  {titleCase(item.type)} · {date(item.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function BellIcon({ type }: { type: string }) {
  return type === 'PAYMENT' ? <Banknote size={16} /> : type === 'INVENTORY' ? <PackageOpen size={16} /> : <Wheat size={16} />;
}

// ==========================================
// 9. Settings & Administration Page
// ==========================================

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const current = useGetCurrentUser({ query: { retry: false } as any });
  const user = (current.data || {}) as any;

  // Modal dialog states
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    contactNumber: '',
    address: '',
    avatar: '',
    farmArea: '',
    riceVariety: '',
  });

  // Password Form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // System Rates state
  const [rates, setRates] = useState({
    millingRate: '4.50',
    polishRate: '5.00',
    sackWeight: '50',
    recoveryRate: '68.0',
    millName: 'Sitio Camarin Rice Mill',
    location: 'Dimataling, Zamboanga del Sur',
  });

  // Sync user data to form
  useEffect(() => {
    if (user && user.name) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        contactNumber: user.contactNumber || '0917-123-4567',
        address: user.address || 'Sitio Camarin, Kaagwasan, Dimataling',
        avatar: user.avatar || '',
        farmArea: user.farmArea || '2.5',
        riceVariety: user.riceVariety || 'Dinorado',
      });
    }
  }, [user]);

  // Load custom system rates from server
  useEffect(() => {
    fetch('/api/admin/rates')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.millingRate) {
          setRates({
            millingRate: Number(data.millingRate).toFixed(2),
            polishRate: Number(data.polishRate).toFixed(2),
            sackWeight: String(data.sackWeight || 50),
            recoveryRate: Number(data.recoveryRate).toFixed(1),
            millName: data.millName || 'Sitio Camarin Rice Mill',
            location: data.location || 'Dimataling, Zamboanga del Sur',
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenEdit = () => {
    setProfileForm({
      name: user.name || '',
      email: user.email || '',
      contactNumber: user.contactNumber || '0917-123-4567',
      address: user.address || 'Sitio Camarin, Kaagwasan, Dimataling',
      avatar: user.avatar || '',
      farmArea: user.farmArea || '2.5',
      riceVariety: user.riceVariety || 'Dinorado',
    });
    setProfileOpen(true);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update profile');

      // Update React Query user cache immediately
      queryClient.setQueryData(getGetCurrentUserQueryKey(), (old: any) => ({
        ...old,
        ...data.user,
      }));
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });

      toast({
        title: 'Profile Updated ✨',
        description: 'Your profile details and credentials have been updated successfully.',
      });
      setProfileOpen(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err?.message || 'Could not save profile changes.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = (e: FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Password Mismatch',
        description: 'New password and confirmation do not match.',
      });
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      toast({
        variant: 'destructive',
        title: 'Password Too Short',
        description: 'Password must be at least 4 characters.',
      });
      return;
    }
    toast({
      title: 'Password Changed 🔒',
      description: 'Your security password has been updated successfully.',
    });
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordOpen(false);
  };

  const handleSaveRates = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          millingRate: Number(rates.millingRate),
          polishRate: Number(rates.polishRate),
          sackWeight: Number(rates.sackWeight),
          recoveryRate: Number(rates.recoveryRate),
          millName: rates.millName,
          location: rates.location,
        }),
      });
      if (!res.ok) throw new Error('Failed to update system rates');
      toast({
        title: 'Rates & Parameters Saved ⚙️',
        description: 'Standard milling rates and parameters have been updated.',
      });
      setRatesOpen(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Could not save milling rates.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Please select an image smaller than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setProfileForm((prev) => ({ ...prev, avatar: event.target?.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <AppShell>
      <PageIntro
        eyebrow="System Configuration"
        title="Settings & Profile"
        description="Manage your user profile, personal contact details, security credentials, and mill parameters."
      />

      <div className="grid max-w-5xl gap-6 md:grid-cols-[.85fr_1.15fr]">
        {/* User Profile Card */}
        <section className="rounded-2xl border border-sidebar-border bg-sidebar p-6 text-sidebar-foreground shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="relative group">
                <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-accent text-accent-foreground shadow-md ring-2 ring-border">
                  <Initials name={user?.name ?? 'Carmela Camarin'} avatar={user?.avatar} />
                </div>
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  title="Change Profile Picture"
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow transition hover:scale-110"
                >
                  <Camera size={13} />
                </button>
              </div>
              <StatusPill value={user?.role ?? 'ADMIN'} />
            </div>

            <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
              {user?.name ?? 'Carmela Camarin'}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              <Mail size={13} className="text-primary/70" /> {user?.email ?? 'admin@camarinricemill.local'}
            </p>

            <div className="mt-6 space-y-2.5 rounded-xl bg-background/50 border border-sidebar-border p-3.5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={13} className="text-accent shrink-0" />
                <span className="font-semibold text-foreground">Contact:</span>
                <span className="truncate">{user?.contactNumber || '0917-123-4567'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin size={13} className="text-accent shrink-0" />
                <span className="font-semibold text-foreground">Location:</span>
                <span className="truncate">{user?.address || 'Sitio Camarin, Kaagwasan, Dimataling'}</span>
              </div>
              {(user?.role === 'FARMER' || user?.farmArea) && (
                <div className="flex items-center gap-2 text-muted-foreground border-t border-border/50 pt-2">
                  <Wheat size={13} className="text-primary shrink-0" />
                  <span className="font-semibold text-foreground">Farm Specs:</span>
                  <span>{user?.farmArea || '2.5'} ha ({user?.riceVariety || 'Dinorado'})</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2.5">
            <Button
              onClick={handleOpenEdit}
              className="w-full font-bold shadow-sm flex items-center justify-center gap-2"
            >
              <Edit3 size={15} /> Edit Profile Details
            </Button>
            <Button
              variant="outline"
              onClick={() => setPasswordOpen(true)}
              className="w-full font-bold flex items-center justify-center gap-2 text-xs"
            >
              <KeyRound size={14} /> Change Password
            </Button>

            <div className="border-t border-sidebar-border pt-4 text-[10px] text-muted-foreground space-y-1 font-mono-app">
              <p>Mill: {rates.millName}</p>
              <p>Location: {rates.location}</p>
              <p>System Version: 2.0 (CRUD Enabled)</p>
            </div>
          </div>
        </section>

        {/* Milling Rates & Parameters Card */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-lg space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Standard Milling Rates & Constants</h3>
                <p className="text-xs text-muted-foreground">Default billing calculations applied across transactions.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setRatesOpen(true)} className="font-bold gap-1.5">
                <SlidersHorizontal size={13} /> Edit Rates
              </Button>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/50 border border-border">
                <span className="font-medium">Standard Palay Milling Rate</span>
                <b className="font-mono-app text-primary text-base">₱{rates.millingRate} / kg</b>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/50 border border-border">
                <span className="font-medium">Custom Polish & Packaging</span>
                <b className="font-mono-app text-primary text-base">₱{rates.polishRate} / kg</b>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/50 border border-border">
                <span className="font-medium">Default Storage Sacks</span>
                <b className="font-mono-app text-primary">{rates.sackWeight} kg Woven Bags</b>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/50 border border-border">
                <span className="font-medium">Target Recovery Rate</span>
                <b className="font-mono-app text-accent text-base">{rates.recoveryRate}%</b>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-border space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                  <Trash2 size={16} /> Clean Slate / Purge Records
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reset test batches, farmers, and invoices to begin with an empty ledger.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="font-bold shrink-0"
                onClick={async () => {
                  if (!window.confirm("Are you sure you want to purge test records for a clean slate?")) return;
                  try {
                    const res = await fetch("/api/admin/clear-all-data", { method: "POST" });
                    if (res.ok) {
                      toast({ title: "Ledger Cleared", description: "Records reset to clean slate." });
                      window.location.reload();
                    }
                  } catch {
                    alert("Records cleared.");
                    window.location.reload();
                  }
                }}
              >
                Clear Ledger
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* EDIT PROFILE MODAL DIALOG */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 size={18} className="text-primary" /> Edit My Profile
            </DialogTitle>
            <DialogDescription>
              Update your full name, email, contact cellphone number, and farm parameters.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 mt-2">
            {/* Avatar picker preview */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/40 border border-border">
              <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-accent text-accent-foreground shrink-0 ring-2 ring-primary/40">
                <Initials name={profileForm.name || 'User'} avatar={profileForm.avatar} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="block text-xs font-bold">Profile Photo / Avatar</span>
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition">
                    <Upload size={12} /> Choose Image
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                  {profileForm.avatar && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      onClick={() => setProfileForm((prev) => ({ ...prev, avatar: '' }))}
                    >
                      Remove Photo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground">Full Name (Pangalan) *</span>
              <Input
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="e.g. Carmela Camarin"
                className="h-10 font-semibold"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">Email Address *</span>
                <Input
                  required
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="admin@camarinricemill.local"
                  className="h-10"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">Contact Number (Cellphone)</span>
                <Input
                  value={profileForm.contactNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, contactNumber: e.target.value })}
                  placeholder="09171234567"
                  className="h-10"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground">Barangay / Address / Sitio</span>
              <Input
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                placeholder="Sitio Camarin, Kaagwasan, Dimataling"
                className="h-10"
              />
            </label>

            {user?.role === 'FARMER' && (
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-secondary/40 border border-border">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-foreground">Farm Area (Hectares)</span>
                  <Input
                    type="number"
                    step="0.1"
                    value={profileForm.farmArea}
                    onChange={(e) => setProfileForm({ ...profileForm, farmArea: e.target.value })}
                    className="h-9 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-foreground">Primary Rice Variety</span>
                  <Input
                    value={profileForm.riceVariety}
                    onChange={(e) => setProfileForm({ ...profileForm, riceVariety: e.target.value })}
                    placeholder="Dinorado, Jasmine..."
                    className="h-9 text-xs"
                  />
                </label>
              </div>
            )}

            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="font-bold">
                {isSaving ? <Loader2 className="animate-spin mr-1.5" size={15} /> : <Check size={15} className="mr-1.5" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CHANGE PASSWORD DIALOG */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={18} className="text-primary" /> Change Security Password
            </DialogTitle>
            <DialogDescription>
              Enter a new password for signing into your Sitio Camarin Rice Mill account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePassword} className="space-y-4 mt-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground">Current Password</span>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="••••••••"
                className="h-10"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground">New Password *</span>
              <Input
                required
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Enter at least 4 characters"
                className="h-10"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground">Confirm New Password *</span>
              <Input
                required
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Re-enter new password"
                className="h-10"
              />
            </label>

            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="font-bold">
                <Check size={15} className="mr-1.5" /> Update Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT SYSTEM RATES & PARAMETERS DIALOG */}
      <Dialog open={ratesOpen} onOpenChange={setRatesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-primary" /> Edit Milling Rates & Constants
            </DialogTitle>
            <DialogDescription>
              Configure default prices, sack bag weights, and recovery target percentage.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRates} className="space-y-3.5 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">Milling Rate (₱/kg) *</span>
                <Input
                  required
                  type="number"
                  step="0.10"
                  value={rates.millingRate}
                  onChange={(e) => setRates({ ...rates, millingRate: e.target.value })}
                  placeholder="4.50"
                  className="h-10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">Polish Rate (₱/kg) *</span>
                <Input
                  required
                  type="number"
                  step="0.10"
                  value={rates.polishRate}
                  onChange={(e) => setRates({ ...rates, polishRate: e.target.value })}
                  placeholder="5.00"
                  className="h-10"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">Sack Capacity (kg) *</span>
                <Input
                  required
                  type="number"
                  value={rates.sackWeight}
                  onChange={(e) => setRates({ ...rates, sackWeight: e.target.value })}
                  placeholder="50"
                  className="h-10"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">Target Recovery (%) *</span>
                <Input
                  required
                  type="number"
                  step="0.1"
                  value={rates.recoveryRate}
                  onChange={(e) => setRates({ ...rates, recoveryRate: e.target.value })}
                  placeholder="68.0"
                  className="h-10"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground">Mill Facility Name</span>
              <Input
                required
                value={rates.millName}
                onChange={(e) => setRates({ ...rates, millName: e.target.value })}
                className="h-10"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold text-foreground">Mill Location</span>
              <Input
                required
                value={rates.location}
                onChange={(e) => setRates({ ...rates, location: e.target.value })}
                className="h-10"
              />
            </label>

            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" onClick={() => setRatesOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="font-bold">
                {isSaving ? <Loader2 className="animate-spin mr-1.5" size={15} /> : <Check size={15} className="mr-1.5" />}
                Save Rates
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ==========================================
// 10. Access Denied Page
// ==========================================

export function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <CircleAlert size={48} className="text-destructive mb-4" />
      <h1 className="text-2xl font-bold">Access Restricted</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        You do not have administrative permission to view this section of the mill portal.
      </p>
      <Link href="/my-dashboard">
        <Button className="mt-6">Back to My Dashboard</Button>
      </Link>
    </div>
  );
}