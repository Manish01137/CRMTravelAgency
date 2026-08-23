import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, CalendarCheck2, ShieldAlert, TrendingUp, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, fromNow } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { OwnerShell } from './OwnerShell';
import { GrowthChart } from './GrowthChart';
import { StatTile } from './StatTile';
import type { GrowthData, PlatformStats } from './types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-violet-600 p-6 text-white shadow-pop sm:p-8">
        <p className="text-sm text-white/70">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{greeting()}, Owner 👋</h1>
        <p className="mt-1 text-sm text-white/80">Every organization and user on Joinetra, at a glance.</p>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon={Building2}
              label="Organizations"
              value={data.organizations.total}
              sub={`${data.organizations.newLast7d} new in last 7 days`}
              accent="violet"
            />
            <StatTile
              icon={UsersRound}
              label="Users"
              value={data.users.total}
              sub={`${data.users.disabled} disabled`}
              accent="teal"
            />
            <StatTile icon={TrendingUp} label="Total leads" value={data.leads.total} accent="sky" />
            <StatTile
              icon={CalendarCheck2}
              label="Bookings"
              value={data.bookings.total}
              sub={formatCurrency(data.bookings.totalValue, 'INR')}
              accent="amber"
            />
          </div>

          {data.organizations.suspended > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              {data.organizations.suspended} organization{data.organizations.suspended === 1 ? ' is' : 's are'} currently suspended.
            </div>
          )}

          {growth && (
            <div className="mt-8">
              <h2 className="font-display text-base font-semibold text-foreground">New organizations per week</h2>
              <Card className="mt-3 p-5">
                <GrowthChart weeks={growth.weeks} />
              </Card>
            </div>
          )}

          <div className="mt-8">
            <h2 className="font-display text-base font-semibold text-foreground">Recently signed up</h2>
            <Card className="mt-3 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Organization</th>
                    <th className="px-4 py-3 font-medium">Users</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Signed up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentOrganizations.map((org) => (
                    <tr key={org.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link to={`/owner/organizations/${org.id}`} className="font-medium text-foreground hover:text-primary">
                          {org.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{org.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-foreground">{org._count.users}</td>
                      <td className="px-4 py-3">
                        <Badge variant={org.status === 'ACTIVE' ? 'success' : 'destructive'}>{org.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fromNow(org.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </OwnerShell>
  );
}
