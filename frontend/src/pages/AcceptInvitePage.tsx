import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { InvitePreview } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { handleApiError } from '@/lib/formErrors';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  password: z.string().min(8, 'Use at least 8 characters').max(100),
});
type Values = z.infer<typeof schema>;

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();

  const previewQuery = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<InvitePreview>(`/auth/invite/${encodeURIComponent(token)}`),
    enabled: token.length > 0,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', password: '' } });

  const onSubmit = async (values: Values) => {
    try {
      await acceptInvite({ token, name: values.name, password: values.password });
      toast.success('Welcome to the team!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  if (!token || previewQuery.isError) {
    return (
      <AuthLayout
        title="Invitation not found"
        subtitle="This invitation link is invalid or has expired."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        }
      >
        <p className="text-center text-sm text-muted-foreground">
          Ask your workspace admin to send you a fresh invitation.
        </p>
      </AuthLayout>
    );
  }

  if (previewQuery.isLoading || !previewQuery.data) {
    return (
      <AuthLayout title="Checking your invitation…">
        <div className="flex justify-center py-6">
          <Spinner className="size-6 text-primary" />
        </div>
      </AuthLayout>
    );
  }

  const preview = previewQuery.data;

  return (
    <AuthLayout
      title={`Join ${preview.organizationName}`}
      subtitle="Set up your account to get started"
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in instead
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field label="Email">
          <Input value={preview.email} disabled readOnly />
        </Field>
        <Field label="Your name" htmlFor="name" error={errors.name?.message} required>
          <Input
            id="name"
            placeholder="Alex Morgan"
            autoComplete="name"
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </Field>
        <Field
          label="Create a password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters"
          required
        >
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Join {preview.organizationName}
        </Button>
      </form>
    </AuthLayout>
  );
}
