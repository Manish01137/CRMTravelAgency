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

const emailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});
type EmailValues = z.infer<typeof emailSchema>;

const resetSchema = z
  .object({
    otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(100),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type ResetValues = z.infer<typeof resetSchema>;

/** Step 2 — enter the 6-digit code + new password. */
function ResetStep({ email, onBack }: { email: string; onBack: () => void }) {
  const { resetPassword, resendPasswordResetOtp } = useAuth();
  const navigate = useNavigate();
  const [cooldown, setCooldown] = useState(45);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const onSubmit = async (values: ResetValues) => {
    try {
      await resetPassword({ email, ...values });
      toast.success('Password updated — you\'re signed in');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      handleApiError(err, setError);
    }
  };

  const resend = async () => {
    try {
      await resendPasswordResetOtp(email);
      toast.success('Code resent');
      setCooldown(45);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not resend the code');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <Mail className="size-4 shrink-0" />
        If an account exists for <span className="font-semibold">{email}</span>, we've emailed a 6-digit code.
      </div>
      <Field label="Verification code" htmlFor="otp" error={errors.otp?.message} required>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          className="text-center text-lg tracking-[0.5em]"
          aria-invalid={!!errors.otp}
          {...register('otp')}
        />
      </Field>
      <Field label="New password" htmlFor="newPassword" error={errors.newPassword?.message} hint="At least 8 characters" required>
        <Input
          id="newPassword"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          {...register('newPassword')}
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register('confirmPassword')}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        Reset password
      </Button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={onBack} className="font-medium text-primary hover:underline">
          ← Change email
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
    </form>
  );
}

export function ForgotPasswordPage() {
  const { startPasswordReset } = useAuth();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  const onSubmit = async (values: EmailValues) => {
    try {
      await startPasswordReset(values.email);
      setPendingEmail(values.email);
    } catch {
      // Deliberately generic — startPasswordReset never reveals whether the email exists.
      toast.error('Something went wrong. Please try again.');
    }
  };

  return (
    <AuthLayout
      title={pendingEmail ? 'Reset your password' : 'Forgot your password?'}
      subtitle={pendingEmail ? "Enter the code and choose a new password" : "Enter your email and we'll send you a reset code"}
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {pendingEmail ? (
        <ResetStep email={pendingEmail} onBack={() => setPendingEmail(null)} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Field
            label="Email"
            htmlFor="email"
            error={errors.email?.message}
            hint="We'll send a 6-digit code here if an account exists"
            required
          >
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@agency.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            Send reset code
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
