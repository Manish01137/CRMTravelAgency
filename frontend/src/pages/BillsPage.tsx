import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Check, Pencil, Plus, Receipt, Search, Trash2, Undo2, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Bill, BillCategory, BillStatus, Booking, Paginated } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BILL_CATEGORIES, BILL_CATEGORY_META, BILL_STATUS_META, bookingRef } from '@/lib/crmMeta';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

type StatusFilter = 'ALL' | BillStatus;

interface FormValues {
  vendorName: string;
  category: BillCategory;
  amount: string;
  currency: string;
  billDate: string;
  bookingId: string;
  notes: string;
}

const NO_BOOKING = 'none';

function BillForm({ bill, onDone }: { bill: Bill | null; onDone: () => void }) {
  const queryClient = useQueryClient();

  // Bills can stand alone (office costs) or be attached to a trip.
  const bookingsQuery = useQuery({
    queryKey: ['bookings', 'billPicker'],
    queryFn: () => api.get<Paginated<Booking>>('/bookings?pageSize=100'),
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      vendorName: bill?.vendorName ?? '',
      category: bill?.category ?? 'HOTEL',
      amount: bill ? String(bill.amount) : '',
      currency: bill?.currency ?? 'INR',
      billDate: bill?.billDate ? bill.billDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      bookingId: bill?.bookingId ?? NO_BOOKING,
      notes: bill?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      bill ? api.patch<Bill>(`/bills/${bill.id}`, payload) : api.post<Bill>('/bills', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success(bill ? 'Bill updated' : 'Bill added');
      onDone();
    },
    onError: () => toast.error('Could not save this bill'),
  });

  const onSubmit = (v: FormValues) => {
    const base = {
      vendorName: v.vendorName.trim(),
      category: v.category,
      amount: v.amount ? Number(v.amount) : 0,
      currency: (v.currency || 'INR').toUpperCase(),
      billDate: v.billDate || undefined,
      notes: v.notes.trim() || (bill ? null : undefined),
    };
    // bookingId is create-only — the API's update schema doesn't accept it.
    mutation.mutate(bill ? base : { ...base, bookingId: v.bookingId === NO_BOOKING ? undefined : v.bookingId });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor" htmlFor="billVendor" error={errors.vendorName?.message} required>
          <Input
            id="billVendor"
            placeholder="e.g. Bali Grand Hotel"
            {...register('vendorName', { required: 'Vendor is required' })}
          />
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Amount" htmlFor="billAmount" required>
          <Input id="billAmount" type="number" min={0} placeholder="0" {...register('amount', { required: true })} />
        </Field>
        <Field label="Currency" htmlFor="billCurrency">
          <Input id="billCurrency" maxLength={3} className="uppercase" {...register('currency')} />
        </Field>
        <Field label="Bill date" htmlFor="billDate">
          <Input id="billDate" type="date" {...register('billDate')} />
        </Field>
      </div>

      {!bill && (
        <Field label="Link to a trip" htmlFor="billBooking" hint="Optional — leave empty for general agency costs.">
          <Controller
            control={control}
            name="bookingId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="billBooking">
                  <SelectValue placeholder="No trip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BOOKING}>No trip (general cost)</SelectItem>
                  {(bookingsQuery.data?.items ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {bookingRef(b.bookingNumber)} · {b.customerName} — {b.destination}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}

      <Field label="Notes" htmlFor="billNotes">
        <Textarea id="billNotes" rows={3} placeholder="Reference number, payment method…" {...register('notes')} />
      </Field>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner className="size-4" />}
          {bill ? 'Save changes' : 'Add bill'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BillsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim().toLowerCase(), 300);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Bill | null>(null);

  const billsQuery = useQuery({
    queryKey: ['bills', status],
    queryFn: () => api.get<Bill[]>(status === 'ALL' ? '/bills' : `/bills?status=${status}`),
  });

  const all = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const bills = useMemo(
    () =>
      search
        ? all.filter(
            (b) =>
              b.vendorName.toLowerCase().includes(search) ||
              b.booking?.customerName.toLowerCase().includes(search),
          )
        : all,
    [all, search],
  );

  // Totals reflect the current filter, so "Unpaid" answers "what do we still owe?".
  const currency = all[0]?.currency ?? 'INR';
  const totals = useMemo(() => {
    const spend = bills.reduce((s, b) => s + b.amount, 0);
    const unpaid = bills.filter((b) => b.status === 'UNPAID').reduce((s, b) => s + b.amount, 0);
    return { spend, unpaid, paid: spend - unpaid };
  }, [bills]);

  const toggleMutation = useMutation({
    mutationFn: (bill: Bill) =>
      api.patch<Bill>(`/bills/${bill.id}`, { status: bill.status === 'PAID' ? 'UNPAID' : 'PAID' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bills'] }),
    onError: () => toast.error('Could not update this bill'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Could not delete this bill'),
  });

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (bill: Bill) => {
    setEditing(bill);
    setFormOpen(true);
  };

  const stats = [
    { label: 'Total spend', value: totals.spend, cls: 'text-foreground' },
    { label: 'Unpaid', value: totals.unpaid, cls: 'text-amber-600' },
    { label: 'Paid', value: totals.paid, cls: 'text-emerald-600' },
  ];

  return (
    <div>
      <PageHeader title="Bills" description="Every vendor cost — hotels, flights, transport — paid and outstanding.">
        <Button onClick={openNew}>
          <Plus /> Add bill
        </Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 sm:p-4">
            <p className="truncate text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('mt-0.5 truncate font-display text-lg font-bold sm:text-2xl', s.cls)}>
              {formatCurrency(s.value, currency)}
            </p>
          </Card>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search vendor or customer…"
            className="pl-9"
            aria-label="Search bills"
          />
        </div>
        <div className="flex gap-1.5">
          {(['ALL', 'UNPAID', 'PAID'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatus(f)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                status === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'ALL' ? 'All' : BILL_STATUS_META[f].label}
            </button>
          ))}
        </div>
      </div>

      {billsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <EmptyState
          icon={<Wallet />}
          title={search || status !== 'ALL' ? 'No bills match' : 'No bills yet'}
          description={
            search || status !== 'ALL'
              ? 'Try a different search or filter.'
              : 'Record what you pay vendors so every trip shows a real margin.'
          }
          action={
            !search && status === 'ALL' ? (
              <Button onClick={openNew}>
                <Plus /> Add bill
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {bills.map((bill) => {
            const cat = BILL_CATEGORY_META[bill.category];
            const st = BILL_STATUS_META[bill.status];
            const paid = bill.status === 'PAID';
            return (
              <div key={bill.id} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/40">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset [&_svg]:size-4', cat.pill)}>
                  <Receipt />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{bill.vendorName}</p>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', cat.pill)}>
                      {cat.label}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', st.pill)}>
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {formatDate(bill.billDate)}
                    {bill.booking ? (
                      <>
                        {' · '}
                        <Link to={`/bookings/${bill.booking.id}`} className="font-medium text-primary hover:underline">
                          {bookingRef(bill.booking.bookingNumber)} · {bill.booking.customerName}
                        </Link>
                      </>
                    ) : (
                      ' · General cost'
                    )}
                  </p>
                </div>

                <p className={cn('font-display text-base font-bold', paid ? 'text-muted-foreground' : 'text-foreground')}>
                  {formatCurrency(bill.amount, bill.currency)}
                </p>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={paid ? 'Mark unpaid' : 'Mark paid'}
                    title={paid ? 'Mark unpaid' : 'Mark paid'}
                    onClick={() => toggleMutation.mutate(bill)}
                  >
                    {paid ? <Undo2 /> : <Check />}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Edit bill" onClick={() => openEdit(bill)}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete bill"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleting(bill)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit bill' : 'Add a bill'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update this vendor cost.' : 'Record a vendor cost — link it to a trip to track margin.'}
            </DialogDescription>
          </DialogHeader>
          {/* key remounts the form so defaults reload when switching records */}
          <BillForm key={editing?.id ?? 'new'} bill={editing} onDone={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this bill?"
        description={`"${deleting?.vendorName}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
