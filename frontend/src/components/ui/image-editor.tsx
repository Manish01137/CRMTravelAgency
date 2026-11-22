import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { FlipHorizontal2, Minus, Plus, RotateCcw, RotateCw, SlidersHorizontal, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Photo editor shown before an upload: choose the frame (crop to a shape),
 * zoom in / out, drag to position, rotate, flip, and adjust brightness /
 * contrast / colour. Everything happens in the browser; the result is a new
 * image file that is then uploaded like any other.
 */

export interface AspectOption {
  label: string;
  /** width / height; null = the photo's own shape. */
  value: number | null;
}

export const ASPECTS: AspectOption[] = [
  { label: 'Original', value: null },
  { label: 'Wide 16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: 'Square', value: 1 },
  { label: 'Portrait 4:5', value: 4 / 5 },
  { label: 'Story 9:16', value: 9 / 16 },
];

const MAX_ZOOM = 4;
const MAX_OUTPUT_SIDE = 2400;
const MAX_BYTES = 5 * 1024 * 1024;

interface Adjust {
  brightness: number; // 100 = unchanged
  contrast: number;
  saturation: number;
}
const NO_ADJUST: Adjust = { brightness: 100, contrast: 100, saturation: 100 };

export function ImageEditorDialog({
  source,
  fileName,
  keepPng,
  defaultAspect = null,
  onCancel,
  onUseOriginal,
  onApply,
  busy,
  isNew = true,
}: {
  /** Object URL or http(s) URL of the photo to edit; null closes the editor. */
  source: string | null;
  fileName: string;
  /** PNG in → PNG out (keeps a logo's transparent background). */
  keepPng: boolean;
  defaultAspect?: number | null;
  onCancel: () => void;
  /** Upload the photo as it is (hidden when editing an already-uploaded photo). */
  onUseOriginal?: () => void;
  onApply: (file: File) => void;
  busy?: boolean;
  /** A photo just picked (not one already uploaded) — the save button says "upload". */
  isNew?: boolean;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [aspect, setAspect] = useState<number | null>(defaultAspect);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // 0 / 90 / 180 / 270
  const [flip, setFlip] = useState(false);
  const [adjust, setAdjust] = useState<Adjust>(NO_ADJUST);
  const [showAdjust, setShowAdjust] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [box, setBox] = useState({ w: 560, h: 380 });
  const areaRef = useRef<HTMLDivElement>(null);

  // Load the photo (crossOrigin so an already-uploaded one can be drawn on a canvas).
  useEffect(() => {
    if (!source) return;
    setImg(null);
    setLoadError(false);
    setAspect(defaultAspect);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
    setFlip(false);
    setAdjust(NO_ADJUST);
    const el = new Image();
    if (/^https?:/.test(source)) el.crossOrigin = 'anonymous';
    el.onload = () => setImg(el);
    el.onerror = () => setLoadError(true);
    el.src = source;
  }, [source, defaultAspect]);

  // The editing area follows the dialog's size (phones get a smaller stage).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: Math.max(200, el.clientWidth - 24), h: Math.min(420, Math.max(240, window.innerHeight * 0.45)) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  const nat = img ? { w: img.naturalWidth, h: img.naturalHeight } : { w: 1, h: 1 };
  const turned = rotation % 180 !== 0;
  const rw = turned ? nat.h : nat.w;
  const rh = turned ? nat.w : nat.h;
  const ratio = aspect ?? rw / rh;
  // The crop frame: the chosen shape, as big as fits the area.
  const stage = useMemo(() => {
    let w = box.w;
    let h = w / ratio;
    if (h > box.h) {
      h = box.h;
      w = h * ratio;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [box, ratio]);
  const cover = Math.max(stage.w / rw, stage.h / rh);
  const scale = cover * zoom;

  const clamp = useCallback(
    (o: { x: number; y: number }, s = scale) => {
      const mx = Math.max(0, (rw * s - stage.w) / 2);
      const my = Math.max(0, (rh * s - stage.h) / 2);
      return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
    },
    [rw, rh, scale, stage],
  );
  // Keep the photo covering the frame after any shape / zoom / rotation change.
  useEffect(() => setOffset((o) => clamp(o)), [clamp]);

  const setZoomTo = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setOffset((o) => clamp({ x: (o.x * next) / zoom, y: (o.y * next) / zoom }, cover * next));
    setZoom(next);
  };

  // Drag to move; two fingers to pinch-zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomTo((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist);
      return;
    }
    setOffset((o) => clamp({ x: o.x + e.clientX - prev.x, y: o.y + e.clientY - prev.y }));
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Mouse wheel / trackpad zoom (non-passive so the page doesn't scroll instead).
  const stageRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomTo(zoomRef.current * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const cssFilter = `brightness(${adjust.brightness}%) contrast(${adjust.contrast}%) saturate(${adjust.saturation}%)`;
  const edited =
    aspect !== null || zoom !== 1 || rotation !== 0 || flip || adjust.brightness !== 100 || adjust.contrast !== 100 || adjust.saturation !== 100;

  const exportImage = async () => {
    if (!img) return;
    setExporting(true);
    try {
      // The crop at the photo's own resolution, capped so files stay small.
      let outW = stage.w / scale;
      let outH = outW / ratio; // exact shape (the on-screen frame is rounded to whole pixels)
      const cap = MAX_OUTPUT_SIDE / Math.max(outW, outH);
      if (cap < 1) {
        outW *= cap;
        outH *= cap;
      }
      const type = keepPng ? 'image/png' : 'image/jpeg';
      let blob: Blob | null = null;
      for (let shrinkBy = 1; shrinkBy > 0.3; shrinkBy *= 0.8) {
        const W = Math.max(1, Math.round(outW * shrinkBy));
        const H = Math.max(1, Math.round(W / ratio));
        const canvas = render(img, W, H, W / stage.w);
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.9));
        if (blob && blob.size <= MAX_BYTES) break;
      }
      if (!blob) throw new Error('export failed');
      const base = fileName.replace(/\.[a-z0-9]+$/i, '') || 'photo';
      onApply(new File([blob], `${base}-edited.${keepPng ? 'png' : 'jpg'}`, { type }));
    } catch {
      setLoadError(true);
    } finally {
      setExporting(false);
    }
  };

  const render = (image: HTMLImageElement, W: number, H: number, k: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    if (!keepPng) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(W / 2 + offset.x * k, H / 2 + offset.y * k);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flip ? -1 : 1, 1);
    const dw = nat.w * scale * k;
    const dh = nat.h * scale * k;
    ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (adjust.brightness !== 100 || adjust.contrast !== 100 || adjust.saturation !== 100) applyAdjust(ctx, W, H, adjust);
    return canvas;
  };

  const slider = (label: string, key: keyof Adjust) => (
    <label className="block">
      <span className="flex justify-between text-xs text-muted-foreground">
        {label} <span className="tabular-nums">{adjust[key] - 100 > 0 ? '+' : ''}{adjust[key] - 100}</span>
      </span>
      <input
        type="range"
        min={50}
        max={150}
        value={adjust[key]}
        onChange={(e) => setAdjust((a) => ({ ...a, [key]: Number(e.target.value) }))}
        className="w-full accent-primary"
      />
    </label>
  );

  const working = busy || exporting;

  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && !working && onCancel()}>
      <DialogContent className="max-h-[96dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit photo</DialogTitle>
          <DialogDescription>Choose a frame, drag the photo to position it, and zoom in or out to get the best shot.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Frame shape">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              role="radio"
              aria-checked={aspect === a.value}
              onClick={() => setAspect(a.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                aspect === a.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div ref={areaRef} className="flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#1f2329]" style={{ minHeight: box.h + 24, padding: 12 }}>
          {loadError ? (
            <p className="max-w-xs p-6 text-center text-sm text-white/80">
              This photo can’t be edited here (it may be stored on another website). Upload it again from your computer to edit it.
            </p>
          ) : !img ? (
            <Spinner className="text-white" />
          ) : (
            <div
              ref={stageRef}
              className="relative cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
              style={{ width: stage.w, height: stage.h, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: nat.w * scale,
                  height: nat.h * scale,
                  filter: cssFilter,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scaleX(${flip ? -1 : 1})`,
                }}
              />
              {/* rule-of-thirds guide */}
              <div className="pointer-events-none absolute inset-0 border-2 border-white/90">
                <div className="absolute inset-y-0 left-1/3 border-l border-white/40" />
                <div className="absolute inset-y-0 left-2/3 border-l border-white/40" />
                <div className="absolute inset-x-0 top-1/3 border-t border-white/40" />
                <div className="absolute inset-x-0 top-2/3 border-t border-white/40" />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <button type="button" className="rounded-md p-1.5 hover:bg-muted" onClick={() => setZoomTo(zoom / 1.2)} aria-label="Zoom out" title="Zoom out">
              <Minus className="size-4" />
            </button>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoomTo(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Zoom"
            />
            <button type="button" className="rounded-md p-1.5 hover:bg-muted" onClick={() => setZoomTo(zoom * 1.2)} aria-label="Zoom in" title="Zoom in">
              <Plus className="size-4" />
            </button>
            <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="rounded-md p-2 hover:bg-muted" onClick={() => setRotation((r) => (r + 270) % 360)} aria-label="Rotate left" title="Rotate left">
              <RotateCcw className="size-4" />
            </button>
            <button type="button" className="rounded-md p-2 hover:bg-muted" onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Rotate right" title="Rotate right">
              <RotateCw className="size-4" />
            </button>
            <button
              type="button"
              className={cn('rounded-md p-2 hover:bg-muted', flip && 'bg-muted text-primary')}
              onClick={() => setFlip((f) => !f)}
              aria-label="Flip"
              aria-pressed={flip}
              title="Flip"
            >
              <FlipHorizontal2 className="size-4" />
            </button>
            <button
              type="button"
              className={cn('rounded-md p-2 hover:bg-muted', showAdjust && 'bg-muted text-primary')}
              onClick={() => setShowAdjust((s) => !s)}
              aria-label="Adjust colours"
              aria-expanded={showAdjust}
              title="Brightness, contrast, colour"
            >
              <SlidersHorizontal className="size-4" />
            </button>
            <button
              type="button"
              className="rounded-md p-2 hover:bg-muted disabled:opacity-40"
              disabled={!edited}
              onClick={() => {
                setAspect(defaultAspect);
                setZoom(1);
                setOffset({ x: 0, y: 0 });
                setRotation(0);
                setFlip(false);
                setAdjust(NO_ADJUST);
              }}
              aria-label="Reset"
              title="Reset"
            >
              <Undo2 className="size-4" />
            </button>
          </div>
        </div>

        {showAdjust && (
          <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-3">
            {slider('Brightness', 'brightness')}
            {slider('Contrast', 'contrast')}
            {slider('Colour', 'saturation')}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={working}>
            Cancel
          </Button>
          {onUseOriginal && (
            <Button type="button" variant="outline" onClick={onUseOriginal} disabled={working}>
              Use without editing
            </Button>
          )}
          <Button type="button" onClick={() => void exportImage()} disabled={working || !img || loadError}>
            {working && <Spinner className="size-4" />}
            {isNew ? 'Save & upload' : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Brightness / contrast / saturation on the pixels — the same maths as the CSS filters used for the preview. */
function applyAdjust(ctx: CanvasRenderingContext2D, W: number, H: number, a: Adjust) {
  const data = ctx.getImageData(0, 0, W, H);
  const p = data.data;
  const b = a.brightness / 100;
  const c = a.contrast / 100;
  const s = a.saturation / 100;
  // CSS saturate() matrix
  const m = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  for (let i = 0; i < p.length; i += 4) {
    let r = p[i] * b;
    let g = p[i + 1] * b;
    let bl = p[i + 2] * b;
    r = (r - 127.5) * c + 127.5;
    g = (g - 127.5) * c + 127.5;
    bl = (bl - 127.5) * c + 127.5;
    p[i] = m[0] * r + m[1] * g + m[2] * bl;
    p[i + 1] = m[3] * r + m[4] * g + m[5] * bl;
    p[i + 2] = m[6] * r + m[7] * g + m[8] * bl;
  }
  ctx.putImageData(data, 0, 0);
}
