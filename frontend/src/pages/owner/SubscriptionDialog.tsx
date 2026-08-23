import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { handleApiError } from '@/lib/formErrors';
import { toDateInputValue } from '@/lib/format';
import type { OrganizationSubscription, SubscriptionStatus } from './types';

const schema = z.object({
  planName: z.string().trim().min(1, 'Plan name is required'),
  amount: z.string().min(1, 'Amount is required'),
  currency: z.string().trim().length(3, 'Use a 3-letter code, e.g. INR'),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']),
  startedAt: z.string().min(1, 'Start date is required'),
  renewsAt: z.string().optional(),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function SubscriptionDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  subscription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  subscription: OrganizationSubscription | null;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        planName: subscription?.planName ?? '',
        amount: subscription ? String(subscription.amount) : '',
        currency: subscription?.currency ?? 'INR',
        status: subscription?.status ?? 'ACTIVE',
        startedAt: subscription ? toDateInputValue(subscription.startedAt) : toDateInputValue(new Date().toISOString()),
        renewsAt: subscription?.renewsAt ? toDateInputValue(subscription.renewsAt) : '',
        notes: subscription?.notes ?? '',
      });
    }
  }, [open, subscription, reset]);

  const save = useMutation({
    mutationFn: (values: Values) =>
      api.put(`/platform-admin/subscriptions/${organizationId}`, {
        planName: values.planName.trim(),
        amount: Number(values.amount),
        currency: values.currency.toUpperCase(),
        status: values.status,
        startedAt: values.startedAt,
        renewsAt: values.renewsAt || undefined,
        notes: values.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Subscription saved');
      queryClient.invalidateQueries({ queryKey: ['owner', 'subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['owner', 'revenue'] });
      onOpenChange(false);
    },
    onError: (err) => handleApiError(err, setError),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subscription ? 'Edit' : 'Set'} subscription</DialogTitle>
          <DialogDescription>{organizationName} — manually tracked, no payment gateway involved.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
          <Field label="Plan name" htmlFor="planName" error={errors.planName?.message} required>
            <Input id="planName" placeholder="e.g. Growth, Pro, Enterprise" {...register('planName')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" htmlFor="amount" error={errors.amount?.message} required>
              <Input id="amount" type="number" min={0} {...register('amount')} />
            </Field>
            <Field label="Currency" htmlFor="currency" error={errors.currency?.message} required>
              <Input id="currency" maxLength={3} className="uppercase" {...register('currency')} />
            </Field>
          </div>
          <Field label="Status" htmlFor="status" required>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v as SubscriptionStatus)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Started" htmlFor="startedAt" error={errors.startedAt?.message} required>
              <Input id="startedAt" type="date" {...register('startedAt')} />
            </Field>
            <Field label="Renews" htmlFor="renewsAt" hint="Optional">
              <Input id="renewsAt" type="date" {...register('renewsAt')} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes" hint="Optional — payment method, discount, whatever's useful.">
            <Textarea id="notes" rows={2} {...register('notes')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
