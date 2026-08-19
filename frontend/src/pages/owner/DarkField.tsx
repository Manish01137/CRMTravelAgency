import type { ReactNode } from 'react';

/** Local dark-themed field — the shared Field/Label pair assumes the app's
 * light theme (dark text), which reads as invisible on the owner panel's dark UI. */
export function DarkField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-white/70">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-white/40">{hint}</p>
      ) : null}
    </div>
  );
}
