import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Printer,
  ReceiptText,
  Trash2,
  UsersRound,
  Wallet,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Bill, BillCategory, Booking, Invoice, TravelPackage, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookingFormDialog } from '@/components/bookings/BookingFormDialog';
import {
  BILL_CATEGORIES,
  BILL_CATEGORY_META,
  BILL_STATUS_META,
  BOOKING_STATUS_STYLES,
  INVOICE_STATUS_STYLES,
  bookingRef,
  invoiceRef,
} from '@/lib/crmMeta';
import { formatCurrency, formatDate, formatTravelDate } from '@/lib/format';

type Tab = 'itinerary' | 'invoices' | 'bills';

/* ------------------------------- Itinerary tab ----------------------------- */

function ItineraryTab({ booking }: { booking: Booking }) {
  const navigate = useNavigate();
  const days = [...(booking.itineraryItems ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {days.length ? `${days.length}-day itinerary` : 'No itinerary designed yet'}
        </p>
        <div className="flex gap-2">
          {days.length > 0 && (
            <Button variant="outline" onClick={() => window.open(`/bookings/${booking.id}/itinerary/print`, '_blank')}>
              <Printer /> Download PDF
            </Button>
          )}
          <Button onClick={() => navigate(`/bookings/${booking.id}/itinerary`)}>
            <Wand2 /> {days.length ? 'Open Composer' : 'Design itinerary'}
          </Button>
        </div>
      </div>

      {days.length === 0 ? (
        <EmptyState
          icon={<MapPin />}
          title="No itinerary yet"
          description="Use the Itinerary Composer to build a day-by-day plan you can share as a PDF."
          action={
            <Button onClick={() => navigate(`/bookings/${booking.id}/itinerary`)}>
              <Wand2 /> Open Composer
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {days.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 font-display text-sm font-bold text-white">
                  {d.dayNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{d.title}</p>
                  {(d.subtitle || d.city || d.country) && (
                    <p className="mt-0.5 text-xs font-medium text-primary">
                      {[d.subtitle, [d.city, d.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {d.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Invoices tab ----------------------------- */

function InvoicesTab({ booking }: { booking: Booking }) {
  const queryClient = useQueryClient();
  const invoices = booking.invoices ?? [];

  const generateMutation = useMutation({
    mutationFn: () => api.post<Invoice>(`/invoices/from-booking/${booking.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice generated');
    },
    onError: () => toast.error('Could not generate invoice'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? <Spinner /> : <Plus />}
          Generate invoice
        </Button>
      </div>
      {invoices.length === 0 ? (
        <EmptyState
          icon={<ReceiptText />}
          title="No invoices yet"
          description="Generate an invoice prefilled from this booking's amount."
        />
      ) : (
        <Card className="divide-y divide-border">
          {invoices.map((inv) => {
            const st = INVOICE_STATUS_STYLES[inv.status];
            return (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-foreground">{invoiceRef(inv.invoiceNumber)}</p>
                  <p className="text-xs text-muted-foreground">
                    Issued {formatDate(inv.issueDate)} · {formatCurrency(inv.total, inv.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', st.pill)}>
                    <span className={cn('size-1.5 rounded-full', st.dot)} />
                    {st.label}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/invoices/${inv.id}`}>
                      <Printer /> View
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------- Bills tab ------------------------------ */

interface BillFormValues {
  vendorName: string;
  category: BillCategory;
  amount: string;
  billDate: string;
  notes: string;
}

function BillsTab({ booking }: { booking: Booking }) {
  const queryClient = useQueryClient();
  const bills = booking.bills ?? [];
  const [adding, setAdding] = useState(false);

  const { register, handleSubmit, control, reset } = useForm<BillFormValues>({
    defaultValues: { vendorName: '', category: 'HOTEL', amount: '', billDate: '', notes: '' },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });

  const createMutation = useMutation({
    mutationFn: (v: BillFormValues) =>
      api.post<Bill>('/bills', {
        bookingId: booking.id,
        vendorName: v.vendorName.trim(),
        category: v.category,
        amount: v.amount ? Number(v.amount) : 0,
        currency: booking.currency,
        billDate: v.billDate || undefined,
        notes: v.notes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Bill added');
      reset();
      setAdding(false);
    },
    onError: () => toast.error('Could not add bill'),
  });

  const toggleMutation = useMutation({
    mutationFn: (bill: Bill) =>
      api.patch<Bill>(`/bills/${bill.id}`, { status: bill.status === 'PAID' ? 'UNPAID' : 'PAID' }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bills/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Bill deleted');
    },
  });

  const totalCosts = bills.reduce((sum, b) => sum + b.amount, 0);
  const margin = booking.totalAmount - totalCosts;

  return (
    <div className="space-y-4">
      {/* Margin summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Trip value', value: booking.totalAmount, cls: 'text-foreground' },
          { label: 'Vendor costs', value: totalCosts, cls: 'text-amber-600' },
          { label: 'Margin', value: margin, cls: margin >= 0 ? 'text-emerald-600' : 'text-destructive' },
        ].map((s) => (
          <Card key={s.label} className="p-3 sm:p-4">
            <p className="truncate text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('mt-0.5 truncate font-display text-lg font-bold sm:text-xl', s.cls)}>
              {formatCurrency(s.value, booking.currency)}
            </p>
          </Card>
        ))}
      </div>

      {adding ? (
        <Card className="p-4">
          <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vendor" htmlFor="vendorName" required>
                <Input id="vendorName" placeholder="e.g. Bali Grand Hotel" {...register('vendorName', { required: true })} />
              </Field>
              <Field label="Category" htmlFor="billCategory">
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="billCategory">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILL_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Amount (${booking.currency})`} htmlFor="billAmount" required>
                <Input id="billAmount" type="number" min={0} {...register('amount', { required: true })} />
              </Field>
              <Field label="Bill date" htmlFor="billDate">
                <Input id="billDate" type="date" {...register('billDate')} />
              </Field>
            </div>
            <Field label="Notes" htmlFor="billNotes">
              <Input id="billNotes" placeholder="Reference number, terms…" {...register('notes')} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Spinner />}
                Add bill
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add bill
          </Button>
        </div>
      )}

      {bills.length === 0 ? (
        <EmptyState
          icon={<Wallet />}
          title="No vendor bills yet"
          description="Track hotel, flight and transport costs to see your margin on this trip."
        />
      ) : (
        <Card className="divide-y divide-border">
          {bills.map((bill) => (
            <div key={bill.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{bill.vendorName}</p>
                <p className="text-xs text-muted-foreground">{formatDate(bill.billDate)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', BILL_CATEGORY_META[bill.category].pill)}>
                  {BILL_CATEGORY_META[bill.category].label}
                </span>
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate(bill)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-opacity hover:opacity-75',
                    BILL_STATUS_META[bill.status].pill,
                  )}
                  title="Toggle paid/unpaid"
                >
                  {BILL_STATUS_META[bill.status].label}
                </button>
                <span className="font-medium text-foreground">{formatCurrency(bill.amount, bill.currency)}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Delete bill" onClick={() => deleteMutation.mutate(bill.id)}>
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ----------------------------------- Page ---------------------------------- */

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('itinerary');
  const [editOpen, setEditOpen] = useState(false);

  const bookingQuery = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get<Booking>(`/bookings/${id}`),
    enabled: !!id,
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });
  const packagesQuery = useQuery({
    queryKey: ['packages'],
    queryFn: () => api.get<TravelPackage[]>('/packages'),
  });

  const booking = bookingQuery.data;

  if (bookingQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (!booking) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Booking not found"
        action={
          <Button variant="outline" onClick={() => navigate('/bookings')}>
            <ArrowLeft /> Back to bookings
          </Button>
        }
      />
    );
  }

  const st = BOOKING_STATUS_STYLES[booking.status];
  const paidPct = booking.totalAmount > 0 ? Math.min(100, Math.round((booking.amountPaid / booking.totalAmount) * 100)) : 0;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'itinerary', label: 'Itinerary', count: booking.itineraryItems?.length },
    { key: 'invoices', label: 'Invoices', count: booking.invoices?.length },
    { key: 'bills', label: 'Bills', count: booking.bills?.length },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/bookings')}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Bookings
      </button>

      {/* Header card */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-violet-600 p-6 text-white shadow-pop sm:p-7">
        <div className="animate-blob pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              {bookingRef(booking.bookingNumber)}
            </p>
            <h1 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl">{booking.customerName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {booking.destination}
              </span>
              {booking.startDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatTravelDate(booking.startDate)}
                  {booking.endDate ? ` → ${formatTravelDate(booking.endDate)}` : ''}
                </span>
              )}
              {booking.travelerCount && (
                <span className="flex items-center gap-1">
                  <UsersRound className="size-3.5" /> {booking.travelerCount} pax
                </span>
              )}
              {booking.customerPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5" /> {booking.customerPhone}
                </span>
              )}
              {booking.customerEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3.5" /> {booking.customerEmail}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-xl bg-white/10 px-4 py-2.5">
              <p className="text-[11px] text-white/60">Payment</p>
              <p className="font-display text-lg font-bold">
                {formatCurrency(booking.amountPaid, booking.currency)}
                <span className="text-sm font-medium text-white/60"> / {formatCurrency(booking.totalAmount, booking.currency)}</span>
              </p>
              <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-white/20">
                <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${paidPct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full bg-white px-3 py-1.5 text-xs font-bold', st.pill.split(' ')[1])}>
                {st.label}
              </span>
              <Button size="sm" className="bg-white text-primary hover:bg-white/90" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              tab === t.key
                ? 'bg-primary text-white'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={cn('rounded-full px-1.5 text-[10px] font-bold', tab === t.key ? 'bg-white/20' : 'bg-muted')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'itinerary' && <ItineraryTab key={booking.updatedAt} booking={booking} />}
      {tab === 'invoices' && <InvoicesTab booking={booking} />}
      {tab === 'bills' && <BillsTab booking={booking} />}

      <BookingFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        booking={booking}
        users={usersQuery.data ?? []}
        packages={packagesQuery.data ?? []}
      />
    </div>
  );
}
