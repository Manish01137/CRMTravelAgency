import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Invoice, InvoiceStatus } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INVOICE_STATUSES, INVOICE_STATUS_STYLES, invoiceRef } from '@/lib/crmMeta';
import { formatCurrency, formatDate, toDateInputValue } from '@/lib/format';
import { amountInWords } from '@/lib/numberToWords';

/* --------------------------- Edit details dialog --------------------------- */
// Fills in the handful of fields the Tax Invoice layout needs that nothing
// else in the app has a way to set yet: bill-to company/address, the advance
// already collected, and each line item's tour dates + sharing capacity.
// Description/quantity/unit price stay as generated — not part of this dialog.

interface DetailsFormValues {
  customerCompanyName: string;
  customerAddress: string;
  advanceAmount: string;
  items: { fromDate: string; toDate: string; sharingCapacity: string }[];
}

function toDetailsValues(invoice: Invoice): DetailsFormValues {
  return {
    customerCompanyName: invoice.customerCompanyName ?? '',
    customerAddress: invoice.customerAddress ?? '',
    advanceAmount: invoice.advanceAmount ? String(invoice.advanceAmount) : '',
    items: invoice.items.map((item) => ({
      fromDate: toDateInputValue(item.fromDate),
      toDate: toDateInputValue(item.toDate),
      sharingCapacity: item.sharingCapacity ?? '',
    })),
  };
}

function InvoiceDetailsDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<DetailsFormValues>({
    defaultValues: toDetailsValues(invoice),
  });

  useEffect(() => {
    if (open) reset(toDetailsValues(invoice));
  }, [open, invoice, reset]);

  const mutation = useMutation({
    mutationFn: (values: DetailsFormValues) =>
      api.patch<Invoice>(`/invoices/${invoice.id}`, {
        customerCompanyName: values.customerCompanyName.trim() || null,
        customerAddress: values.customerAddress.trim() || null,
        advanceAmount: values.advanceAmount ? Number(values.advanceAmount) : 0,
        items: invoice.items.map((item, i) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          fromDate: values.items[i]?.fromDate || undefined,
          toDate: values.items[i]?.toDate || undefined,
          sharingCapacity: values.items[i]?.sharingCapacity.trim() || undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      toast.success('Invoice details updated');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update invoice'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit invoice details</DialogTitle>
          <DialogDescription>Bill-to extras and per-trip dates for the Tax Invoice layout.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          noValidate
        >
          <Field label="Client company" htmlFor="customerCompanyName" hint="Optional — shown under the client's name.">
            <Input id="customerCompanyName" placeholder="Acme Corp" {...register('customerCompanyName')} />
          </Field>
          <Field label="Client address" htmlFor="customerAddress">
            <Textarea id="customerAddress" rows={2} placeholder="Flat 4B, MG Road, Pune" {...register('customerAddress')} />
          </Field>
          <Field label="Advance amount" htmlFor="advanceAmount" hint="Already collected — subtracted from the invoice value.">
            <Input id="advanceAmount" type="number" min={0} placeholder="0" {...register('advanceAmount')} />
          </Field>

          {invoice.items.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Tour dates & sharing, per line item</p>
              {invoice.items.map((item, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <p className="mb-2 truncate text-xs font-medium text-muted-foreground">{item.description}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="From" htmlFor={`item-${i}-from`}>
                      <Input id={`item-${i}-from`} type="date" {...register(`items.${i}.fromDate`)} />
                    </Field>
                    <Field label="To" htmlFor={`item-${i}-to`}>
                      <Input id={`item-${i}-to`} type="date" {...register(`items.${i}.toDate`)} />
                    </Field>
                    <Field label="Sharing" htmlFor={`item-${i}-sharing`}>
                      <Input id={`item-${i}-sharing`} placeholder="Double" {...register(`items.${i}.sharingCapacity`)} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Tour date cell ---------------------------- */

function tourDateCell(fromDate?: string | null, toDate?: string | null): ReactNode {
  if (!fromDate && !toDate) return null;
  if (fromDate && toDate) {
    return (
      <>
        {formatDate(fromDate)}
        <br />
        to {formatDate(toDate)}
      </>
    );
  }
  return formatDate(fromDate ?? toDate);
}

/* ----------------------------------- Page ----------------------------------- */

/**
 * Formal Tax Invoice document — plain black-on-white, thin borders, no
 * brochure-style colors. Rendered OUTSIDE the app shell so window.print()
 * produces a tidy A4 page; on-screen controls are print-hidden.
 */
export function InvoiceViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

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
  const org = organization;
  const remaining = invoice.total - invoice.advanceAmount;
  const hasPaymentBox = !!(org?.bankName || org?.bankAccountNumber || org?.ifscCode || org?.gstin || org?.pan || org?.stateCode || org?.hsnCode);

  return (
    <div className="min-h-dvh bg-surface py-6 print:bg-white print:py-0">
      {/* Toolbar (hidden when printing) */}
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit details
          </Button>
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

      <InvoiceDetailsDialog invoice={invoice} open={editOpen} onOpenChange={setEditOpen} />

      {/* Document — plain formal tax-invoice styling: black text on white, 1px black rules. */}
      <div
        className="mx-auto max-w-3xl bg-white px-6 py-8 text-black shadow-card print:max-w-none print:shadow-none sm:rounded-xl sm:px-10 sm:py-10"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Status pill — screen only, doesn't belong on the printed document itself */}
        <div className="mb-4 flex justify-end print:hidden">
          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', st.pill)}>
            {st.label}
          </span>
        </div>

        {/* 1. Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt="" className="h-16 w-16 object-contain" />
          ) : (
            <div />
          )}
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide">{org?.name ?? 'Travel Agency'}</p>
            {org?.address && <p className="mt-1 max-w-xs text-sm leading-snug">Regd. Office: {org.address}</p>}
            {(org?.contactPhone || org?.secondaryPhone) && (
              <p className="mt-1 text-sm">
                Tel. {[org?.contactPhone, org?.secondaryPhone].filter(Boolean).join(', ')}
              </p>
            )}
            {org?.contactEmail && <p className="mt-0.5 text-sm underline">Email Id: {org.contactEmail}</p>}
            {org?.secondaryEmail && <p className="mt-0.5 text-sm underline">Email Id: {org.secondaryEmail}</p>}
          </div>
        </div>

        {/* 2. Rule + title */}
        <hr className="mt-4 border-black" />
        <p className="mt-3 text-center text-lg font-bold uppercase tracking-wide">Tax Invoice</p>
        <hr className="mt-3 border-black" />

        {/* 3. Meta row */}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <p>
            <span className="font-semibold">Invoice No.</span> {invoiceRef(invoice.invoiceNumber)}
          </p>
          <p>
            <span className="font-semibold">Invoice Date:</span> {formatDate(invoice.issueDate)}
          </p>
        </div>
        {org?.stateName && (
          <p className="mt-1 text-sm">
            <span className="font-semibold">Place of Supply:</span> {org.stateName}
            {org.stateCode ? ` (${org.stateCode})` : ''}
          </p>
        )}

        {/* 4. Bill to */}
        <div className="mt-5 text-sm">
          <p className="font-bold">BILL TO:</p>
          <p className="mt-1">
            <span className="font-semibold">Name:</span> {invoice.customerName}
          </p>
          {invoice.customerCompanyName && (
            <p>
              <span className="font-semibold">Company:</span> {invoice.customerCompanyName}
            </p>
          )}
          {invoice.customerAddress && (
            <p className="max-w-md whitespace-pre-wrap">
              <span className="font-semibold">Address:</span> {invoice.customerAddress}
            </p>
          )}
          {invoice.customerPhone && (
            <p>
              <span className="font-semibold">Contact No.</span> {invoice.customerPhone}
            </p>
          )}
        </div>

        {/* 5. Line items */}
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1.5 text-left font-semibold">Description</th>
              <th className="border border-black px-2 py-1.5 text-left font-semibold">Tour Date</th>
              <th className="border border-black px-2 py-1.5 text-left font-semibold">Sharing Capacity</th>
              <th className="border border-black px-2 py-1.5 text-right font-semibold">No. of Person</th>
              <th className="border border-black px-2 py-1.5 text-right font-semibold">Amount Per Person</th>
              <th className="border border-black px-2 py-1.5 text-right font-semibold">Total Amount ({invoice.currency})</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td className="border border-black px-2 py-1.5 align-top">{item.description}</td>
                <td className="border border-black px-2 py-1.5 align-top">{tourDateCell(item.fromDate, item.toDate)}</td>
                <td className="border border-black px-2 py-1.5 align-top">{item.sharingCapacity}</td>
                <td className="border border-black px-2 py-1.5 text-right align-top">{item.quantity}</td>
                <td className="border border-black px-2 py-1.5 text-right align-top">
                  {formatCurrency(item.unitPrice, invoice.currency)}
                </td>
                <td className="border border-black px-2 py-1.5 text-right align-top">
                  {formatCurrency(item.quantity * item.unitPrice, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 6. Summary */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span>Invoice Value:</span>
              <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.taxPercent > 0 && (
              <div className="flex justify-between">
                <span>Tax ({invoice.taxPercent}%):</span>
                <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Advance Amount:</span>
              <span>{formatCurrency(invoice.advanceAmount, invoice.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-black pt-1.5 font-bold">
              <span>Remaining Payable Value:</span>
              <span>{formatCurrency(remaining, invoice.currency)}</span>
            </div>
            <p className="text-right text-xs italic">({amountInWords(remaining)})</p>
          </div>
        </div>

        {/* 7. Payment / signature box */}
        {(hasPaymentBox || org?.signatureImageUrl || org?.signatoryTitle) && (
          <div className="mt-6 grid grid-cols-1 border border-black text-sm sm:grid-cols-2">
            <div className="space-y-0.5 border-black p-3 sm:border-r">
              <p>Payment needs to be made in favour of – {org?.name}</p>
              {(org?.bankName || org?.bankAccountNumber) && (
                <p>
                  A/c No. {org?.bankName}
                  {org?.bankName && org?.bankAccountNumber ? ' – ' : ''}
                  {org?.bankAccountNumber}
                </p>
              )}
              {org?.ifscCode && <p>IFSC Code – {org.ifscCode}</p>}
              {org?.gstin && <p>GSTIN - {org.gstin}</p>}
              {org?.pan && <p>PAN – {org.pan}</p>}
              {org?.stateCode && <p>State Code – {org.stateCode}</p>}
              {org?.hsnCode && <p>HSN - {org.hsnCode}</p>}
            </div>
            <div className="flex flex-col items-center justify-between p-3 text-center">
              <p>For {org?.name}</p>
              {org?.signatureImageUrl ? (
                <img src={org.signatureImageUrl} alt="Signature" className="my-2 h-14 object-contain" />
              ) : (
                <div className="my-6" />
              )}
              {org?.signatoryTitle && <p>{org.signatoryTitle}</p>}
              <p className="text-xs">Auth Signatory</p>
            </div>
          </div>
        )}

        {/* 8. Terms & conditions */}
        {org?.invoiceTermsConditions && (
          <div className="mt-6 text-sm">
            <p className="font-bold">Term & Conditions:</p>
            {org.invoiceTermsConditions.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
