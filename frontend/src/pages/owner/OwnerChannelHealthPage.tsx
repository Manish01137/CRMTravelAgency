import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Send, Mail as MailIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { fromNow } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnerShell } from './OwnerShell';
import type { ChannelHealth, ChannelType } from './types';

const CHANNEL_META: Record<ChannelType, { label: string; icon: typeof MessageCircle; badge: string }> = {
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, badge: 'bg-emerald-100 text-emerald-700' },
  INSTAGRAM: { label: 'Instagram', icon: Send, badge: 'bg-gradient-to-br from-fuchsia-100 via-pink-100 to-amber-100 text-pink-600' },
  EMAIL: { label: 'Email', icon: MailIcon, badge: 'bg-indigo-100 text-indigo-700' },
};

export function OwnerChannelHealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'channel-health'],
    queryFn: () => api.get<ChannelHealth>('/platform-admin/channel-health'),
  });

  return (
    <OwnerShell>
      <PageHeader title="Channel health" description="Every organization's WhatsApp, Instagram, and Email integration status." />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(Object.keys(CHANNEL_META) as ChannelType[]).map((channel) => {
              const { label, icon: Icon, badge } = CHANNEL_META[channel];
              const counts = data.summary[channel] ?? {};
              const connected = counts.CONNECTED ?? 0;
              const failed = counts.FAILED ?? 0;
              return (
                <Card key={channel} className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex size-9 items-center justify-center rounded-xl', badge)}>
                      <Icon className="size-4" />
                    </span>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-success">
                      <CheckCircle2 className="size-4" />
                      <span className="text-lg font-bold">{connected}</span>
                      <span className="text-xs text-muted-foreground">connected</span>
                    </div>
                    {failed > 0 && (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <XCircle className="size-4" />
                        <span className="text-lg font-bold">{failed}</span>
                        <span className="text-xs text-muted-foreground">failed</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="mt-8">
            <h2 className="font-display text-base font-semibold text-foreground">Needs attention</h2>
            {data.failedConnections.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 />}
                title="No failed connections"
                description="Every connected channel across every organization is healthy."
                className="mt-3"
              />
            ) : (
              <Card className="mt-3 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Organization</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Error</th>
                      <th className="px-4 py-3 font-medium">Last updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.failedConnections.map((conn) => (
                      <tr key={conn.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Link to={`/owner/organizations/${conn.organization.id}`} className="font-medium text-foreground hover:text-primary">
                            {conn.organization.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-foreground">{CHANNEL_META[conn.channel].label}</td>
                        <td className="px-4 py-3 text-destructive">{conn.lastError ?? 'Unknown error'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fromNow(conn.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </>
      )}
    </OwnerShell>
  );
}
