import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, CalendarCheck2, ShieldAlert, TrendingUp, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, fromNow } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { OwnerShell } from './OwnerShell';
import { GrowthChart } from './GrowthChart';
import type { GrowthData, PlatformStats } from './types';

function StatTile({ icon: Icon, label, value, sub }: { icon: typeof Building2; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 text-white/50">
        <Icon className="size-4" />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

export function OwnerDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'stats'],
    queryFn: () => api.get<PlatformStats>('/platform-admin/stats'),
  });
  const { data: growth } = useQuery({
    queryKey: ['owner', 'growth'],
    queryFn: () => api.get<GrowthData>('/platform-admin/growth?weeks=12'),
  });

  return (
    <OwnerShell>
      <h1 className="font-display text-2xl font-bold tracking-tight text-white">Platform overview</h1>
      <p className="mt-1 text-sm text-white/50">Every organization and user on Joinetra, at a glance.</p>

      {isLoading || !data ? (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg bg-white/5" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon={Building2}
              label="Organizations"
              value={String(data.organizations.total)}
              sub={`${data.organizations.newLast7d} new in last 7 days`}
            />
            <StatTile
              icon={UsersRound}
              label="Users"
              value={String(data.users.total)}
              sub={`${data.users.disabled} disabled`}
            />
            <StatTile icon={TrendingUp} label="Total leads" value={String(data.leads.total)} />
            <StatTile
              icon={CalendarCheck2}
              label="Bookings"
              value={String(data.bookings.total)}
              sub={formatCurrency(data.bookings.totalValue, 'INR')}
            />
          </div>

          {data.organizations.suspended > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <ShieldAlert className="size-4 shrink-0" />
              {data.organizations.suspended} organization{data.organizations.suspended === 1 ? ' is' : 's are'} currently suspended.
            </div>
          )}

          {growth && (
            <div className="mt-8">
              <h2 className="font-display text-lg font-bold text-white">New organizations per week</h2>
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-5">
                <GrowthChart weeks={growth.weeks} />
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="font-display text-lg font-bold text-white">Recently signed up</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-4 py-3 font-medium">Organization</th>
                    <th className="px-4 py-3 font-medium">Users</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Signed up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.recentOrganizations.map((org) => (
                    <tr key={org.id}>
                      <td className="px-4 py-3">
                        <Link to={`/owner/organizations/${org.id}`} className="font-medium text-white hover:text-primary">
                          {org.name}
                        </Link>
                        <p className="text-xs text-white/40">{org.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-white/70">{org._count.users}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            org.status === 'ACTIVE'
                              ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300'
                              : 'inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300'
                          }
                        >
                          {org.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/50">{fromNow(org.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </OwnerShell>
  );
}
