import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mic, MicOff, MessageCircle, Phone, PhoneIncoming, PhoneOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { answerCall, offerCall, playTone, unlockAudio, MicrophoneError, type CallMedia } from '@/lib/whatsappCall';

/**
 * WhatsApp calls in the CRM: rings every open tab that may take the call,
 * runs the one call this tab is on, and shows the call card (bottom-right).
 * Mounted once around the signed-in app (AppShell).
 */

export interface CallInfo {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'RINGING' | 'ANSWERED' | 'COMPLETED' | 'MISSED' | 'DECLINED' | 'NO_ANSWER' | 'FAILED';
  conversationId: string;
  leadId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  answeredBy: { id: string; name: string } | null;
  startedBy: { id: string; name: string } | null;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  errorMessage: string | null;
}

type Phase = 'connecting' | 'ringing' | 'active' | 'ended';
interface Session {
  call: CallInfo;
  phase: Phase;
  muted: boolean;
  /** When the conversation started (for the timer). */
  since: number | null;
  endedText?: string;
}

interface CallEvent {
  type: 'ring' | 'update' | 'ended';
  call: CallInfo;
  answerSdp?: string;
  ringing?: boolean;
}

interface CallContextValue {
  /** Place a WhatsApp call to this chat's customer. Resolves false if it couldn't start (the reason is already shown). */
  startCall: (conversationId: string, contact: { name: string | null; phone: string | null }) => Promise<boolean | 'permission'>;
  busy: boolean;
}

const CallContext = createContext<CallContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useCalls(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls must be used inside CallProvider');
  return ctx;
}

const label = (c: Pick<CallInfo, 'contactName' | 'contactPhone'>) => c.contactName || (c.contactPhone ? `+${c.contactPhone.replace(/^\+/, '')}` : 'WhatsApp contact');
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function endedText(call: CallInfo): string {
  if (call.status === 'COMPLETED') return `Call ended${call.durationSec ? ` · ${mmss(call.durationSec)}` : ''}`;
  if (call.status === 'DECLINED') return call.direction === 'OUTBOUND' ? 'The customer declined the call' : 'Call declined';
  if (call.status === 'NO_ANSWER') return 'No answer';
  if (call.status === 'MISSED') return 'Missed call';
  if (call.status === 'FAILED') return call.errorMessage || "The call couldn't connect";
  return 'Call ended';
}

