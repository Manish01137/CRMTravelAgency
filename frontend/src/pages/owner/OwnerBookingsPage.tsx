import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatTravelDate, fromNow } from '@/lib/format';
import { BOOKING_STATUS_STYLES } from '@/lib/crmMeta';
import { bookingRef } from '@/lib/crmMeta';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { OwnerShell } from './OwnerShell';
import type { OwnerBookingRow, Paginated } from './types';

export function OwnerBookingsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'bookings', search],
    queryFn: () =>
      api.get<Paginated<OwnerBookingRow>>(`/platform-admin/bookings?${new URLSearchParams({ ...(search ? { search } : {}), pageSize: '50' })}`),
  });

  return (
    <OwnerShell>
      <PageHeader title="Bookings" description="Every confirmed trip across every organization.">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer name or phone…" className="pl-9" />
        </div>
      </PageHeader>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No bookings found" className="border-none" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">Travel date</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((bk) => {
                const style = BOOKING_STATUS_STYLES[bk.status];
                return (
                  <tr key={bk.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{bk.customerName}</p>
                      <p className="text-xs text-muted-foreground">{bookingRef(bk.bookingNumber)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/owner/organizations/${bk.organization.id}`} className="text-foreground hover:text-primary">
                        {bk.organization.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{bk.destination}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bk.startDate ? formatTravelDate(bk.startDate) : '—'}</td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(bk.totalAmount, bk.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', style.pill)}>
                        <span className={cn('size-1.5 rounded-full', style.dot)} />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fromNow(bk.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </OwnerShell>
  );
}
