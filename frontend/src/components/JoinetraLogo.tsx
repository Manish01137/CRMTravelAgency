import { cn } from '@/lib/utils';

/** Joinetra's own logo (the purple "J" mark) — public/logo.png, made from frontend/brand/joinetra-logo.png. */
export function JoinetraLogo({ className }: { className?: string }) {
  return <img src="/logo.png" alt="Joinetra" width={512} height={512} draggable={false} className={cn('size-9 shrink-0 select-none object-contain', className)} />;
}

/** The logo on a white rounded tile (for coloured or busy backgrounds). */
export function JoinetraLogoTile({ className, imgClassName }: { className?: string; imgClassName?: string }) {
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5', className)}>
      <JoinetraLogo className={cn('size-[72%]', imgClassName)} />
    </span>
  );
}
