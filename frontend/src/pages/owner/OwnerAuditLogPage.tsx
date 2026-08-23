import { useQuery } from '@tanstack/react-query';
import { ShieldBan, ShieldCheck, UserCog, Building2, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnerShell } from './OwnerShell';
import type { AuditLogEntry, Paginated } from './types';

const ACTION_META: Record<string, { label: string; icon: typeof ShieldBan; badge: string }> = {
  ORGANIZATION_SUSPENDED: { label: 'Suspended organization', icon: ShieldBan, badge: 'bg-rose-100 text-rose-700' },
  ORGANIZATION_REACTIVATED: { label: 'Reactivated organization', icon: ShieldCheck, badge: 'bg-emerald-100 text-emerald-700' },
  ORGANIZATION_CREATED: { label: 'Created organization', icon: Building2, badge: 'bg-violet-100 text-violet-700' },
  USER_DISABLED: { label: 'Disabled user', icon: UserCog, badge: 'bg-rose-100 text-rose-700' },
  USER_ENABLED: { label: 'Enabled user', icon: UserCog, badge: 'bg-teal-100 text-teal-700' },
  NOTE_ADDED: { label: 'Added a note', icon: StickyNote, badge: 'bg-amber-100 text-amber-700' },
};
const DEFAULT_ACTION_META = { icon: UserCog, badge: 'bg-muted text-muted-foreground' };

export function OwnerAuditLogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'audit-log'],
    queryFn: () => api.get<Paginated<AuditLogEntry>>('/platform-admin/audit-log?pageSize=100'),
  });

  return (
    <OwnerShell>
      <PageHeader title="Audit log" description="Every action taken from this panel — who, what, and when." />

      <div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No actions logged yet" />
        ) : (
          <div className="space-y-2">
            {data.items.map((entry) => {
              const meta = ACTION_META[entry.action];
              const Icon = meta?.icon ?? DEFAULT_ACTION_META.icon;
              const badge = meta?.badge ?? DEFAULT_ACTION_META.badge;
              const label = meta?.label ?? entry.action;
              return (
                <Card key={entry.id} className="flex items-start gap-3 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                  <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', badge)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{entry.adminEmail}</span> — {label.toLowerCase()}{' '}
                      <span className="font-medium">{entry.targetLabel}</span>
                    </p>
                    {entry.metadata?.reason ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">Reason: {String(entry.metadata.reason)}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </OwnerShell>
  );
}
