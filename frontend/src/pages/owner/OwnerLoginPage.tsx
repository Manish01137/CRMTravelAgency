import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Sparkles } from 'lucide-react';
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
  const reduce = useReducedMotion();

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

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#07080c] px-4">
      {/* Ambient color washes — indigo/violet/teal orbs, the same "premium marketing" trick as the landing page, just dark. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-10rem] left-[-6rem] h-[28rem] w-[28rem] rounded-full bg-secondary/20 blur-[120px]" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>
      {/* Faint grid texture for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-sm">
        <motion.div {...rise(0)} className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="animate-auth-glow pointer-events-none absolute left-1/2 top-1/2 -z-10 -ml-14 -mt-14 h-28 w-28 rounded-full bg-primary/50 blur-2xl" />
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-indigo-500 to-secondary text-white shadow-[0_8px_30px_rgba(79,70,229,0.45)]">
              <ShieldCheck className="size-7" />
            </div>
          </div>
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            <Sparkles className="size-3 text-amber-300" /> Joinetra Platform
          </span>
          <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-white">Owner Access</h1>
          <p className="mt-1.5 text-sm text-white/50">Platform administration — Joinetra staff only</p>
        </motion.div>

        <motion.div
          {...rise(0.15)}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-8"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <DarkField label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25 focus-visible:border-primary/60 focus-visible:ring-primary/25"
                {...register('email')}
              />
            </DarkField>
            <DarkField label="Password" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25 focus-visible:border-primary/60 focus-visible:ring-primary/25"
                {...register('password')}
              />
            </DarkField>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)] transition-transform hover:brightness-110 active:scale-[0.99]"
              disabled={isSubmitting}
            >
              {isSubmitting && <Spinner />}
              Sign in
            </Button>
          </form>
        </motion.div>

        <motion.p {...rise(0.28)} className="mt-6 text-center text-xs text-white/30">
          Restricted access — every action here is attributed and logged.
        </motion.p>
      </div>
    </div>
  );
}