export function CallProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ringing, setRinging] = useState<CallInfo[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const media = useRef<CallMedia | null>(null);
  const answerApplied = useRef(false);

  const refreshChat = useCallback(
    (conversationId: string) => {
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    [queryClient],
  );

  const closeMedia = () => {
    media.current?.close();
    media.current = null;
    answerApplied.current = false;
  };

  const showEnded = useCallback(
    (call: CallInfo, text?: string) => {
      closeMedia();
      setSession((s) => (s && s.call.id === call.id ? { ...s, call, phase: 'ended', endedText: text ?? endedText(call) } : s));
      setTimeout(() => setSession((s) => (s && s.call.id === call.id && s.phase === 'ended' ? null : s)), 2500);
      refreshChat(call.conversationId);
    },
    [refreshChat],
  );

  const applyAnswer = useCallback(async (sdp: string) => {
    if (!media.current || answerApplied.current) return;
    answerApplied.current = true;
    await media.current.applyAnswer(sdp).catch(() => {
      answerApplied.current = false;
    });
  }, []);

  // --- live events ---------------------------------------------------------------
  const onEvent = useCallback(
    (ev: CallEvent) => {
      const { call } = ev;
      const mine = sessionRef.current?.call.id === call.id;
      if (ev.type === 'ring') {
        if (!mine) setRinging((list) => (list.some((c) => c.id === call.id) ? list : [...list, call]));
        return;
      }
      if (ev.type === 'ended' || call.status !== 'RINGING' || call.answeredBy) {
        setRinging((list) => list.filter((c) => c.id !== call.id));
      }
      if (!mine) {
        if (ev.type === 'ended') refreshChat(call.conversationId);
        return;
      }
      if (ev.type === 'ended') return showEnded(call);
      if (ev.answerSdp) void applyAnswer(ev.answerSdp);
      setSession((s) => {
        if (!s || s.call.id !== call.id || s.phase === 'ended') return s;
        const nowActive = call.status === 'ANSWERED' && s.phase !== 'active';
        return { ...s, call, phase: nowActive ? 'active' : s.phase, since: nowActive ? Date.now() : s.since };
      });
    },
    [applyAnswer, refreshChat, showEnded],
  );

  useEffect(() => {
    let source: EventSource | null = null;
    let closed = false;
    const loadActive = () =>
      api
        .get<{ calls: CallInfo[] }>('/calls/active')
        .then(({ calls }) => setRinging(calls.filter((c) => c.direction === 'INBOUND' && c.status === 'RINGING' && !c.answeredBy)))
        .catch(() => undefined);
    const open = () => {
      if (closed) return;
      source = new EventSource('/api/calls/stream', { withCredentials: true });
      source.addEventListener('call', (e) => {
        try {
          onEvent(JSON.parse((e as MessageEvent<string>).data) as CallEvent);
        } catch {
          /* malformed event — ignore */
        }
      });
      // Reconnected after a drop: catch up on anything that rang meanwhile.
      source.addEventListener('open', () => void loadActive());
    };
    open();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      closed = true;
      source?.close();
      window.removeEventListener('pointerdown', unlock);
    };
  }, [onEvent]);

  // Outgoing call: if the live event with the customer's answer got lost, fetch it.
  useEffect(() => {
    if (!session || session.call.direction !== 'OUTBOUND' || session.phase === 'ended') return;
    const id = session.call.id;
    const timer = setInterval(() => {
      void api
        .get<CallInfo & { remoteSdp: string | null }>(`/calls/${id}`)
        .then((c) => {
          if (c.endedAt) return showEnded(c);
          if (c.remoteSdp) void applyAnswer(c.remoteSdp);
          if (c.status === 'ANSWERED') onEvent({ type: 'update', call: c });
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [session?.call.id, session?.phase, session?.call.direction, applyAnswer, onEvent, showEnded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ring sound, tab title and a desktop notification while something is ringing.
  const ringingCall = !session || session.phase === 'ended' ? ringing[0] : undefined;
  useEffect(() => {
    if (!ringingCall) return;
    const stop = playTone('ring');
    const title = document.title;
    let flip = false;
    const flash = setInterval(() => {
      flip = !flip;
      document.title = flip ? `📞 ${label(ringingCall)} is calling…` : title;
    }, 1000);
    let note: Notification | null = null;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      note = new Notification('Incoming WhatsApp call', { body: label(ringingCall), tag: `call-${ringingCall.id}`, requireInteraction: true });
      note.onclick = () => {
        window.focus();
        note?.close();
      };
    }
    return () => {
      stop();
      clearInterval(flash);
      document.title = title;
      note?.close();
    };
  }, [ringingCall?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ringback while the customer's phone rings.
  const waiting = session?.call.direction === 'OUTBOUND' && session.phase === 'ringing';
  useEffect(() => {
    if (!waiting) return;
    return playTone('ringback');
  }, [waiting]);

  // Closing / reloading the tab mid-call: hang up properly instead of leaving the customer on a silent line.
  const live = !!session && session.phase !== 'ended';
  useEffect(() => {
    if (!live) return;
    const id = session!.call.id;
    const onHide = () => navigator.sendBeacon(`/api/calls/${id}/hangup`);
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onBefore);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onBefore);
    };
  }, [live, session?.call.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchMedia = (m: CallMedia, callId: string) => {
    m.onFailed(() => {
      void api.post(`/calls/${callId}/fail`, { reason: 'The audio connection dropped' }).catch(() => undefined);
      toast.error('The call audio dropped — check your internet connection.');
    });
  };

  // --- actions ---------------------------------------------------------------------
  const accept = async (call: CallInfo) => {
    if (sessionRef.current && sessionRef.current.phase !== 'ended') {
      toast.error('Finish your current call first');
      return;
    }
    setRinging((list) => list.filter((c) => c.id !== call.id));
    setSession({ call, phase: 'connecting', muted: false, since: null });
    try {
      const details = await api.get<CallInfo & { remoteSdp: string | null }>(`/calls/${call.id}`);
      if (!details.remoteSdp || details.endedAt) throw new ApiError(409, 'ENDED', 'This call has already ended');
      const m = await answerCall(details.remoteSdp);
      media.current = m;
      const answered = await api.post<CallInfo>(`/calls/${call.id}/accept`, { sdp: m.localSdp });
      watchMedia(m, call.id);
      setSession((s) => (s?.call.id === call.id && s.phase !== 'ended' ? { ...s, call: answered, phase: 'active', since: Date.now() } : s));
    } catch (err) {
      closeMedia();
      setSession(null);
      toast.error(err instanceof MicrophoneError || err instanceof ApiError ? err.message : 'Could not answer the call');
    }
  };

  const decline = async (call: CallInfo) => {
    setRinging((list) => list.filter((c) => c.id !== call.id));
    await api.post(`/calls/${call.id}/decline`).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not decline the call'));
    refreshChat(call.conversationId);
  };

  const hangUp = async () => {
    const s = sessionRef.current;
    if (!s) return;
    closeMedia();
    const ending: Session = { ...s, phase: 'ended', endedText: 'Ending…' };
    sessionRef.current = ending;
    setSession(ending);
    if (s.call.id === 'pending') {
      setTimeout(() => setSession((x) => (x?.call.id === 'pending' ? null : x)), 1200);
      return;
    }
    await api.post(`/calls/${s.call.id}/hangup`).catch(() => undefined);
    showEnded(s.call, s.phase === 'active' && s.since ? `Call ended · ${mmss(Math.round((Date.now() - s.since) / 1000))}` : 'Call cancelled');
  };

  const toggleMute = () => {
    setSession((s) => {
      if (!s) return s;
      media.current?.setMuted(!s.muted);
      return { ...s, muted: !s.muted };
    });
  };

  const startCall: CallContextValue['startCall'] = async (conversationId, contact) => {
    if (sessionRef.current && sessionRef.current.phase !== 'ended') {
      toast.error('Finish your current call first');
      return false;
    }
    const placeholder: CallInfo = {
      id: 'pending',
      direction: 'OUTBOUND',
      status: 'RINGING',
      conversationId,
      leadId: null,
      contactName: contact.name,
      contactPhone: contact.phone,
      answeredBy: null,
      startedBy: null,
      createdAt: new Date().toISOString(),
      answeredAt: null,
      endedAt: null,
      durationSec: null,
      errorMessage: null,
    };
    setSession({ call: placeholder, phase: 'connecting', muted: false, since: null });
    let m: CallMedia | null = null;
    try {
      m = await offerCall();
      media.current = m;
      const call = await api.post<CallInfo>(`/calls/conversations/${conversationId}`, { sdp: m.localSdp });
      // Hung up while we were still setting the call up — end the one WhatsApp just started.
      if (sessionRef.current?.call.id !== 'pending' || sessionRef.current.phase === 'ended') {
        m.close();
        if (media.current === m) media.current = null;
        await api.post(`/calls/${call.id}/hangup`).catch(() => undefined);
        refreshChat(conversationId);
        return false;
      }
      watchMedia(m, call.id);
      setSession((s) => (s && s.call.id === 'pending' ? { ...s, call, phase: 'ringing' } : s));
      refreshChat(conversationId);
      return true;
    } catch (err) {
      closeMedia();
      setSession(null);
      if (err instanceof ApiError && err.code === 'CALL_PERMISSION_REQUIRED') return 'permission';
      toast.error(err instanceof MicrophoneError || err instanceof ApiError ? err.message : 'Could not start the call');
      return false;
    }
  };

  const openChat = (conversationId: string) => navigate(`/inbox?chat=${conversationId}`);

  return (
    <CallContext.Provider value={{ startCall, busy: !!session && session.phase !== 'ended' }}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-5 sm:bottom-5">
        {ringingCall && (
          <IncomingCard key={ringingCall.id} call={ringingCall} more={ringing.length - 1} onAccept={() => void accept(ringingCall)} onDecline={() => void decline(ringingCall)} onOpen={() => openChat(ringingCall.conversationId)} />
        )}
        {session && <ActiveCard session={session} onHangUp={() => void hangUp()} onMute={toggleMute} onOpen={() => openChat(session.call.conversationId)} />}
      </div>
    </CallContext.Provider>
  );
}

const cardCls = 'pointer-events-auto w-full rounded-2xl bg-[#111b21] p-4 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:w-80 animate-slide-up';

function Avatar({ call, pulse }: { call: CallInfo; pulse?: boolean }) {
  return (
    <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-[#25d366]/20 text-base font-semibold text-[#25d366]">
      {pulse && <span className="absolute inset-0 animate-ping rounded-full bg-[#25d366]/30" />}
      {initials(label(call))}
    </span>
  );
}

function IncomingCard({ call, more, onAccept, onDecline, onOpen }: { call: CallInfo; more: number; onAccept: () => void; onDecline: () => void; onOpen: () => void }) {
  return (
    <div className={cardCls} role="alertdialog" aria-label={`Incoming WhatsApp call from ${label(call)}`}>
      <div className="flex items-center gap-3">
        <Avatar call={call} pulse />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs text-[#8696a0]">
            <PhoneIncoming className="size-3.5" /> WhatsApp voice call
          </p>
          <p className="truncate text-[15px] font-semibold">{label(call)}</p>
          {call.contactName && call.contactPhone && <p className="truncate text-xs text-[#8696a0]">+{call.contactPhone.replace(/^\+/, '')}</p>}
        </div>
        <button type="button" onClick={onOpen} className="rounded-full p-2 text-[#8696a0] hover:bg-white/10 hover:text-white" title="Open chat" aria-label="Open chat">
          <MessageCircle className="size-5" />
        </button>
      </div>
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={onDecline} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#f15c6d] text-sm font-semibold hover:brightness-110">
          <PhoneOff className="size-4" /> Decline
        </button>
        <button type="button" onClick={onAccept} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#25d366] text-sm font-semibold text-[#111b21] hover:brightness-110">
          <Phone className="size-4" /> Answer
        </button>
      </div>
      {more > 0 && <p className="mt-2 text-center text-xs text-[#8696a0]">+{more} more calling</p>}
    </div>
  );
}

function ActiveCard({ session, onHangUp, onMute, onOpen }: { session: Session; onHangUp: () => void; onMute: () => void; onOpen: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (session.phase !== 'active') return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [session.phase]);
  const { call, phase } = session;
  const status =
    phase === 'ended'
      ? session.endedText
      : phase === 'active' && session.since
        ? mmss(Math.round((Date.now() - session.since) / 1000))
        : phase === 'ringing'
          ? 'Ringing…'
          : call.direction === 'OUTBOUND'
            ? 'Calling…'
            : 'Connecting…';
  return (
    <div className={cardCls} aria-live="polite">
      <div className="flex items-center gap-3">
        <Avatar call={call} pulse={phase === 'ringing'} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#8696a0]">WhatsApp call</p>
          <p className="truncate text-[15px] font-semibold">{label(call)}</p>
          <p className={cn('truncate text-xs tabular-nums', phase === 'active' ? 'text-[#25d366]' : 'text-[#8696a0]')}>{status}</p>
        </div>
      </div>
      {phase !== 'ended' && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={onMute}
            disabled={phase !== 'active'}
            className={cn('flex size-11 items-center justify-center rounded-full transition-colors disabled:opacity-40', session.muted ? 'bg-white text-[#111b21]' : 'bg-white/10 hover:bg-white/20')}
            aria-label={session.muted ? 'Unmute' : 'Mute'}
            title={session.muted ? 'Unmute' : 'Mute'}
          >
            {session.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </button>
          <button type="button" onClick={onOpen} className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Open chat" title="Open chat">
            <MessageCircle className="size-5" />
          </button>
          <button type="button" onClick={onHangUp} className="flex size-12 items-center justify-center rounded-full bg-[#f15c6d] hover:brightness-110" aria-label="Hang up" title="Hang up">
            <PhoneOff className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
