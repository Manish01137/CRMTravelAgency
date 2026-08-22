import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { Activity, Building2, LayoutDashboard, LogOut, ShieldCheck, UsersRound } from 'lucide-react';
import { usePlatformAdminAuth } from '@/context/PlatformAdminAuthContext';
import { cn } from '@/lib/utils';
import { GlobalSearch } from './GlobalSearch';
import { ACCENT_CLASSES, type OwnerAccent } from './theme';

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; end: boolean; accent: OwnerAccent }[] = [
  { to: '/owner', label: 'Dashboard', icon: LayoutDashboard, end: true, accent: 'indigo' },
  { to: '/owner/organizations', label: 'Organizations', icon: Building2, end: false, accent: 'violet' },
  { to: '/owner/users', label: 'Users', icon: UsersRound, end: false, accent: 'teal' },
  { to: '/owner/channel-health', label: 'Channel Health', icon: Activity, end: false, accent: 'amber' },
  { to: '/owner/audit-log', label: 'Audit Log', icon: ShieldCheck, end: false, accent: 'rose' },
];

export function OwnerShell({ children }: { children: ReactNode }) {
  const { admin, logout } = usePlatformAdminAuth();

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
  };

  return (
    <div className="relative min-h-dvh bg-[#07080c] text-white">
      {/* Ambient color washes — same premium background language as the login page. */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/3 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute bottom-[-14rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-secondary/10 blur-[130px]" />
      </div>

      <div className="relative flex min-h-dvh">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl sm:flex">
          <div className="mb-6 flex items-center gap-2.5 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-indigo-500 to-secondary text-white shadow-[0_4px_16px_rgba(79,70,229,0.4)]">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <span className="block font-display text-sm font-bold tracking-tight">Owner Panel</span>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-white/35">Joinetra</span>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon, end, accent }) => {
              const a = ACCENT_CLASSES[accent];
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                      isActive
                        ? cn('bg-gradient-to-r text-white', a.gradient, a.glow)
                        : 'text-white/55 hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'flex size-6 items-center justify-center rounded-lg transition-colors',
                          isActive ? 'bg-white/15' : cn(a.bg, a.text, 'group-hover:brightness-125'),
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      {label}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
          <div className="border-t border-white/10 pt-3">
            <p className="truncate px-2 text-xs text-white/40">{admin?.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-white/55 transition-colors hover:bg-white/5 hover:text-white"
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
