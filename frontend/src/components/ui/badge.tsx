import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
        success: 'bg-teal-50 text-teal-700 ring-teal-100',
        warning: 'bg-amber-50 text-amber-700 ring-amber-100',
        info: 'bg-sky-50 text-sky-700 ring-sky-100',
        destructive: 'bg-red-50 text-red-600 ring-red-100',
        muted: 'bg-slate-100 text-slate-600 ring-slate-200',
        outline: 'bg-transparent text-foreground ring-border',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
