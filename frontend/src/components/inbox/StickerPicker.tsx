import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImagePlus, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

/**
 * WhatsApp stickers: the ones customers (or your team) have sent before, and
 * "make a sticker" from any picture — the server turns it into a 512×512
 * WebP under 100 KB, WhatsApp's sticker format.
 */
export function StickerPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickers = useQuery({ queryKey: ['stickers'], queryFn: () => api.get<string[]>('/inbox/stickers'), staleTime: 60_000 });
  const make = useMutation({
    mutationFn: (file: File) => api.upload('/uploads/sticker', file),
    onSuccess: ({ url }) => {
      queryClient.setQueryData<string[]>(['stickers'], (old) => [url, ...(old ?? [])]);
      onPick(url);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not make that sticker'),
  });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Stickers" className="w-[min(340px,calc(100vw-24px))] rounded-xl border border-border bg-card p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Stickers</p>
        <button type="button" onClick={onClose} aria-label="Close stickers" className="rounded-full p-1 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) make.mutate(f);
        }}
      />
      <button
        type="button"
        disabled={make.isPending}
        onClick={() => fileRef.current?.click()}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#00a884]/60 py-2.5 text-sm font-medium text-[#008069] transition-colors hover:bg-[#00a884]/5 disabled:opacity-60"
      >
        {make.isPending ? <Spinner className="size-4" /> : <ImagePlus className="size-4" />}
        {make.isPending ? 'Making your sticker…' : 'Make a sticker from a picture'}
      </button>
      {stickers.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (stickers.data ?? []).length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Stickers your customers send show up here, ready to send back.</p>
      ) : (
        <div className="grid max-h-60 grid-cols-4 gap-1.5 overflow-y-auto">
          {stickers.data!.map((url) => (
            <button key={url} type="button" onClick={() => onPick(url)} title="Send this sticker" className="aspect-square rounded-lg p-1 transition-colors hover:bg-muted">
              <img src={url} alt="Sticker" loading="lazy" className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
