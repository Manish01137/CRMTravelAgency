import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Plain-text trust statement — not a badge/seal, and never Meta's own mark.
 * Edit the wording here; every placement (login, homepage footer) picks it up.
 */
export const META_TECH_PROVIDER_STATEMENT =
  'Joinetra is a verified Meta Tech Provider — approved to securely connect WhatsApp and Instagram Business accounts on behalf of travel agencies.';

/**
 * Small, understated line pairing our own ShieldCheck icon with the
 * statement above — styled in our own brand color/typography, deliberately
 * NOT shaped like a badge or seal so it reads as a factual note, not a mark
 * issued by Meta.
 */
export function TrustIndicator({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <p className={cn('flex items-start gap-1.5 text-xs leading-snug', className)}>
      <ShieldCheck className={cn('mt-0.5 size-3.5 shrink-0', iconClassName)} aria-hidden />
      <span>{META_TECH_PROVIDER_STATEMENT}</span>
    </p>
  );
}
