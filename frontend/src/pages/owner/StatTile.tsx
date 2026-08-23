import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { CountUp } from '@/components/ui/count-up';
import { ACCENT_CLASSES, type OwnerAccent } from './theme';

/** Same shape as the tenant Dashboard's StatCard — gradient icon tile, bold
 *  count-up number — so the owner panel reads as the exact same design system. */
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  accent: OwnerAccent;
}) {
  const a = ACCENT_CLASSES[accent];
  return (
    <Card className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white [&_svg]:size-4', a.tile)}>
          <Icon />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
        {typeof value === 'number' ? <CountUp to={value} duration={900} /> : value}
      </p>
      {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
