import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { handleApiError } from '@/lib/formErrors';
import { OwnerShell } from './OwnerShell';
import type { ExpenseCategory, PlatformExpense } from './types';

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  HOSTING: 'Hosting',
  API_COSTS: 'API costs',
  SOFTWARE: 'Software',
  MARKETING: 'Marketing',
  PAYROLL: 'Payroll',
  OTHER: 'Other',
};

const schema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  category: z.enum(['HOSTING', 'API_COSTS', 'SOFTWARE', 'MARKETING', 'PAYROLL', 'OTHER']),
  amount: z.string().min(1, 'Amount is required'),
  currency: z.string().trim().length(3, 'Use a 3-letter code, e.g. INR'),
  expenseDate: z.string().min(1, 'Date is required'),
});
type Values = z.infer<typeof schema>;

function AddExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', category: 'OTHER', amount: '', currency: 'INR', expenseDate: new Date().toISOString().slice(0, 10) },
  });

  const create = useMutation({
    mutationFn: (values: Values) =>
      api.post('/platform-admin/expenses', { ...values, amount: Number(values.amount), currency: values.currency.toUpperCase() }),
    onSuccess: () => {
      toast.success('Expense added');
      queryClient.invalidateQueries({ queryKey: ['owner', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['owner', 'profit'] });
      reset();
      onOpenChange(false);
    },
    onError: (err) => handleApiError(err, setError),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log an expense</DialogTitle>
          <DialogDescription>Platform operating cost — hosting, APIs, tools, whatever it is.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4" noValidate>
          <Field label="Description" htmlFor="description" error={errors.description?.message} required>
            <Input id="description" placeholder="e.g. Hostinger KVM 4 — August" {...register('description')} />
          </Field>
          <Field label="Category" htmlFor="category" required>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => field.onChange(v as ExpenseCategory)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" htmlFor="amount" error={errors.amount?.message} required>
              <Input id="amount" type="number" min={0} {...register('amount')} />
            </Field>
            <Field label="Currency" htmlFor="currency" error={errors.currency?.message} required>
              <Input id="currency" maxLength={3} className="uppercase" {...register('currency')} />
            </Field>
          </div>
          <Field label="Date" htmlFor="expenseDate" error={errors.expenseDate?.message} required>
            <Input id="expenseDate" type="date" {...register('expenseDate')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Add expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OwnerExpensesPage() {
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'expenses'],
    queryFn: () => api.get<PlatformExpense[]>('/platform-admin/expenses?months=12'),
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/platform-admin/expenses/${id}`),
    onSuccess: () => {
      toast.success('Expense removed');
      queryClient.invalidateQueries({ queryKey: ['owner', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['owner', 'profit'] });
    },
    onError: (err) => handleApiError(err),
  });

  const total = (data ?? []).reduce((sum, e) => sum + e.amount, 0);

  return (
    <OwnerShell>
      <PageHeader title="Expenses" description={`Platform operating costs, last 12 months. Total: ${formatCurrency(total, 'INR')}`}>
        <Button onClick={() => setAddOpen(true)}>
          <Plus /> Log expense
        </Button>
      </PageHeader>

      <AddExpenseDialog open={addOpen} onOpenChange={setAddOpen} />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState title="No expenses logged yet" className="border-none" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{e.description}</td>
                  <td className="px-4 py-3">
                    <Badge variant="muted">{CATEGORY_LABEL[e.category]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatCurrency(e.amount, e.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.expenseDate)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteExpense.mutate(e.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete expense"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </OwnerShell>
  );
}
