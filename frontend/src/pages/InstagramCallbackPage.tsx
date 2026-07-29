import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { instagramRedirectUri } from '@/lib/metaSignup';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

/**
 * Redirect target for the Instagram OAuth flow (Settings → Channels →
 * Connect Instagram). Instagram sends the user back here with `?code=...`;
 * we exchange it server-side and bounce back to Channels.
 */
export function InstagramCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get('code');
    const errorDescription = params.get('error_description');
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
      .post('/channels/instagram/connect', { code, redirectUri: instagramRedirectUri() })
      .then(() => setState('done'))
      .catch((err) => {
        setState('error');
        setMessage(err instanceof ApiError ? err.message : 'Connection failed, try again');
      });
  }, [params]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        {state === 'working' && (
          <>
            <Spinner className="mx-auto size-8 text-primary" />
            <p className="mt-4 font-medium text-foreground">Connecting Instagram…</p>
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
