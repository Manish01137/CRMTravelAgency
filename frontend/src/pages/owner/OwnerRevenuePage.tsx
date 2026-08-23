import { useQuery } from '@tanstack/react-query';
import { CreditCard, TrendingUp, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnerShell } from './OwnerShell';
import { StatTile } from './StatTile';
import type { RevenueData } from './types';

export function OwnerRevenuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'revenue'],
    queryFn: () => api.get<RevenueData>('/platform-admin/revenue'),
  });

  return (
    <OwnerShell>
      <PageHeader title="Revenue" description="Monthly recurring revenue from active subscriptions." />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile icon={Wallet} label="Monthly recurring revenue" value={formatCurrency(data.mrr, data.currency)} accent="teal" />
            <StatTile icon={CreditCard} label="Active subscriptions" value={data.activeSubscriptions} accent="violet" />
            <StatTile
              icon={TrendingUp}
              label="Average per org"
              value={formatCurrency(data.activeSubscriptions ? Math.round(data.mrr / data.activeSubscriptions) : 0, data.currency)}
              accent="amber"
            />
          </div>

          <div className="mt-8">
            <h2 className="font-display text-base font-semibold text-foreground">By plan</h2>
            {Object.keys(data.byPlan).length === 0 ? (
              <EmptyState title="No active subscriptions yet" className="mt-3" />
            ) : (
              <Card className="mt-3 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Organizations</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(data.byPlan).map(([plan, info]) => (
                      <tr key={plan} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium text-foreground">{plan}</td>
                        <td className="px-4 py-3 text-foreground">{info.count}</td>
                        <td className="px-4 py-3 text-foreground">{formatCurrency(info.amount, data.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>

          <div className="mt-8">
            <h2 className="font-display text-base font-semibold text-foreground">Active subscriptions</h2>
            {data.subscriptions.length === 0 ? (
              <EmptyState title="Nothing here yet" className="mt-3" />
            ) : (
              <Card className="mt-3 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Organization</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.subscriptions.map((s, i) => (
                      <tr key={i} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium text-foreground">{s.organizationName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.planName}</td>
                        <td className="px-4 py-3 text-foreground">{formatCurrency(s.amount, data.currency)}</td>
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
