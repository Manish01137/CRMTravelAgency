import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Mic, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Voice notes / audio customers send (WhatsApp sends voice notes as .ogg). */
export const isAudioUrl = (url: string) => /\.(ogg|opus|mp3|m4a|aac|amr|wav)(?:[?#]|$)/i.test(url);
/** A sticker keeps the "[Sticker]" label as its body. */
export const isStickerMessage = (m: { body: string | null; mediaUrl: string | null }) => !!m.mediaUrl && m.body?.trim() === '[Sticker]';
/** "[Video]", "[Voice message]"… — the player / sticker itself says that, so the label isn't shown. */
export const isMediaLabel = (body: string | null | undefined) => !!body && /^\[(Video|Voice message|Audio file|Sticker)\]$/.test(body.trim());

const fmt = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

/** WhatsApp-style voice note: play, a waveform you can tap to seek, time, and 1× / 1.5× / 2×. */
export function VoiceNote({ src, tone, voice = true }: { src: string; tone: 'wa-out' | 'wa-in' | 'ig-out' | 'ig-in'; voice?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  // A fixed "waveform" per file (the real one would need decoding the audio).
  const bars = useMemo(() => {
    let h = 0;
    for (const ch of src) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 30 }, (_, i) => {
      h = (h * 1103515245 + 12345) >>> 0;
      return 0.25 + ((h >>> 16) % 1000) / 1000 * 0.75 * (i % 7 === 0 ? 0.6 : 1);
    });
  }, [src]);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);

  const onDark = tone === 'ig-out';
  const accent = tone === 'wa-out' ? 'bg-[#00a884]' : tone === 'wa-in' ? 'bg-[#53bdeb]' : onDark ? 'bg-white' : 'bg-[#3797f0]';
  const progress = duration ? time / duration : 0;

  if (failed) {
    return (
      <a href={src} target="_blank" rel="noreferrer" className={cn('mb-1 flex min-w-[220px] items-center gap-2 rounded-md p-2 text-[13px]', onDark ? 'bg-white/15 text-white' : 'bg-black/[0.05] text-[#111b21]')}>
        <Download className="size-4 shrink-0" /> {voice ? 'Voice message' : 'Audio'} — can’t play in this browser, tap to download
      </a>
    );
  }
  return (
    <div className="mb-1 flex w-[260px] max-w-full items-center gap-2.5 pt-0.5">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onError={() => setFailed(true)}
      />
      <span className={cn('relative flex size-11 shrink-0 items-center justify-center rounded-full', onDark ? 'bg-white/20 text-white' : 'bg-[#dfe5e7] text-[#54656f]')}>
        <Mic className="size-5" />
        {voice && <span className={cn('absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white', accent)} />}
      </span>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => (playing ? ref.current?.pause() : void ref.current?.play().catch(() => setFailed(true)))}
        className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', onDark ? 'text-white' : 'text-[#54656f]')}
      >
        {playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(time)}
          tabIndex={0}
          onClick={(e) => {
            const a = ref.current;
            if (!a || !duration) return;
            const r = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - r.left) / r.width) * duration;
          }}
          className="flex h-7 cursor-pointer items-center gap-[2px]"
        >
          {bars.map((b, i) => (
            <span
              key={i}
              style={{ height: `${Math.round(b * 100)}%` }}
              className={cn('w-[3px] flex-1 rounded-full', i / bars.length < progress ? accent : onDark ? 'bg-white/45' : 'bg-[#8696a0]/50')}
            />
          ))}
        </div>
        <div className={cn('mt-0.5 flex items-center justify-between text-[11px]', onDark ? 'text-white/80' : 'text-[#667781]')}>
          <span>{fmt(playing || time ? time : duration)}</span>
          {playing && (
            <button
              type="button"
              onClick={() => setRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))}
              className={cn('rounded-full px-1.5 font-semibold', onDark ? 'bg-white/20' : 'bg-black/10')}
            >
              {rate}×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
