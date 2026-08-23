import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnerShell } from './OwnerShell';
import { SubscriptionDialog } from './SubscriptionDialog';
import type { SubscriptionRow } from './types';

const STATUS_VARIANT = { ACTIVE: 'success', EXPIRED: 'muted', CANCELLED: 'destructive' } as const;

export function OwnerSubscriptionsPage() {
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'subscriptions'],
    queryFn: () => api.get<SubscriptionRow[]>('/platform-admin/subscriptions'),
  });

  return (
    <OwnerShell>
      <PageHeader title="Active Subscriptions" description="What each agency is paying, tracked manually — there's no payment gateway wired up." />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="No organizations yet" className="border-none" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Renews</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => (
                <tr key={row.organization.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link to={`/owner/organizations/${row.organization.id}`} className="font-medium text-foreground hover:text-primary">
                      {row.organization.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{row.subscription?.planName ?? '—'}</td>
                  <td className="px-4 py-3 text-foreground">
                    {row.subscription ? formatCurrency(row.subscription.amount, row.subscription.currency) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.subscription ? (
                      <Badge variant={STATUS_VARIANT[row.subscription.status]}>{row.subscription.status}</Badge>
                    ) : (
                      <Badge variant="outline">No plan set</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.subscription?.renewsAt ? formatDate(row.subscription.renewsAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(row)}>
                      <Pencil className="size-3.5" /> {row.subscription ? 'Edit' : 'Set plan'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <SubscriptionDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          organizationId={editing.organization.id}
          organizationName={editing.organization.name}
          subscription={editing.subscription}
        />
      )}
    </OwnerShell>
  );
}
