import { useQuery } from '@tanstack/react-query';
import { Cpu, Database, Server, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { fromNow } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnerShell } from './OwnerShell';
import type { SystemHealth } from './types';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function OwnerSystemHealthPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['owner', 'system-health'],
    queryFn: () => api.get<SystemHealth>('/platform-admin/system-health'),
    refetchInterval: 30_000,
  });

  return (
    <OwnerShell>
      <PageHeader
        title="System Health"
        description={dataUpdatedAt ? `Live infrastructure status — last checked ${fromNow(new Date(dataUpdatedAt).toISOString())}.` : 'Live infrastructure status.'}
      />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Database className="size-4" />
                </span>
                <p className="text-sm font-medium text-foreground">Database</p>
              </div>
              <Badge variant={data.database.ok ? 'success' : 'destructive'}>{data.database.ok ? 'Healthy' : 'Down'}</Badge>
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-foreground">{data.database.latencyMs}ms</p>
            <p className="mt-1 text-xs text-muted-foreground">Query latency</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Zap className="size-4" />
                </span>
                <p className="text-sm font-medium text-foreground">Automation (Redis)</p>
              </div>
              <Badge variant={data.redisConfigured ? 'success' : 'muted'}>{data.redisConfigured ? 'Configured' : 'Not configured'}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Bot Flow poller + follow-up sweep</p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                <Server className="size-4" />
              </span>
              <p className="text-sm font-medium text-foreground">Backend process</p>
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-foreground">{formatUptime(data.process.uptimeSeconds)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Uptime since last restart</p>
          </Card>

          <Card className="p-5 sm:col-span-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Cpu className="size-4" />
              </span>
              <p className="text-sm font-medium text-foreground">Process details</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Memory used</dt>
                <dd className="mt-1 font-medium text-foreground">{data.process.memoryUsedMb} MB</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Node version</dt>
                <dd className="mt-1 font-medium text-foreground">{data.process.nodeVersion}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Platform</dt>
                <dd className="mt-1 font-medium text-foreground">{data.process.platform}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Checked at</dt>
                <dd className="mt-1 font-medium text-foreground">{new Date(data.checkedAt).toLocaleTimeString()}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}
    </OwnerShell>
  );
}
