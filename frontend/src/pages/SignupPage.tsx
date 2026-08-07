import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { handleApiError } from '@/lib/formErrors';

const detailsSchema = z.object({
  organizationName: z.string().trim().min(2, 'Enter your agency name').max(80),
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').max(100),
});
type DetailsValues = z.infer<typeof detailsSchema>;

/** Step 2 — enter the 6-digit code sent to `email`. */
function VerifyStep({ email, onBack }: { email: string; onBack: () => void }) {
  const { verifySignup, resendSignupOtp } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(45);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = async () => {
    if (otp.length !== 6) return;
    setError(null);
    setVerifying(true);
    try {
      await verifySignup(email, otp);
      toast.success('Your workspace is ready');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed — please try again');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    try {
      await resendSignupOtp(email);
      toast.success('Code resent');
      setCooldown(45);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not resend the code');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <Mail className="size-4 shrink-0" />
        We sent a 6-digit code to <span className="font-semibold">{email}</span>.
      </div>
      <Field label="Verification code" htmlFor="otp" error={error ?? undefined} required>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          className="text-center text-lg tracking-[0.5em]"
          value={otp}
          onChange={(e) => {
            setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
        />
      </Field>
      <Button type="button" className="w-full" disabled={otp.length !== 6 || verifying} onClick={submit}>
        {verifying && <Spinner />}
        Verify &amp; create workspace
      </Button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={onBack} className="font-medium text-primary hover:underline">
          ← Change details
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}

export function SignupPage() {
  const { startSignup } = useAuth();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { organizationName: '', name: '', email: '', password: '' },
  });

  const onSubmit = async (values: DetailsValues) => {
    try {
      await startSignup(values);
      toast.success('Code sent to your email');
      setPendingEmail(values.email);
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  return (
    <AuthLayout
      title={pendingEmail ? 'Verify your email' : 'Create your agency workspace'}
      subtitle={pendingEmail ? "One more step and you're in" : 'Start managing leads in minutes — no credit card required'}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {pendingEmail ? (
        <VerifyStep email={pendingEmail} onBack={() => setPendingEmail(null)} />
      ) : (
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
          <Field
            label="Work email"
            htmlFor="email"
            error={errors.email?.message}
            hint="We'll send a 6-digit code here to verify it's you"
            required
          >
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
            Send verification code
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You'll be set up as the admin of a brand-new organization.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
