import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { OwnerShell } from './OwnerShell';
import { StatTile } from './StatTile';
import type { ProfitData } from './types';

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function OwnerProfitPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'profit'],
    queryFn: () => api.get<ProfitData>('/platform-admin/profit?months=6'),
  });

  return (
    <OwnerShell>
      <PageHeader title="Profit" description="Revenue minus expenses. MRR is treated as constant per month — there's no historical subscription tracking." />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile icon={TrendingUp} label="Revenue (MRR)" value={formatCurrency(data.mrr, data.currency)} accent="teal" />
            <StatTile icon={TrendingDown} label="Expenses (12mo)" value={formatCurrency(data.totalExpenses, data.currency)} accent="rose" />
            <StatTile icon={Wallet} label="Net profit" value={formatCurrency(data.profit, data.currency)} accent="amber" />
          </div>

          <div className="mt-8">
            <h2 className="font-display text-base font-semibold text-foreground">Monthly breakdown</h2>
            <Card className="mt-3 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Month</th>
                    <th className="px-4 py-3 font-medium">Revenue</th>
                    <th className="px-4 py-3 font-medium">Expenses</th>
                    <th className="px-4 py-3 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.months.map((m) => (
                    <tr key={m.month} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground">{monthLabel(m.month)}</td>
                      <td className="px-4 py-3 text-foreground">{formatCurrency(m.revenue, data.currency)}</td>
                      <td className="px-4 py-3 text-foreground">{formatCurrency(m.expenses, data.currency)}</td>
                      <td className={`px-4 py-3 font-medium ${m.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(m.profit, data.currency)}
                      </td>
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
