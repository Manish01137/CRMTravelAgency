import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm',
        'transition-[color,border-color,box-shadow] duration-150 ease-out',
        'placeholder:text-muted-foreground',
        // Focus: border turns indigo + a soft translucent glow (no offset halo).
        'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-destructive/15 aria-[invalid=true]:ring-offset-0',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
