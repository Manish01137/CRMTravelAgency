import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { usePlatformAdminAuth } from '@/context/PlatformAdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { handleApiError } from '@/lib/formErrors';
import { DarkField } from './DarkField';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type Values = z.infer<typeof schema>;

export function OwnerLoginPage() {
  const { login } = usePlatformAdminAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values: Values) => {
    try {
      await login(values.email, values.password);
      toast.success('Welcome back');
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0b0d12] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Owner Access</h1>
          <p className="mt-1.5 text-sm text-white/50">Platform administration — Joinetra staff only</p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 shadow-soft sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <DarkField label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
            </DarkField>
            <DarkField label="Password" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
            </DarkField>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
