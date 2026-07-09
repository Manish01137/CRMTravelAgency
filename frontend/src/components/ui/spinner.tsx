import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />;
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}
