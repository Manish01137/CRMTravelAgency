import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  Building2,
  CalendarCheck2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { usePlatformAdminAuth } from '@/context/PlatformAdminAuthContext';
import { cn } from '@/lib/utils';
import { GlobalSearch } from './GlobalSearch';
import { ACCENT_CLASSES, type OwnerAccent } from './theme';

interface OwnerNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  accent: OwnerAccent;
}

const MAIN_NAV: OwnerNavItem[] = [
  { to: '/owner', label: 'Dashboard', icon: LayoutDashboard, end: true, accent: 'indigo' },
  { to: '/owner/organizations', label: 'Organizations', icon: Building2, accent: 'violet' },
  { to: '/owner/users', label: 'Users', icon: UsersRound, accent: 'teal' },
  { to: '/owner/leads', label: 'Leads', icon: TrendingUp, accent: 'sky' },
  { to: '/owner/bookings', label: 'Bookings', icon: CalendarCheck2, accent: 'fuchsia' },
];

const FINANCE_NAV: OwnerNavItem[] = [
  { to: '/owner/subscriptions', label: 'Active Subscriptions', icon: CreditCard, accent: 'violet' },
  { to: '/owner/revenue', label: 'Revenue', icon: TrendingUp, accent: 'teal' },
  { to: '/owner/expenses', label: 'Expenses', icon: TrendingDown, accent: 'rose' },
  { to: '/owner/profit', label: 'Profit', icon: Wallet, accent: 'amber' },
];

const OPS_NAV: OwnerNavItem[] = [
  { to: '/owner/system-health', label: 'System Health', icon: Activity, accent: 'sky' },
  { to: '/owner/channel-health', label: 'Channel Health', icon: Activity, accent: 'amber' },
  { to: '/owner/audit-log', label: 'Audit Log', icon: ShieldCheck, accent: 'rose' },
];

function NavGroup({ items }: { items: OwnerNavItem[] }) {
  return (
    <nav className="space-y-1">
      {items.map(({ to, label, icon: Icon, end, accent }) => {
        const a = ACCENT_CLASSES[accent];
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? a.navActive : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="flex-1">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function OwnerShell({ children }: { children: ReactNode }) {
  const { admin, logout } = usePlatformAdminAuth();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
  };

  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card md:flex">
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          <div className="mb-6 flex items-center gap-3 px-2 pt-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-500 text-white shadow-sm">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-foreground">Owner Panel</p>
              <p className="truncate text-xs text-muted-foreground">Joinetra</p>
            </div>
          </div>

          <div className="space-y-6">
            <NavGroup items={MAIN_NAV} />
            <div>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Finance</p>
              <NavGroup items={FINANCE_NAV} />
            </div>
            <div>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Operations</p>
              <NavGroup items={OPS_NAV} />
            </div>
          </div>
        </div>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{admin?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6">
            <GlobalSearch />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
