import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Instagram, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  IG_OAUTH_CHANNEL,
  instagramRedirectUri,
  pendingInstagramPopupState,
  pendingInstagramRedirectState,
  type InstagramOAuthMessage,
} from '@/lib/metaSignup';
import type { ConnectInstagramResult, InstagramPageOption } from '@/types';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

/**
 * Redirect target for the Instagram OAuth flow (Settings → Channels →
 * Connect Instagram). Facebook Login sends the user back here with
 * `?code=...`; we exchange it server-side and bounce back to Channels.
 *
 * Usually resolves straight to "done" — but if the org manages more than one
 * Facebook Page with a linked Instagram account, the backend can't guess
 * which one they meant, so it hands back the list and this page asks.
 */
export function InstagramCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'working' | 'picking' | 'done' | 'error' | 'handedBack'>('working');
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<InstagramPageOption[]>([]);
  const [selecting, setSelecting] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get('code');
    const errorDescription = params.get('error_description');
    const returnedState = params.get('state');

    // Popup login (Settings → Channels): hand the result to the waiting tab and close.
    if (returnedState && returnedState === pendingInstagramPopupState()) {
      const msg: InstagramOAuthMessage = { state: returnedState, code: code ?? undefined, error: errorDescription ?? (code ? undefined : 'No authorization code was returned') };
      const channel = new BroadcastChannel(IG_OAUTH_CHANNEL);
      channel.postMessage(msg);
      channel.close();
      setState('handedBack');
      window.setTimeout(() => window.close(), 300);
      return;
    }
    // Full-page login: the state must be the one this tab started with.
    const expected = pendingInstagramRedirectState();
    if (expected && returnedState !== expected) {
      setState('error');
      setMessage('This sign-in link didn’t come from this browser — start Connect Instagram again.');
      return;
    }
    try {
      window.sessionStorage.removeItem('ig_oauth_state');
    } catch {
      /* storage unavailable */
    }
    if (errorDescription) {
      setState('error');
      setMessage(errorDescription);
      return;
    }
    if (!code) {
      setState('error');
      setMessage('No authorization code was returned by Instagram.');
      return;
    }
    api
      .post<ConnectInstagramResult>('/channels/instagram/connect', { code, redirectUri: instagramRedirectUri() })
      .then((result) => {
        if (result.status === 'needs_selection') {
          setOptions(result.options);
          setState('picking');
        } else {
          setState('done');
        }
      })
      .catch((err) => {
        setState('error');
        setMessage(err instanceof ApiError ? err.message : 'Connection failed, try again');
      });
  }, [params]);

  const choosePage = async (option: InstagramPageOption) => {
    setSelecting(true);
    try {
      await api.post('/channels/instagram/select-page', option);
      setState('done');
    } catch (err) {
      setState('error');
      setMessage(err instanceof ApiError ? err.message : 'Connection failed, try again');
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        {state === 'handedBack' && (
          <>
            <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
            <p className="mt-4 font-medium text-foreground">Signed in with Instagram</p>
            <p className="mt-1 text-sm text-muted-foreground">Finishing in your CRM tab — you can close this window.</p>
          </>
        )}
        {state === 'working' && (
          <>
            <Spinner className="mx-auto size-8 text-primary" />
            <p className="mt-4 font-medium text-foreground">Connecting Instagram…</p>
          </>
        )}
        {state === 'picking' && (
          <>
            <Instagram className="mx-auto size-8 text-primary" />
            <p className="mt-4 font-medium text-foreground">Which account?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              More than one Facebook Page you manage has an Instagram account linked — pick the one to connect.
            </p>
            <div className="mt-5 space-y-2 text-left">
              {options.map((option) => (
                <button
                  key={option.pageId}
                  type="button"
                  disabled={selecting}
                  onClick={() => choosePage(option)}
                  className="w-full rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="font-medium text-foreground">{option.pageName}</p>
                  <p className="text-xs text-muted-foreground">@{option.instagramUsername}</p>
                </button>
              ))}
            </div>
            {selecting && <Spinner className="mx-auto mt-4 size-5 text-primary" />}
          </>
        )}
        {state === 'done' && (
          <>
            <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
            <p className="mt-4 font-medium text-foreground">Instagram connected</p>
            <Button className="mt-5" onClick={() => navigate('/settings/channels')}>
              Back to Channels
            </Button>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto size-10 text-destructive" />
            <p className="mt-4 font-medium text-foreground">Connection failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            <Button className="mt-5" variant="outline" onClick={() => navigate('/settings/channels')}>
              Back to Channels
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
