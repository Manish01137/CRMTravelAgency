import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Booking, TravelPackage, User } from '@/types';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BOOKING_STATUSES } from '@/lib/crmMeta';
import { handleApiError } from '@/lib/formErrors';
import { toDateInputValue } from '@/lib/format';

const schema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(120),
  customerEmail: z.union([z.literal(''), z.string().email('Enter a valid email')]),
  customerPhone: z.string().max(40),
  destination: z.string().trim().min(1, 'Destination is required').max(120),
  startDate: z.string(),
  endDate: z.string(),
  travelerCount: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED']),
  totalAmount: z.string(),
  amountPaid: z.string(),
  currency: z.string().max(3),
  packageId: z.string(),
  assignedToId: z.string(),
  notes: z.string().max(5000),
});
type Values = z.infer<typeof schema>;

const NONE = 'none';

function BookingForm({
  booking,
  users,
  packages,
  onDone,
}: {
  booking: Booking | null;
  users: User[];
  packages: TravelPackage[];
  onDone: (saved: Booking) => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setError,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: booking?.customerName ?? '',
      customerEmail: booking?.customerEmail ?? '',
      customerPhone: booking?.customerPhone ?? '',
      destination: booking?.destination ?? '',
      startDate: toDateInputValue(booking?.startDate),
      endDate: toDateInputValue(booking?.endDate),
      travelerCount: booking?.travelerCount != null ? String(booking.travelerCount) : '',
      status: booking?.status ?? 'PENDING',
      totalAmount: booking != null ? String(booking.totalAmount) : '',
      amountPaid: booking != null ? String(booking.amountPaid) : '0',
      currency: booking?.currency ?? 'INR',
      packageId: booking?.packageId ?? NONE,
      assignedToId: booking?.assignedToId ?? NONE,
      notes: booking?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      booking
        ? api.patch<Booking>(`/bookings/${booking.id}`, payload)
        : api.post<Booking>('/bookings', payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
      if (booking) queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      toast.success(booking ? 'Booking updated' : 'Booking created');
      onDone(saved);
    },
    onError: (err) => handleApiError(err, setError),
  });

  const onSubmit = (values: Values) => {
    mutation.mutate({
      customerName: values.customerName.trim(),
      customerEmail: values.customerEmail.trim() || null,
      customerPhone: values.customerPhone.trim() || null,
      destination: values.destination.trim(),
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      travelerCount: values.travelerCount ? Number(values.travelerCount) : null,
      status: values.status,
      totalAmount: values.totalAmount ? Number(values.totalAmount) : 0,
      amountPaid: values.amountPaid ? Number(values.amountPaid) : 0,
      currency: (values.currency || 'INR').toUpperCase(),
      packageId: values.packageId !== NONE ? values.packageId : null,
      assignedToId: values.assignedToId !== NONE ? values.assignedToId : null,
      notes: values.notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Customer name" htmlFor="customerName" error={errors.customerName?.message} required>
        <Input id="customerName" aria-invalid={!!errors.customerName} {...register('customerName')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="customerEmail" error={errors.customerEmail?.message}>
          <Input id="customerEmail" type="email" {...register('customerEmail')} />
        </Field>
        <Field label="Phone" htmlFor="customerPhone">
          <Input id="customerPhone" {...register('customerPhone')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination" htmlFor="destination" error={errors.destination?.message} required>
          <Input id="destination" placeholder="e.g. Bali, Indonesia" {...register('destination')} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Departure" htmlFor="startDate">
          <Input id="startDate" type="date" {...register('startDate')} />
        </Field>
        <Field label="Return" htmlFor="endDate">
          <Input id="endDate" type="date" {...register('endDate')} />
        </Field>
        <Field label="Travellers" htmlFor="travelerCount">
          <Input id="travelerCount" type="number" min={1} {...register('travelerCount')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Total amount" htmlFor="totalAmount">
          <Input id="totalAmount" type="number" min={0} {...register('totalAmount')} />
        </Field>
        <Field label="Amount paid" htmlFor="amountPaid">
          <Input id="amountPaid" type="number" min={0} {...register('amountPaid')} />
        </Field>
        <Field label="Currency" htmlFor="currency">
          <Input id="currency" maxLength={3} className="uppercase" {...register('currency')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Package" htmlFor="packageId">
          <Controller
            control={control}
            name="packageId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  // Prefill trip facts from the package — only where nothing's typed yet.
                  const pkg = packages.find((p) => p.id === v);
                  if (!pkg) return;
                  if (!getValues('destination').trim()) setValue('destination', pkg.destination);
                  const amount = getValues('totalAmount');
                  if (!amount || amount === '0') setValue('totalAmount', String(pkg.priceAmount));
                  if (!getValues('currency').trim()) setValue('currency', pkg.priceCurrency);
                }}
              >
                <SelectTrigger id="packageId">
                  <SelectValue placeholder="No package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No package</SelectItem>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="Assigned to" htmlFor="assignedToId">
          <Controller
            control={control}
            name="assignedToId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="assignedToId">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" placeholder="Anything useful about this trip…" {...register('notes')} />
      </Field>

      <DialogFooter className="pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {booking ? 'Save changes' : 'Create booking'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function BookingFormDialog({
  open,
  onOpenChange,
  booking,
  users,
  packages,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  users: User[];
  packages: TravelPackage[];
  onSaved?: (saved: Booking) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{booking ? 'Edit booking' : 'New booking'}</DialogTitle>
          <DialogDescription>
            {booking ? 'Update this booking.' : 'Create a trip booking for a customer.'}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BookingForm
            key={booking?.id ?? 'new'}
            booking={booking}
            users={users}
            packages={packages}
            onDone={(saved) => {
              onOpenChange(false);
              onSaved?.(saved);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
