import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Printer, ReceiptText, Search, SearchX } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Invoice, Paginated } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { INVOICE_STATUSES, INVOICE_STATUS_STYLES, bookingRef, invoiceRef } from '@/lib/crmMeta';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

const ALL = 'ALL';
const PAGE_SIZE = 15;

export function InvoicesPage() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [search, status]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== ALL) params.set('status', status);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    return params.toString();
  }, [search, status, page]);

  const invoicesQuery = useQuery({
    queryKey: ['invoices', queryString],
    queryFn: () => api.get<Paginated<Invoice>>(`/invoices?${queryString}`),
    placeholderData: keepPreviousData,
  });

  const data = invoicesQuery.data;
  const invoices = data?.items ?? [];
  const hasFilters = Boolean(search) || status !== ALL;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Customer invoices across all bookings — generate them from any booking's Invoices tab."
      />

      <div className="mb-3">
        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search customer…"
            className="pl-9"
            aria-label="Search invoices"
          />
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          type="button"
          onClick={() => setStatus(ALL)}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
            status === ALL ? 'bg-foreground text-background' : 'border border-border bg-card text-muted-foreground hover:bg-muted',
          )}
        >
          All
        </button>
        {INVOICE_STATUSES.map((s) => {
          const active = status === s.value;
          const st = INVOICE_STATUS_STYLES[s.value];
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(active ? ALL : s.value)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                active ? st.solid : 'border border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              <span className={cn('size-1.5 rounded-full', active ? 'bg-white' : st.dot)} />
              {s.label}
            </button>
          );
        })}
      </div>

      {invoicesQuery.isLoading ? (
        <Card className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </Card>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={hasFilters ? <SearchX /> : <ReceiptText />}
          title={hasFilters ? 'No invoices match' : 'No invoices yet'}
          description={
            hasFilters
              ? 'Try adjusting your search or status filter.'
              : 'Open a booking and use its Invoices tab to generate your first invoice.'
          }
          action={
            !hasFilters ? (
              <Button asChild variant="outline">
                <Link to="/bookings">Go to bookings</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card className="divide-y divide-border">
            {invoices.map((inv) => {
              const st = INVOICE_STATUS_STYLES[inv.status];
              return (
                <Link
                  key={inv.id}
                  to={`/invoices/${inv.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ReceiptText className="size-4.5 size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {invoiceRef(inv.invoiceNumber)} · {inv.customerName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Issued {formatDate(inv.issueDate)}
                        {inv.booking ? ` · ${bookingRef(inv.booking.bookingNumber)} (${inv.booking.destination})` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-display text-base font-bold text-foreground">
                      {formatCurrency(inv.total, inv.currency)}
                    </span>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', st.pill)}>
                      <span className={cn('size-1.5 rounded-full', st.dot)} />
                      {st.label}
                    </span>
                    <Printer className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </Card>

          {data && data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages} · {data.total} invoices
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1}>
                  <ChevronLeft /> Prev
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={data.page >= data.totalPages}>
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
