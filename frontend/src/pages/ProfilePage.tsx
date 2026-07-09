import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABEL } from '@/lib/leadMeta';
import { formatDate, formatDateTime, initials } from '@/lib/format';
import { handleApiError } from '@/lib/formErrors';

const nameSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(80) });
type NameValues = z.infer<typeof nameSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(100),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function ProfilePage() {
  const { user, organization, setUser } = useAuth();

  const nameForm = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user?.name ?? '' },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const nameMutation = useMutation({
    mutationFn: (values: NameValues) => api.patch<User>('/users/me', { name: values.name }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Profile updated');
      nameForm.reset({ name: updated.name });
    },
    onError: (err) => handleApiError(err, nameForm.setError),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      api.patch<User>('/users/me', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      toast.success('Password changed');
      passwordForm.reset();
    },
    onError: (err) => handleApiError(err, passwordForm.setError),
  });

  if (!user) return null;

  return (
    <div>
      <PageHeader title="My profile" description="Manage your personal details and password." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <p className="mt-3 font-display text-lg font-semibold text-foreground">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge variant={user.role === 'ADMIN' ? 'default' : 'muted'} className="mt-3">
                {ROLE_LABEL[user.role]}
              </Badge>
            </div>
            <dl className="mt-6 divide-y divide-border border-t border-border pt-2">
              <InfoRow label="Organization">{organization?.name ?? '—'}</InfoRow>
              <InfoRow label="Member since">{formatDate(user.createdAt)}</InfoRow>
              <InfoRow label="Last sign-in">{formatDateTime(user.lastLoginAt)}</InfoRow>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
              <CardDescription>Update how your name appears across the workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={nameForm.handleSubmit((v) => nameMutation.mutate(v))}
                className="space-y-4"
                noValidate
              >
                <Field label="Full name" htmlFor="name" error={nameForm.formState.errors.name?.message}>
                  <Input id="name" {...nameForm.register('name')} />
                </Field>
                <Field label="Email">
                  <Input value={user.email} disabled readOnly />
                </Field>
                <div className="flex justify-end">
                  <Button type="submit" disabled={nameMutation.isPending}>
                    {nameMutation.isPending && <Spinner />}
                    Save changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Choose a strong password you don't use elsewhere.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={passwordForm.handleSubmit((v) => passwordMutation.mutate(v))}
                className="space-y-4"
                noValidate
              >
                <Field
                  label="Current password"
                  htmlFor="currentPassword"
                  error={passwordForm.formState.errors.currentPassword?.message}
                >
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    {...passwordForm.register('currentPassword')}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="New password"
                    htmlFor="newPassword"
                    error={passwordForm.formState.errors.newPassword?.message}
                  >
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      {...passwordForm.register('newPassword')}
                    />
                  </Field>
                  <Field
                    label="Confirm new password"
                    htmlFor="confirmPassword"
                    error={passwordForm.formState.errors.confirmPassword?.message}
                  >
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      {...passwordForm.register('confirmPassword')}
                    />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending && <Spinner />}
                    Change password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
