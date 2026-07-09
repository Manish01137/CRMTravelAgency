import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Lead, User } from '@/types';
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
import { LEAD_SOURCES, LEAD_STATUSES } from '@/lib/leadMeta';
import { handleApiError } from '@/lib/formErrors';
import { toDateInputValue } from '@/lib/format';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.union([z.literal(''), z.string().email('Enter a valid email')]),
  phone: z.string().max(40),
  source: z.enum([
    'WHATSAPP',
    'INSTAGRAM',
    'FACEBOOK',
    'WEBSITE',
    'REFERRAL',
    'WALK_IN',
    'PHONE',
    'MANUAL',
    'OTHER',
  ]),
  status: z.enum([
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'PROPOSAL_SENT',
    'NEGOTIATION',
    'WON',
    'LOST',
  ]),
  destination: z.string().max(120),
  travelDate: z.string(),
  travelerCount: z.string(),
  budgetAmount: z.string(),
  budgetCurrency: z.string().max(3),
  notes: z.string().max(5000),
  assignedToId: z.string(),
});
type Values = z.infer<typeof schema>;

const UNASSIGNED = 'unassigned';

function LeadForm({ lead, users, onDone }: { lead: Lead | null; users: User[]; onDone: () => void }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: lead?.name ?? '',
      email: lead?.email ?? '',
      phone: lead?.phone ?? '',
      source: lead?.source ?? 'MANUAL',
      status: lead?.status ?? 'NEW',
      destination: lead?.destination ?? '',
      travelDate: toDateInputValue(lead?.travelDate),
      travelerCount: lead?.travelerCount != null ? String(lead.travelerCount) : '',
      budgetAmount: lead?.budgetAmount != null ? String(lead.budgetAmount) : '',
      budgetCurrency: lead?.budgetCurrency ?? 'USD',
      notes: lead?.notes ?? '',
      assignedToId: lead?.assignedToId ?? UNASSIGNED,
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      lead ? api.patch<Lead>(`/leads/${lead.id}`, payload) : api.post<Lead>('/leads', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      toast.success(lead ? 'Lead updated' : 'Lead created');
      onDone();
    },
    onError: (err) => handleApiError(err, setError),
  });

  const onSubmit = (values: Values) => {
    const assignedToId =
      values.assignedToId && values.assignedToId !== UNASSIGNED ? values.assignedToId : null;

    mutation.mutate({
      name: values.name.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      source: values.source,
      status: values.status,
      destination: values.destination.trim() || null,
      travelDate: values.travelDate || null,
      travelerCount: values.travelerCount ? Number(values.travelerCount) : null,
      budgetAmount: values.budgetAmount ? Number(values.budgetAmount) : null,
      budgetCurrency: (values.budgetCurrency || 'USD').toUpperCase(),
      notes: values.notes.trim() || null,
      assignedToId,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Name" htmlFor="name" error={errors.name?.message} required>
        <Input id="name" placeholder="Full name" aria-invalid={!!errors.name} {...register('name')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" placeholder="name@example.com" {...register('email')} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" placeholder="+1 555 000 0000" {...register('phone')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source" htmlFor="source">
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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
                  {LEAD_STATUSES.map((s) => (
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination" htmlFor="destination" error={errors.destination?.message}>
          <Input id="destination" placeholder="e.g. Bali, Indonesia" {...register('destination')} />
        </Field>
        <Field label="Travel date" htmlFor="travelDate">
          <Input id="travelDate" type="date" {...register('travelDate')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Travelers" htmlFor="travelerCount" error={errors.travelerCount?.message}>
          <Input id="travelerCount" type="number" min={1} placeholder="2" {...register('travelerCount')} />
        </Field>
        <Field label="Budget" htmlFor="budgetAmount" error={errors.budgetAmount?.message}>
          <Input id="budgetAmount" type="number" min={0} placeholder="2500" {...register('budgetAmount')} />
        </Field>
        <Field label="Currency" htmlFor="budgetCurrency" error={errors.budgetCurrency?.message}>
          <Input id="budgetCurrency" maxLength={3} placeholder="USD" className="uppercase" {...register('budgetCurrency')} />
        </Field>
      </div>

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
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
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

      <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <Textarea id="notes" placeholder="Anything useful about this enquiry…" {...register('notes')} />
      </Field>

      <DialogFooter className="pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {lead ? 'Save changes' : 'Create lead'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  users: User[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit lead' : 'New lead'}</DialogTitle>
          <DialogDescription>
            {lead ? "Update this lead's details." : 'Add a new enquiry to your pipeline.'}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <LeadForm key={lead?.id ?? 'new'} lead={lead} users={users} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
