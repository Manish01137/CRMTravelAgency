import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

const MAX_MS = 10 * 60 * 1000; // 10 minutes
const MIN_MS = 800;

/** The best format this browser can record (the server converts it for WhatsApp). */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
}

export const canRecordVoice = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * WhatsApp-style recording bar: starts recording as soon as it shows, with a
 * live level meter and timer; 🗑 throws it away, ➤ sends it.
 */
export function VoiceRecorderBar({
  onCancel,
  onSend,
  sending,
  wa,
}: {
  onCancel: () => void;
  onSend: (file: File) => void;
  /** Uploading / converting after ➤ was pressed. */
  sending: boolean;
  wa: boolean;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const sendOnStop = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0.08));

  const stopAll = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let audioCtx: AudioContext | null = null;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const mimeType = pickMime();
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = rec;
        chunksRef.current = [];
        rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        rec.onstop = () => {
          stopAll();
          if (!sendOnStop.current) return;
          const type = (rec.mimeType || mimeType || 'audio/webm').split(';')[0];
          const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
          onSend(new File(chunksRef.current, `voice.${ext}`, { type }));
        };
        rec.start(250);
        startedAt.current = Date.now();
        setReady(true);
        // Live level meter.
        audioCtx = new AudioContext();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let last = 0;
        const tick = (now: number) => {
          raf = requestAnimationFrame(tick);
          const ms = Date.now() - startedAt.current;
          setElapsed(ms);
          if (ms >= MAX_MS) return finish();
          if (now - last < 90) return;
          last = now;
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
          setLevels((l) => [...l.slice(1), Math.min(1, 0.08 + peak * 1.8)]);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        toast.error(
          name === 'NotAllowedError'
            ? 'Microphone blocked — allow microphone access for this site in your browser, then try again'
            : name === 'NotFoundError'
              ? 'No microphone found on this device'
              : 'Could not start recording',
        );
        onCancel();
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      void audioCtx?.close();
      if (recorderRef.current?.state === 'recording') {
        sendOnStop.current = false;
        recorderRef.current.stop();
      }
      stopAll();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    if (Date.now() - startedAt.current < MIN_MS) {
      toast.info('Hold on — record a little longer');
      return;
    }
    sendOnStop.current = true;
    rec.stop();
  }

  const recording = ready && !sending && recorderRef.current?.state === 'recording';
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2" role="group" aria-label="Recording a voice note">
      <button
        type="button"
        onClick={onCancel}
        disabled={sending}
        aria-label="Delete recording"
        title="Delete"
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/[0.06] hover:text-[#ea0038] disabled:opacity-40"
      >
        <Trash2 className="size-5" />
      </button>
      <div className={cn('flex h-[42px] min-w-0 flex-1 items-center gap-3 rounded-lg px-3', wa ? 'bg-white' : 'rounded-full bg-[#efefef]')}>
        <span className={cn('size-2.5 shrink-0 rounded-full bg-[#ea0038]', recording && 'animate-pulse')} />
        <span className="w-10 shrink-0 text-[14px] tabular-nums text-[#111b21]">{fmt(elapsed)}</span>
        <div className="flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
          {levels.map((l, i) => (
            <span key={i} style={{ height: `${Math.round(l * 100)}%` }} className={cn('w-[3px] shrink-0 rounded-full', wa ? 'bg-[#00a884]' : 'bg-[#3797f0]')} />
          ))}
        </div>
        {sending && <span className="shrink-0 text-xs text-[#667781]">Sending…</span>}
      </div>
      <button
        type="button"
        onClick={finish}
        disabled={!ready || sending}
        aria-label="Send voice note"
        title="Send voice note"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-all active:scale-95 disabled:opacity-50',
          wa ? 'bg-[#00a884] hover:bg-[#008f72]' : 'bg-[#3797f0] hover:bg-[#1877f2]',
        )}
      >
        {sending ? <Spinner className="size-4" /> : <Send className="size-[18px] translate-x-px" />}
      </button>
    </div>
  );
}
