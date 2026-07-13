import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Plane, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Invoice, InvoiceStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INVOICE_STATUSES, INVOICE_STATUS_STYLES, bookingRef, invoiceRef } from '@/lib/crmMeta';
import { formatCurrency, formatDate } from '@/lib/format';

/**
 * Clean, print-ready invoice document. Rendered OUTSIDE the app shell so
 * window.print() produces a tidy A4 page; on-screen controls are print-hidden.
 */
export function InvoiceViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useAuth();

  const invoiceQuery = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: InvoiceStatus) => api.patch<Invoice>(`/invoices/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice status updated');
    },
    onError: () => toast.error('Could not update status'),
  });

  const invoice = invoiceQuery.data;
  const brand = organization?.brandPrimaryColor ?? '#4F46E5';

  if (invoiceQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/invoices')}>
          <ArrowLeft /> Back
        </Button>
      </div>
    );
  }

  const st = INVOICE_STATUS_STYLES[invoice.status];

  return (
    <div className="min-h-dvh bg-surface py-6 print:bg-white print:py-0">
      {/* Toolbar (hidden when printing) */}
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Select value={invoice.status} onValueChange={(v) => statusMutation.mutate(v as InvoiceStatus)}>
            <SelectTrigger className="h-10 w-36" aria-label="Invoice status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVOICE_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Document */}
      <div className="mx-auto max-w-3xl bg-white px-6 py-8 shadow-card print:max-w-none print:shadow-none sm:rounded-xl sm:px-10 sm:py-10">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-4 pb-6" style={{ borderColor: brand }}>
          <div className="flex items-center gap-3">
            {organization?.logoUrl ? (
              <img src={organization.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ backgroundColor: brand }}>
                <Plane className="size-6" />
              </span>
            )}
            <div>
              <p className="font-display text-xl font-bold text-foreground">{organization?.name ?? 'Travel Agency'}</p>
              <p className="text-xs text-muted-foreground">Travel & Tourism Services</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold" style={{ color: brand }}>
              INVOICE
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{invoiceRef(invoice.invoiceNumber)}</p>
            <span className={cn('mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', st.pill)}>
              {st.label}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billed to</p>
            <p className="mt-1 font-semibold text-foreground">{invoice.customerName}</p>
            {invoice.customerPhone && <p className="text-sm text-muted-foreground">{invoice.customerPhone}</p>}
            {invoice.customerEmail && <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
            <p className="mt-1 text-sm text-foreground">Issued: {formatDate(invoice.issueDate)}</p>
            {invoice.dueDate && <p className="text-sm text-foreground">Due: {formatDate(invoice.dueDate)}</p>}
          </div>
          {invoice.booking && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking</p>
              <p className="mt-1 text-sm text-foreground">{bookingRef(invoice.booking.bookingNumber)}</p>
              <p className="text-sm text-muted-foreground">{invoice.booking.destination}</p>
            </div>
          )}
        </div>

        {/* Line items */}
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 font-semibold">Description</th>
              <th className="py-2.5 text-center font-semibold">Qty</th>
              <th className="py-2.5 text-right font-semibold">Unit price</th>
              <th className="py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td className="py-3 text-foreground">{item.description}</td>
                <td className="py-3 text-center text-muted-foreground">{item.quantity}</td>
                <td className="py-3 text-right text-muted-foreground">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                <td className="py-3 text-right font-medium text-foreground">
                  {formatCurrency(item.quantity * item.unitPrice, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.taxPercent > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({invoice.taxPercent}%)</span>
                <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-border pt-2 font-display text-lg font-bold text-foreground">
              <span>Total</span>
              <span style={{ color: brand }}>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 rounded-lg bg-surface p-4 text-sm text-muted-foreground print:border print:border-border">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Notes</p>
            {invoice.notes}
          </div>
        )}

        <p className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Thank you for travelling with {organization?.name ?? 'us'} ✈ Generated by Voyage CRM
        </p>
      </div>
    </div>
  );
}
