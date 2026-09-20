import { Controller, useForm } from 'react-hook-form';
import { Receipt } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Organization } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ImageUpload } from '@/components/ui/image-upload';
import { handleApiError } from '@/lib/formErrors';

interface TaxInvoiceFormValues {
  secondaryPhone: string;
  secondaryEmail: string;
  stateName: string;
  stateCode: string;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  gstin: string;
  pan: string;
  hsnCode: string;
  signatureImageUrl: string;
  signatoryTitle: string;
  invoiceTermsConditions: string;
}

/** Bank/tax/signature details printed on the Tax Invoice header, payment box, and footer. */
export function InvoiceSettingsPage() {
  const { organization, setOrganization } = useAuth();
  const { register, handleSubmit, control, reset } = useForm<TaxInvoiceFormValues>({
    defaultValues: {
      secondaryPhone: organization?.secondaryPhone ?? '',
      secondaryEmail: organization?.secondaryEmail ?? '',
      stateName: organization?.stateName ?? '',
      stateCode: organization?.stateCode ?? '',
      bankName: organization?.bankName ?? '',
      bankAccountNumber: organization?.bankAccountNumber ?? '',
      ifscCode: organization?.ifscCode ?? '',
      gstin: organization?.gstin ?? '',
      pan: organization?.pan ?? '',
      hsnCode: organization?.hsnCode ?? '',
      signatureImageUrl: organization?.signatureImageUrl ?? '',
      signatoryTitle: organization?.signatoryTitle ?? '',
      invoiceTermsConditions: organization?.invoiceTermsConditions ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (v: TaxInvoiceFormValues) =>
      api.patch<Organization>('/organization', {
        secondaryPhone: v.secondaryPhone.trim() || null,
        secondaryEmail: v.secondaryEmail.trim() || null,
        stateName: v.stateName.trim() || null,
        stateCode: v.stateCode.trim() || null,
        bankName: v.bankName.trim() || null,
        bankAccountNumber: v.bankAccountNumber.trim() || null,
        ifscCode: v.ifscCode.trim() || null,
        gstin: v.gstin.trim() || null,
        pan: v.pan.trim() || null,
        hsnCode: v.hsnCode.trim() || null,
        signatureImageUrl: v.signatureImageUrl || null,
        signatoryTitle: v.signatoryTitle.trim() || null,
        invoiceTermsConditions: v.invoiceTermsConditions.trim() || null,
      }),
    onSuccess: (updated) => {
      setOrganization(updated);
      reset({
        secondaryPhone: updated.secondaryPhone ?? '',
        secondaryEmail: updated.secondaryEmail ?? '',
        stateName: updated.stateName ?? '',
        stateCode: updated.stateCode ?? '',
        bankName: updated.bankName ?? '',
        bankAccountNumber: updated.bankAccountNumber ?? '',
        ifscCode: updated.ifscCode ?? '',
        gstin: updated.gstin ?? '',
        pan: updated.pan ?? '',
        hsnCode: updated.hsnCode ?? '',
        signatureImageUrl: updated.signatureImageUrl ?? '',
        signatoryTitle: updated.signatoryTitle ?? '',
        invoiceTermsConditions: updated.invoiceTermsConditions ?? '',
      });
      toast.success('Tax invoice details updated');
    },
    onError: (err) => handleApiError(err),
  });

  if (!organization) return null;

  return (
    <div>
      <PageHeader title="Invoice Detail" description="Bank, tax and signature details printed on every Tax Invoice." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" /> Tax invoice details
          </CardTitle>
          <CardDescription>
            Printed on every Tax Invoice — header, payment box, and footer. Registered office address,
            phone, and email come from Host Page settings; everything below is invoice-specific. Leave
            anything blank and it simply won't appear on the invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Second phone number" htmlFor="secondaryPhone" hint="Shown alongside your main phone in the header.">
                <Input id="secondaryPhone" placeholder="+91 98765 43210" {...register('secondaryPhone')} />
              </Field>
              <Field label="Second email" htmlFor="secondaryEmail">
                <Input id="secondaryEmail" type="email" placeholder="accounts@agency.com" {...register('secondaryEmail')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="State" htmlFor="stateName" hint="Used as the Place of Supply on every invoice.">
                <Input id="stateName" placeholder="Maharashtra" {...register('stateName')} />
              </Field>
              <Field label="State code" htmlFor="stateCode">
                <Input id="stateCode" placeholder="27" {...register('stateCode')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank name" htmlFor="bankName">
                <Input id="bankName" placeholder="HDFC Bank, Andheri branch" {...register('bankName')} />
              </Field>
              <Field label="Bank account number" htmlFor="bankAccountNumber">
                <Input id="bankAccountNumber" placeholder="50100123456789" {...register('bankAccountNumber')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="IFSC code" htmlFor="ifscCode">
                <Input id="ifscCode" className="uppercase" placeholder="HDFC0001234" {...register('ifscCode')} />
              </Field>
              <Field label="GSTIN" htmlFor="gstin">
                <Input id="gstin" className="uppercase" placeholder="27AAAAA0000A1Z5" {...register('gstin')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="PAN" htmlFor="pan">
                <Input id="pan" className="uppercase" placeholder="AAAAA0000A" {...register('pan')} />
              </Field>
              <Field label="HSN / SAC code" htmlFor="hsnCode">
                <Input id="hsnCode" placeholder="998552" {...register('hsnCode')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Signature image" hint="Shown above your signatory's name on the invoice.">
                <Controller
                  control={control}
                  name="signatureImageUrl"
                  render={({ field }) => (
                    <div className="max-w-xs">
                      <ImageUpload value={field.value} onChange={(url) => field.onChange(url ?? '')} />
                    </div>
                  )}
                />
              </Field>
              <Field label="Signatory title" htmlFor="signatoryTitle" hint={'e.g. "Director", "Proprietor"'}>
                <Input id="signatoryTitle" placeholder="Director" {...register('signatoryTitle')} />
              </Field>
            </div>
            <Field
              label="Invoice terms & conditions"
              htmlFor="invoiceTermsConditions"
              hint="Printed at the bottom of every Tax Invoice — kept separate from your package cancellation policy."
            >
              <Textarea
                id="invoiceTermsConditions"
                rows={4}
                placeholder={
                  'We declare that there is no tax payable under reverse charge mechanism.\nThe total invoice value mentioned herein shall be non-refundable in nature.'
                }
                {...register('invoiceTermsConditions')}
              />
            </Field>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Spinner />}
                Save tax invoice details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
