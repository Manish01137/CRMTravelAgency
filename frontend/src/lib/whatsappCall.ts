/**
 * The browser side of a WhatsApp voice call: one WebRTC audio connection
 * straight to WhatsApp. Our server only passes the SDP texts back and forth
 * (see backend modules/calls).
 *
 * WhatsApp's media server is ICE-lite with public addresses, so a STUN server
 * is all we need; and it wants our whole SDP in one go (no trickle ICE), so we
 * wait for candidate gathering before handing the SDP over.
 */

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const GATHER_TIMEOUT_MS = 2500;

export class MicrophoneError extends Error {}

async function getMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError('This browser can’t use a microphone here — open the CRM over https in Chrome, Edge or Safari.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new MicrophoneError('Microphone access is blocked — allow the microphone for this site (the 🔒 icon in the address bar) and try again.');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new MicrophoneError('No microphone found — plug in a headset or microphone and try again.');
    }
    if (name === 'NotReadableError') {
      throw new MicrophoneError('Your microphone is being used by another app — close it and try again.');
    }
    throw new MicrophoneError('Could not start the microphone.');
  }
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    // Some networks never report "complete" — host + STUN candidates are in by now.
    const timer = setTimeout(done, GATHER_TIMEOUT_MS);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export interface CallMedia {
  /** Our SDP (offer for an outgoing call, answer for an incoming one). */
  localSdp: string;
  /** Outgoing calls: apply the customer's SDP answer when it arrives. */
  applyAnswer: (sdp: string) => Promise<void>;
  setMuted: (muted: boolean) => void;
  close: () => void;
  /** Called once if the audio connection drops for good. */
  onFailed: (cb: () => void) => void;
}

async function createConnection(): Promise<{ pc: RTCPeerConnection; mic: MediaStream; audio: HTMLAudioElement; failedCbs: (() => void)[] }> {
  const mic = await getMicrophone();
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
  for (const track of mic.getAudioTracks()) pc.addTrack(track, mic);

  const audio = new Audio();
  audio.autoplay = true;
  pc.addEventListener('track', (e) => {
    audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    void audio.play().catch(() => undefined);
  });

  const failedCbs: (() => void)[] = [];
  let failed = false;
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const fail = () => {
    if (failed) return;
    failed = true;
    failedCbs.forEach((cb) => cb());
  };
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed') fail();
    // "disconnected" often recovers by itself (Wi-Fi blip) — give it a moment.
    if (pc.connectionState === 'disconnected') disconnectTimer = setTimeout(() => pc.connectionState !== 'connected' && fail(), 10_000);
    if (pc.connectionState === 'connected' && disconnectTimer) clearTimeout(disconnectTimer);
  });
  return { pc, mic, audio, failedCbs };
}

function wrap(pc: RTCPeerConnection, mic: MediaStream, audio: HTMLAudioElement, failedCbs: (() => void)[]): Omit<CallMedia, 'localSdp'> {
  return {
    applyAnswer: async (sdp) => {
      if (pc.signalingState === 'have-local-offer') await pc.setRemoteDescription({ type: 'answer', sdp });
    },
    setMuted: (muted) => mic.getAudioTracks().forEach((t) => (t.enabled = !muted)),
    close: () => {
      mic.getTracks().forEach((t) => t.stop());
      audio.srcObject = null;
      try {
        pc.close();
      } catch {
        /* already closed */
      }
    },
    onFailed: (cb) => failedCbs.push(cb),
  };
}

/** Incoming call: answer the customer's SDP offer. */
export async function answerCall(offerSdp: string): Promise<CallMedia> {
  const { pc, mic, audio, failedCbs } = await createConnection();
  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc);
    return { localSdp: pc.localDescription?.sdp ?? answer.sdp ?? '', ...wrap(pc, mic, audio, failedCbs) };
  } catch (err) {
    wrap(pc, mic, audio, failedCbs).close();
    throw err;
  }
}

/** Outgoing call: our SDP offer (the customer's answer comes later via applyAnswer). */
export async function offerCall(): Promise<CallMedia> {
  const { pc, mic, audio, failedCbs } = await createConnection();
  try {
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);
    return { localSdp: pc.localDescription?.sdp ?? offer.sdp ?? '', ...wrap(pc, mic, audio, failedCbs) };
  } catch (err) {
    wrap(pc, mic, audio, failedCbs).close();
    throw err;
  }
}

// --- Tones (no audio files needed) ---------------------------------------------

let ctx: AudioContext | null = null;
function audioContext(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * A repeating two-tone ring. `kind: 'ring'` for an incoming call (louder),
 * 'ringback' while we wait for the customer to pick up. Returns stop().
 */
export function playTone(kind: 'ring' | 'ringback'): () => void {
  const ac = audioContext();
  if (!ac) return () => undefined;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.connect(ac.destination);
  const oscillators = (kind === 'ring' ? [440, 480] : [425]).map((f) => {
    const o = ac.createOscillator();
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    return o;
  });
  const level = kind === 'ring' ? 0.12 : 0.05;
  const [on, off] = kind === 'ring' ? [1.2, 0.4] : [1.0, 3.0];
  let stopped = false;
  const cycle = () => {
    if (stopped) return;
    const t = ac.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.03);
    gain.gain.setValueAtTime(level, t + on);
    gain.gain.linearRampToValueAtTime(0, t + on + 0.03);
    if (kind === 'ring') {
      // double ring: on · short gap · on · long gap
      gain.gain.setValueAtTime(0, t + on + off);
      gain.gain.linearRampToValueAtTime(level, t + on + off + 0.03);
      gain.gain.setValueAtTime(level, t + 2 * on + off);
      gain.gain.linearRampToValueAtTime(0, t + 2 * on + off + 0.03);
    }
  };
  cycle();
  const period = kind === 'ring' ? (2 * 1.2 + 0.4 + 2) * 1000 : (on + off) * 1000;
  const timer = setInterval(cycle, period);
  return () => {
    stopped = true;
    clearInterval(timer);
    try {
      gain.gain.cancelScheduledValues(ac.currentTime);
      gain.gain.setValueAtTime(0, ac.currentTime);
      oscillators.forEach((o) => o.stop());
      gain.disconnect();
    } catch {
      /* already stopped */
    }
  };
}

/** Lets the ring sound start later without a click (browsers need one gesture first). */
export function unlockAudio(): void {
  audioContext();
}
