import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck2,
  CircleDot,
  Contact2,
  MessageCircle,
  Plus,
  Sparkles,
  Trophy,
  UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Lead, LeadStats, LeadStatus, Paginated } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CountUp } from '@/components/ui/count-up';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LEAD_STATUSES, leadSourceLabel, leadStatusStyle } from '@/lib/leadMeta';
import { formatCurrency, fromNow, initials } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;

function Rise({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({
  label,
  value,
  icon,
  tile,
  loading,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tile: string;
  loading: boolean;
}) {
  return (
    <Card className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white [&_svg]:size-4', tile)}>
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-2 font-display text-3xl font-bold text-foreground">
          <CountUp to={value} duration={900} />
        </p>
      )}
    </Card>
  );
}

/** Stacked pipeline bar built from stats.byStatus (display-only). */
function PipelineOverview({ stats, loading }: { stats?: LeadStats; loading: boolean }) {
  const total = stats?.total ?? 0;
  const segments = LEAD_STATUSES.map((s) => ({
    status: s.value as LeadStatus,
    count: stats?.byStatus?.[s.value] ?? 0,
  })).filter((s) => s.count > 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">Pipeline overview</h2>
        <Link to="/leads" className="text-sm font-medium text-primary hover:underline">
          Open pipeline
        </Link>
      </div>
      {loading ? (
        <Skeleton className="mt-4 h-4 w-full rounded-full" />
      ) : total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Add your first lead and your pipeline will light up here.</p>
      ) : (
        <>
          <div className="mt-4 flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
            {segments.map((seg) => {
              const st = leadStatusStyle(seg.status);
              return (
                <motion.span
                  key={seg.status}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  style={{ width: `${(seg.count / total) * 100}%`, transformOrigin: 'left' }}
                  className={st.dot}
                  title={`${st.label}: ${seg.count}`}
                />
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {segments.map((seg) => {
              const st = leadStatusStyle(seg.status);
              return (
                <span key={seg.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('size-2 rounded-full', st.dot)} />
                  {st.label} · <span className="font-semibold text-foreground">{seg.count}</span>
                </span>
              );
            })}
          </div>
        </>
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
      {/* Gradient welcome banner */}
      <Rise>
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-violet-600 p-6 text-white shadow-pop sm:p-8">
          <div className="animate-blob pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="animate-blob-slow pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white/70">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {greeting()}, {firstName} 👋
              </h1>
              <p className="mt-1.5 text-sm text-white/75">
                Here's what's happening at {organization?.name ?? 'your agency'}.
              </p>
            </div>
            <Button asChild size="lg" className="w-full bg-white text-primary shadow-soft hover:bg-white/90 sm:w-auto">
              <Link to="/leads">
                <Plus /> New lead
              </Link>
            </Button>
          </div>
        </div>
      </Rise>

      {/* Stat tiles — each with its own accent */}
      <Rise delay={0.08}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total leads" value={stats?.total ?? 0} icon={<Contact2 />} tile="bg-gradient-to-br from-primary to-violet-500" loading={statsQuery.isLoading} />
          <StatCard label="Open" value={stats?.open ?? 0} icon={<CircleDot />} tile="bg-gradient-to-br from-sky-500 to-blue-600" loading={statsQuery.isLoading} />
          <StatCard label="Won" value={stats?.won ?? 0} icon={<Trophy />} tile="bg-gradient-to-br from-emerald-500 to-teal-600" loading={statsQuery.isLoading} />
          <StatCard label="New this week" value={stats?.newThisWeek ?? 0} icon={<Sparkles />} tile="bg-gradient-to-br from-amber-400 to-orange-500" loading={statsQuery.isLoading} />
        </div>
      </Rise>

      {/* Pipeline snapshot */}
      <Rise delay={0.16} className="mt-6">
        <PipelineOverview stats={stats} loading={statsQuery.isLoading} />
      </Rise>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Recent leads */}
        <Rise delay={0.24} className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="font-display text-base font-semibold text-foreground">Recent leads</h2>
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
                    const st = leadStatusStyle(lead.status);
                    return (
                      <li key={lead.id}>
                        <Link to="/leads" className="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-muted">
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
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', st.pill)}>
                            <span className={cn('size-1.5 rounded-full', st.dot)} />
                            {st.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </Rise>

        {/* Right rail */}
        <div className="space-y-6">
          <Rise delay={0.3}>
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-violet-600 to-primary p-6 text-white shadow-pop">
              <div className="animate-blob pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 [&_svg]:size-5">
                  <UserPlus />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold">
                  {isAdmin ? 'Build your team' : 'Keep leads moving'}
                </h2>
                <p className="mt-1.5 text-sm text-white/75">
                  {isAdmin
                    ? 'Invite agents so everyone can work leads together in one pipeline.'
                    : 'Follow up with your leads and move them through the pipeline.'}
                </p>
                <Button asChild size="sm" className="mt-5 bg-white text-primary hover:bg-white/90">
                  <Link to={isAdmin ? '/team' : '/leads'}>
                    {isAdmin ? 'Manage team' : 'View leads'} <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </Rise>

          <Rise delay={0.36}>
            <Card className="p-5">
              <h2 className="font-display text-base font-semibold text-foreground">Coming to your workspace</h2>
              <ul className="mt-4 space-y-3.5">
                {[
                  { Icon: CalendarCheck2, label: 'Bookings, itineraries & invoices', tile: 'bg-amber-100 text-amber-600' },
                  { Icon: MessageCircle, label: 'WhatsApp & Instagram inbox', tile: 'bg-emerald-100 text-emerald-600' },
                  { Icon: Sparkles, label: 'AI follow-ups & bot flows', tile: 'bg-violet-100 text-violet-600' },
                ].map((f) => (
                  <li key={f.label} className="flex items-center gap-3">
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4', f.tile)}>
                      <f.Icon />
                    </span>
                    <span className="flex-1 text-sm text-foreground">{f.label}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Soon
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Rise>
        </div>
      </div>
    </div>
  );
}
