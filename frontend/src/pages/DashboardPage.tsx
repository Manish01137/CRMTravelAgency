import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleDot, Contact2, Plus, Sparkles, Trophy, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import type { Lead, LeadStats, Paginated } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { leadSourceLabel, leadStatusMeta } from '@/lib/leadMeta';
import { formatCurrency, fromNow, initials } from '@/lib/format';

function StatCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-2 font-display text-3xl font-semibold text-foreground">{value}</p>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { user, organization, isAdmin } = useAuth();
  const firstName = user?.name.split(' ')[0] ?? 'there';

  const statsQuery = useQuery({
    queryKey: ['lead-stats'],
    queryFn: () => api.get<LeadStats>('/leads/stats'),
  });

  const recentQuery = useQuery({
    queryKey: ['leads', { recent: true }],
    queryFn: () => api.get<Paginated<Lead>>('/leads?pageSize=5&sort=createdAt&order=desc'),
  });

  const stats = statsQuery.data;
  const recent = recentQuery.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`Here's what's happening at ${organization?.name ?? 'your agency'}.`}
      >
        <Button asChild>
          <Link to="/leads">
            <Plus /> New lead
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total leads" value={stats?.total ?? 0} icon={<Contact2 />} loading={statsQuery.isLoading} />
        <StatCard label="Open" value={stats?.open ?? 0} icon={<CircleDot />} loading={statsQuery.isLoading} />
        <StatCard label="Won" value={stats?.won ?? 0} icon={<Trophy />} loading={statsQuery.isLoading} />
        <StatCard label="New this week" value={stats?.newThisWeek ?? 0} icon={<Sparkles />} loading={statsQuery.isLoading} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="text-base font-semibold text-foreground">Recent leads</h2>
            <Link to="/leads" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="p-2 sm:p-3">
            {recentQuery.isLoading ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                className="border-0 bg-transparent py-10"
                icon={<Contact2 />}
                title="No leads yet"
                description="Your incoming enquiries will show up here. Add your first lead to get started."
                action={
                  <Button asChild>
                    <Link to="/leads">
                      <Plus /> Add a lead
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((lead) => {
                  const status = leadStatusMeta(lead.status);
                  return (
                    <li key={lead.id}>
                      <Link
                        to="/leads"
                        className="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-muted"
                      >
                        <Avatar>
                          <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {leadSourceLabel(lead.source)}
                            {lead.destination ? ` · ${lead.destination}` : ''} · {fromNow(lead.createdAt)}
                          </p>
                        </div>
                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-medium text-foreground">
                            {formatCurrency(lead.budgetAmount, lead.budgetCurrency ?? 'USD')}
                          </p>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-5">
          <div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 text-secondary [&_svg]:size-5">
              <UserPlus />
            </span>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              {isAdmin ? 'Build your team' : 'Keep leads moving'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? 'Invite agents so everyone can work leads together. More widgets — bookings, revenue, follow-ups — arrive in the next phase.'
                : 'Follow up with your leads and move them through the pipeline. More widgets arrive in the next phase.'}
            </p>
          </div>
          <div className="mt-5">
            <Button variant="outline" asChild className="w-full">
              <Link to={isAdmin ? '/team' : '/leads'}>{isAdmin ? 'Manage team' : 'View leads'}</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
