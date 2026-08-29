import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Bell, ChevronRight, CircleUserRound, LayoutDashboard, LogOut, Menu, Settings2, Sprout, UsersRound, Wheat, Warehouse, WalletCards, BarChart3, FileText, X } from 'lucide-react';
import { useGetCurrentUser, useListNotifications, useLogout } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';

type Role = 'ADMIN' | 'STAFF' | 'FARMER' | 'CUSTOMER';

const operations = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/farmers', label: 'Farmers & customers', icon: UsersRound },
  { href: '/milling', label: 'Milling pipeline', icon: Wheat },
  { href: '/inventory', label: 'Inventory', icon: Warehouse },
  { href: '/payments', label: 'Payments', icon: WalletCards },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];
const personal = [
  { href: '/my-dashboard', label: 'My overview', icon: LayoutDashboard },
  { href: '/my-transactions', label: 'My transactions', icon: Wheat },
  { href: '/my-payments', label: 'My payments', icon: WalletCards },
  { href: '/my-receipts', label: 'My receipts', icon: FileText },
];

export function Initials({ name }: { name: string }) {
  return <span className="grid h-full w-full place-items-center bg-[hsl(var(--accent))] text-sm font-extrabold text-[hsl(var(--accent-foreground))]">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>;
}

export function AppShell({ children, portal = false }: { children: ReactNode; portal?: boolean }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: user } = useGetCurrentUser({ query: { retry: false } });
  const { data: notifications } = useListNotifications({ query: { retry: false } });
  const logout = useLogout();
  const role = (user?.role ?? (portal ? 'FARMER' : 'ADMIN')) as Role;
  const isPortal = portal || role === 'FARMER' || role === 'CUSTOMER';
  const nav = isPortal ? personal : operations;
  const unread = notifications?.filter((item) => item.unread).length ?? 0;
  const current = useMemo(() => nav.find((item) => location === item.href)?.label ?? (location === '/notifications' ? 'Notifications' : location === '/settings' ? 'Settings' : 'Workspace'), [location, nav]);

  const signOut = () => logout.mutate(undefined, { onSuccess: () => setLocation('/') });
  return (
    <div className="grain min-h-[100dvh] bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[268px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-9 flex items-center justify-between px-3">
          <Link href={isPortal ? '/my-dashboard' : '/dashboard'} className="flex items-center gap-3" data-testid="link-brand">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_20px_hsl(var(--accent)/.16)]"><Sprout size={21} strokeWidth={2.5} /></span>
            <span><span className="block text-[15px] font-extrabold tracking-[-.03em]">Camarin</span><span className="font-mono-app block text-[9px] uppercase tracking-[.22em] text-sidebar-foreground/55">Rice Mill / {isPortal ? 'portal' : 'ops'}</span></span>
          </Link>
          <button className="rounded-lg p-2 hover:bg-sidebar-accent md:hidden" onClick={() => setOpen(false)} data-testid="button-close-menu"><X size={18} /></button>
        </div>
        <div className="px-3 pb-3 font-mono-app text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/40">{isPortal ? 'My account' : 'Operations desk'}</div>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${href.slice(1)}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-all ${location === href ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_8px_18px_hsl(var(--accent)/.12)]' : 'text-sidebar-foreground/66 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Icon size={17} strokeWidth={location === href ? 2.5 : 1.8} /><span className="flex-1">{label}</span>{location === href && <ChevronRight size={14} />}</Link>)}
        </nav>
        <div className="mt-8 px-3 pb-3 font-mono-app text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/40">Workspace</div>
        <nav className="space-y-1">
          <Link href="/notifications" onClick={() => setOpen(false)} data-testid="link-nav-notifications" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-all ${location === '/notifications' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/66 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Bell size={17} /><span className="flex-1">Notifications</span>{unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--chart-4))] px-1 text-[10px] font-bold text-white">{unread}</span>}</Link>
          <Link href="/settings" onClick={() => setOpen(false)} data-testid="link-nav-settings" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-all ${location === '/settings' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/66 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Settings2 size={17} /><span>Settings</span></Link>
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-3">
          <div className="flex items-center gap-3"><div className="h-9 w-9 overflow-hidden rounded-xl"><Initials name={user?.name ?? (isPortal ? 'Farmer' : 'Operator')} /></div><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold">{user?.name ?? (isPortal ? 'Farmer account' : 'Operations desk')}</div><div className="font-mono-app text-[9px] uppercase tracking-wider text-sidebar-foreground/45">{role.toLowerCase()}</div></div><button onClick={signOut} className="rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="button-logout"><LogOut size={15} /></button></div>
        </div>
      </aside>
      <div className="md:pl-[268px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-border/70 bg-background/85 px-5 backdrop-blur-xl md:px-8">
          <button className="rounded-xl border border-border bg-card p-2.5 md:hidden" onClick={() => setOpen(true)} data-testid="button-open-menu"><Menu size={18} /></button>
          <div className="min-w-0 flex-1"><div className="font-mono-app text-[9px] uppercase tracking-[.2em] text-muted-foreground">Sitio Camarin / {isPortal ? 'private view' : 'Dimataling operations'}</div><h1 className="truncate text-[18px] font-extrabold tracking-[-.04em] text-foreground">{current}</h1></div>
          <Link href="/notifications" className="relative rounded-xl border border-border bg-card p-2.5 text-muted-foreground transition hover:border-primary/30 hover:text-primary" data-testid="button-header-notifications"><Bell size={18} />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[hsl(var(--chart-4))]" />}</Link>
          <div className="hidden h-9 w-9 overflow-hidden rounded-xl border border-border sm:block"><Initials name={user?.name ?? (isPortal ? 'Farmer' : 'Operator')} /></div>
        </header>
        <main className="min-h-[calc(100dvh-72px)] p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}