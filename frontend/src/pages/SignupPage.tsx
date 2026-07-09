import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { handleApiError } from '@/lib/formErrors';

const schema = z.object({
  organizationName: z.string().trim().min(2, 'Enter your agency name').max(80),
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').max(100),
});
type Values = z.infer<typeof schema>;

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { organizationName: '', name: '', email: '', password: '' },
  });

  const onSubmit = async (values: Values) => {
    try {
      await signup(values);
      toast.success('Your workspace is ready');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  return (
    <AuthLayout
      title="Create your agency workspace"
      subtitle="Start managing leads in minutes — no credit card required"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field label="Agency name" htmlFor="organizationName" error={errors.organizationName?.message} required>
          <Input
            id="organizationName"
            placeholder="Wanderlust Travel Co."
            autoComplete="organization"
            aria-invalid={!!errors.organizationName}
            {...register('organizationName')}
          />
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
        <Field label="Work email" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            placeholder="you@agency.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field
          label="Password"
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
          Create workspace
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You'll be set up as the admin of a brand-new organization.
        </p>
      </form>
    </AuthLayout>
  );
}
