import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Image as ImageIcon, Link2, Upload, Video, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BotFlowStepMedia } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

type MediaType = BotFlowStepMedia['type'];

// WhatsApp's own limits for media sent by link.
const KINDS: Record<MediaType, { label: string; icon: typeof ImageIcon; accept: string; endpoint: string; maxMb: number; hint: string }> = {
  image: { label: 'Photo', icon: ImageIcon, accept: 'image/jpeg,image/png', endpoint: '/uploads', maxMb: 5, hint: 'JPG or PNG, up to 5 MB.' },
  video: { label: 'Video', icon: Video, accept: 'video/mp4', endpoint: '/uploads/video', maxMb: 16, hint: 'MP4 only, up to 16 MB (WhatsApp’s limit).' },
  document: { label: 'PDF', icon: FileText, accept: 'application/pdf', endpoint: '/uploads/document', maxMb: 16, hint: 'PDF up to 16 MB — e.g. a brochure or itinerary.' },
};

/** Optional photo / video / PDF for a Message or Confirm step. */
export function StepMediaPicker({ value, onChange }: { value: BotFlowStepMedia | null; onChange: (m: BotFlowStepMedia | null) => void }) {
  const [kind, setKind] = useState<MediaType>(value?.type ?? 'image');
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const k = KINDS[kind];

  const upload = useMutation({
    mutationFn: (file: File) => api.upload(k.endpoint, file),
    onSuccess: (res, file) => onChange({ type: kind, url: res.url, ...(kind === 'document' ? { filename: file.name } : {}) }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Upload failed'),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!k.accept.split(',').includes(file.type)) return toast.error(`${k.label}: ${k.hint}`);
    if (file.size > k.maxMb * 1024 * 1024) return toast.error(`That file is over ${k.maxMb} MB. ${k.hint}`);
    upload.mutate(file);
  };

  if (value) {
    const V = KINDS[value.type];
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border p-2">
        {value.type === 'image' ? (
          <img src={value.url} alt="" className="size-14 rounded-md object-cover" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <V.icon className="size-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{V.label} attached</p>
          <p className="truncate text-xs text-muted-foreground">{value.filename || value.url}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label="Remove media">
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Media type">
        {(Object.keys(KINDS) as MediaType[]).map((t) => {
          const K = KINDS[t];
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={kind === t}
              onClick={() => setKind(t)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                kind === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <K.icon className="size-3.5" /> {K.label}
            </button>
          );
        })}
      </div>
      {linkMode ? (
        <div className="flex gap-2">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            aria-label={`${k.label} link`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!/^https?:\/\/\S+$/.test(link.trim())}
            onClick={() => {
              onChange({ type: kind, url: link.trim() });
              setLink('');
              setLinkMode(false);
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept={k.accept} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            {upload.isPending ? <Spinner className="size-4" /> : <Upload className="size-4" />} Upload {k.label.toLowerCase()}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLinkMode(true)}>
            <Link2 className="size-4" /> Use a link
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{k.hint}</p>
    </div>
  );
}
