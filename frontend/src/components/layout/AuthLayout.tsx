import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plane } from 'lucide-react';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  trust,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Small, muted credibility line rendered under the card (e.g. on login). */
  trust?: ReactNode;
}) {
  const reduce = useReducedMotion();

  // Fade + slight rise, staggered by `delay`. Collapses to a plain fade when the
  // visitor prefers reduced motion.
  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay } }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-surface">
      {/* Soft ambient wash across the top of the page */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_38rem_at_50%_-12%,hsl(var(--primary)/0.09),transparent)]" />

      <div className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            {/* Icon mark with a slow, alive glow behind it */}
            <div className="relative mb-4">
              <div className="animate-auth-glow pointer-events-none absolute left-1/2 top-1/2 -z-10 -ml-12 -mt-12 h-24 w-24 rounded-full bg-primary/40 blur-2xl" />
              <motion.div
                initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={
                  reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 260, damping: 15 }
                }
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop"
              >
                <Plane className="size-6" />
              </motion.div>
            </div>

            <motion.h1
              {...rise(0.12)}
              className="font-display text-[1.75rem] font-bold tracking-tight text-foreground"
            >
              {title}
            </motion.h1>
            {subtitle && (
              <motion.p {...rise(0.2)} className="mt-1.5 text-sm text-muted-foreground">
                {subtitle}
              </motion.p>
            )}
          </div>

          <motion.div
            {...rise(0.32)}
            className="rounded-lg border border-border bg-card p-6 shadow-soft sm:p-8"
          >
            {children}
          </motion.div>

          {trust && (
            <motion.div {...rise(0.42)} className="mt-5 text-center">
              {trust}
            </motion.div>
          )}
          {footer && (
            <motion.div
              {...rise(trust ? 0.48 : 0.42)}
              className="mt-6 text-center text-sm text-muted-foreground"
            >
              {footer}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
