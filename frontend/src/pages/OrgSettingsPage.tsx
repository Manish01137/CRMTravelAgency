import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { initials } from '@/lib/format';
import { handleApiError } from '@/lib/formErrors';

const hex = z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Use a hex color like #4F46E5');

const schema = z.object({
  name: z.string().trim().min(2, 'Agency name is too short').max(80),
  logoUrl: z.union([z.literal(''), z.string().url('Enter a valid URL')]),
  brandPrimaryColor: hex,
  brandSecondaryColor: hex,
});
type Values = z.infer<typeof schema>;

function ColorField({
  control,
  name,
  label,
  error,
}: {
  control: Control<Values>;
  name: 'brandPrimaryColor' | 'brandSecondaryColor';
  label: string;
  error?: string;
}) {
  return (
    <Field label={label} error={error}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${label} picker`}
              value={/^#[0-9a-fA-F]{6}$/.test(field.value) ? field.value : '#000000'}
              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
              className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
            />
            <Input
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="font-mono uppercase"
              maxLength={7}
            />
          </div>
        )}
      />
    </Field>
  );
}

export function OrgSettingsPage() {
  const { organization, setOrganization } = useAuth();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: organization?.name ?? '',
      logoUrl: organization?.logoUrl ?? '',
      brandPrimaryColor: organization?.brandPrimaryColor ?? '#4F46E5',
      brandSecondaryColor: organization?.brandSecondaryColor ?? '#0D9488',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      api.patch<Organization>('/organization', {
        name: values.name,
        logoUrl: values.logoUrl || null,
        brandPrimaryColor: values.brandPrimaryColor,
        brandSecondaryColor: values.brandSecondaryColor,
      }),
    onSuccess: (updated) => {
      setOrganization(updated);
      toast.success('Organization updated');
      reset({
        name: updated.name,
        logoUrl: updated.logoUrl ?? '',
        brandPrimaryColor: updated.brandPrimaryColor,
        brandSecondaryColor: updated.brandSecondaryColor,
      });
    },
    onError: (err) => handleApiError(err, setError),
  });

  if (!organization) return null;

  const preview = watch();
  const previewPrimary = /^#[0-9a-fA-F]{6}$/.test(preview.brandPrimaryColor)
    ? preview.brandPrimaryColor
    : '#4F46E5';
  const previewSecondary = /^#[0-9a-fA-F]{6}$/.test(preview.brandSecondaryColor)
    ? preview.brandSecondaryColor
    : '#0D9488';

  return (
    <div>
      <PageHeader title="Organization" description="Your agency's identity and branding." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>These details appear across your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
              <Field label="Agency name" htmlFor="name" error={errors.name?.message} required>
                <Input id="name" {...register('name')} />
              </Field>
              <Field
                label="Logo URL"
                htmlFor="logoUrl"
                error={errors.logoUrl?.message}
                hint="Paste a link to your logo image. Direct file upload arrives later."
              >
                <Input id="logoUrl" placeholder="https://…/logo.png" {...register('logoUrl')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  control={control}
                  name="brandPrimaryColor"
                  label="Primary color"
                  error={errors.brandPrimaryColor?.message}
                />
                <ColorField
                  control={control}
                  name="brandSecondaryColor"
                  label="Secondary color"
                  error={errors.brandSecondaryColor?.message}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Spinner />}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-1">
          <div
            className="h-2.5 w-full"
            style={{ background: `linear-gradient(to right, ${previewPrimary}, ${previewSecondary})` }}
          />
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>How your brand looks in the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              {preview.logoUrl ? (
                <img
                  src={preview.logoUrl}
                  alt=""
                  className="h-11 w-11 rounded-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: previewPrimary }}
                >
                  {initials(preview.name || organization.name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-display font-semibold text-foreground">
                  {preview.name || organization.name}
                </p>
                <p className="text-xs text-muted-foreground">Travel CRM</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: previewPrimary }}
              >
                Primary button
              </button>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: previewSecondary }}
              >
                Confirmed
              </span>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Sample status</p>
              <Badge variant="success">Booking won</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
