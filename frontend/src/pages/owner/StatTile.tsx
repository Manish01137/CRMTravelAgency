import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT_CLASSES, type OwnerAccent } from './theme';

/** Colorful glass stat card — shared across the dashboard and org detail page
 *  so every number in the owner panel reads as one consistent system. */
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent: OwnerAccent;
}) {
  const a = ACCENT_CLASSES[accent];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20">
      <div className={cn('pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40', a.bg)} />
      <div className="relative flex items-center gap-3">
        <span className={cn('flex size-9 items-center justify-center rounded-xl', a.bg, a.text)}>
          <Icon className="size-4" />
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</p>
      </div>
      <p className="relative mt-3 font-display text-[1.75rem] font-bold text-white">{value}</p>
      {sub && <p className="relative mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  );
}
