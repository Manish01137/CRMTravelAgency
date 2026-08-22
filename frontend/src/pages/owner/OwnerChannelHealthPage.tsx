import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Send, Mail as MailIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { fromNow } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { OwnerShell } from './OwnerShell';
import type { ChannelHealth, ChannelType } from './types';

const CHANNEL_META: Record<ChannelType, { label: string; icon: typeof MessageCircle; badge: string }> = {
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, badge: 'bg-emerald-500/15 text-emerald-300' },
  INSTAGRAM: { label: 'Instagram', icon: Send, badge: 'bg-gradient-to-br from-fuchsia-500/25 via-pink-500/25 to-amber-400/25 text-pink-300' },
  EMAIL: { label: 'Email', icon: MailIcon, badge: 'bg-indigo-500/15 text-indigo-300' },
};

export function OwnerChannelHealthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'channel-health'],
    queryFn: () => api.get<ChannelHealth>('/platform-admin/channel-health'),
  });

  return (
    <OwnerShell>
      <h1 className="font-display text-2xl font-bold tracking-tight text-white">Channel health</h1>
      <p className="mt-1 text-sm text-white/50">Every organization's WhatsApp, Instagram, and Email integration status.</p>

      {isLoading || !data ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg bg-white/5" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(Object.keys(CHANNEL_META) as ChannelType[]).map((channel) => {
              const { label, icon: Icon, badge } = CHANNEL_META[channel];
              const counts = data.summary[channel] ?? {};
              const connected = counts.CONNECTED ?? 0;
              const failed = counts.FAILED ?? 0;
              return (
                <div key={channel} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex size-9 items-center justify-center rounded-xl', badge)}>
                      <Icon className="size-4" />
                    </span>
                    <p className="text-sm font-medium text-white">{label}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle2 className="size-4" />
                      <span className="text-lg font-bold">{connected}</span>
                      <span className="text-xs text-white/40">connected</span>
                    </div>
                    {failed > 0 && (
                      <div className="flex items-center gap-1.5 text-rose-300">
                        <XCircle className="size-4" />
                        <span className="text-lg font-bold">{failed}</span>
                        <span className="text-xs text-white/40">failed</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <h2 className="font-display text-lg font-bold text-white">Needs attention</h2>
            {data.failedConnections.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 />}
                title="No failed connections"
                description="Every connected channel across every organization is healthy."
                className="mt-3 border-white/10 bg-white/[0.02] text-white/50"
              />
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/40">
                    <tr>
                      <th className="px-4 py-3 font-medium">Organization</th>
                      <th className="px-4 py-3 font-medium">Channel</th>
                      <th className="px-4 py-3 font-medium">Error</th>
                      <th className="px-4 py-3 font-medium">Last updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.failedConnections.map((conn) => (
                      <tr key={conn.id} className="transition-colors hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <Link to={`/owner/organizations/${conn.organization.id}`} className="font-medium text-white hover:text-primary">
                            {conn.organization.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-white/70">{CHANNEL_META[conn.channel].label}</td>
                        <td className="px-4 py-3 text-rose-300">{conn.lastError ?? 'Unknown error'}</td>
                        <td className="px-4 py-3 text-white/50">{fromNow(conn.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </OwnerShell>
  );
}
