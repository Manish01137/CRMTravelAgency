import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { Activity, Building2, LayoutDashboard, LogOut, ShieldCheck, UsersRound } from 'lucide-react';
import { usePlatformAdminAuth } from '@/context/PlatformAdminAuthContext';
import { cn } from '@/lib/utils';
import { GlobalSearch } from './GlobalSearch';

const NAV = [
  { to: '/owner', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/owner/organizations', label: 'Organizations', icon: Building2, end: false },
  { to: '/owner/users', label: 'Users', icon: UsersRound, end: false },
  { to: '/owner/channel-health', label: 'Channel Health', icon: Activity, end: false },
  { to: '/owner/audit-log', label: 'Audit Log', icon: ShieldCheck, end: false },
];

export function OwnerShell({ children }: { children: ReactNode }) {
  const { admin, logout } = usePlatformAdminAuth();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
  };

  return (
    <div className="min-h-dvh bg-[#0b0d12] text-white">
      <div className="flex min-h-dvh">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-white/[0.02] p-4 sm:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">Owner Panel</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-white/60 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 pt-3">
            <p className="truncate px-2 text-xs text-white/40">{admin?.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-8 sm:py-8">
          <div className="mb-6">
            <GlobalSearch />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
