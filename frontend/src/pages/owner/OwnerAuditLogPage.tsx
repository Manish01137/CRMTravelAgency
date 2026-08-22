import { useQuery } from '@tanstack/react-query';
import { ShieldBan, ShieldCheck, UserCog, Building2, StickyNote } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { OwnerShell } from './OwnerShell';
import type { AuditLogEntry, Paginated } from './types';

const ACTION_META: Record<string, { label: string; icon: typeof ShieldBan; tone: string }> = {
  ORGANIZATION_SUSPENDED: { label: 'Suspended organization', icon: ShieldBan, tone: 'text-red-300' },
  ORGANIZATION_REACTIVATED: { label: 'Reactivated organization', icon: ShieldCheck, tone: 'text-emerald-300' },
  ORGANIZATION_CREATED: { label: 'Created organization', icon: Building2, tone: 'text-sky-300' },
  USER_DISABLED: { label: 'Disabled user', icon: UserCog, tone: 'text-red-300' },
  USER_ENABLED: { label: 'Enabled user', icon: UserCog, tone: 'text-emerald-300' },
  NOTE_ADDED: { label: 'Added a note', icon: StickyNote, tone: 'text-white/70' },
};

export function OwnerAuditLogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'audit-log'],
    queryFn: () => api.get<Paginated<AuditLogEntry>>('/platform-admin/audit-log?pageSize=100'),
  });

  return (
    <OwnerShell>
      <h1 className="font-display text-2xl font-bold tracking-tight text-white">Audit log</h1>
      <p className="mt-1 text-sm text-white/50">Every action taken from this panel — who, what, and when.</p>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg bg-white/5" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No actions logged yet" className="border-white/10 bg-white/[0.02] text-white/50" />
        ) : (
          <div className="space-y-2">
            {data.items.map((entry) => {
              const meta = ACTION_META[entry.action] ?? { label: entry.action, icon: UserCog, tone: 'text-white/70' };
              const Icon = meta.icon;
              return (
                <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${meta.tone}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      <span className="font-medium">{entry.adminEmail}</span> — {meta.label.toLowerCase()}{' '}
                      <span className="font-medium">{entry.targetLabel}</span>
                    </p>
                    {entry.metadata?.reason ? (
                      <p className="mt-0.5 text-xs text-white/40">Reason: {String(entry.metadata.reason)}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-xs text-white/40">{formatDateTime(entry.createdAt)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OwnerShell>
  );
}
