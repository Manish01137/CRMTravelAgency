import { useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Link2, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  /** compact = tiny square + remove (inline rows); tile = square grid cell; default = wide dropzone. */
  compact?: boolean;
  tile?: boolean;
  className?: string;
}

const MAX_MB = 5;

export function ImageUpload({ value, onChange, compact, tile, className }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const hasImage = !!value && /^https?:\/\//.test(value);

  const doUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image is too large (max ${MAX_MB} MB)`);
      return;
    }
    setUploading(true);
    try {
      const { url } = await api.upload('/uploads', file);
      onChange(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void doUpload(file);
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void doUpload(file);
        e.target.value = '';
      }}
    />
  );

  if (tile) {
    return (
      <>
        {hiddenInput}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={cn(
            'flex h-28 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-input bg-surface hover:border-primary/60',
            className,
          )}
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-primary" />
          ) : hasImage ? (
            <img src={value!} alt="" className="size-full object-cover" onError={() => onChange(null)} />
          ) : (
            <>
              <ImagePlus className="size-5 text-muted-foreground/60" />
              <span className="text-[11px] font-medium text-muted-foreground">Upload</span>
            </>
          )}
        </button>
      </>
    );
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {hiddenInput}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-surface transition-colors hover:border-primary"
          aria-label="Upload image"
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : hasImage ? (
            <img src={value!} alt="" className="size-full object-cover" onError={() => onChange(null)} />
          ) : (
            <ImagePlus className="size-4 text-muted-foreground/60" />
          )}
        </button>
        {hasImage && (
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive" aria-label="Remove image">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {hiddenInput}
      {hasImage ? (
        <div className="group relative overflow-hidden rounded-xl border border-border">
          <img src={value!} alt="" className="h-40 w-full object-cover" onError={() => onChange(null)} />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-foreground"
            >
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-destructive"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={cn(
            'flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-input bg-surface hover:border-primary/60',
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Uploading…</span>
            </>
          ) : (
            <>
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="size-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">Upload image</span>
              <span className="text-xs text-muted-foreground">Drag & drop or click · PNG/JPG/WEBP · max {MAX_MB} MB</span>
            </>
          )}
        </button>
      )}

      {/* Paste-a-URL fallback */}
      <div className="mt-2">
        {showUrl ? (
          <input
            type="url"
            defaultValue={value ?? ''}
            placeholder="https://…/image.jpg"
            onBlur={(e) => onChange(e.target.value.trim() || null)}
            className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-xs shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        ) : (
          <button type="button" onClick={() => setShowUrl(true)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary">
            <Link2 className="size-3" /> or paste an image URL
          </button>
        )}
      </div>
    </div>
  );
}
