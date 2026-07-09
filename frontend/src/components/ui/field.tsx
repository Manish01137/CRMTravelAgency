import * as React from 'react';
import { Label } from './label';
import { cn } from '@/lib/utils';

interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string | string[];
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + error/hint text, laid out consistently for single-column forms. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  const errorText = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {errorText ? (
        <p className="text-xs font-medium text-destructive">{errorText}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
