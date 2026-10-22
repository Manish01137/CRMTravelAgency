import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Phone, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { WhatsAppSyncResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

/**
 * On a CONNECTED WhatsApp card: asks Meta for the number's real status — for
 * connections saved before the status check existed, which may really be
 * "Pending" in WhatsApp Manager.
 */
export function WhatsAppRecheckButton({ onResult }: { onResult: (result: WhatsAppSyncResult) => void }) {
  const resync = useMutation({
    mutationFn: () => api.post<WhatsAppSyncResult>('/channels/whatsapp/resync'),
    onSuccess: (r) => {
      onResult(r);
      if (r.status === 'CONNECTED') toast.success('Meta confirms the number is live');
      else toast.warning('Meta hasn’t activated the number yet — see the details on the card');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not check the status'),
  });
  return (
    <Button size="sm" variant="ghost" className="-ml-2 text-muted-foreground" onClick={() => resync.mutate()} disabled={resync.isPending}>
      {resync.isPending ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />} Re-check status with Meta
    </Button>
  );
}

/**
 * WhatsApp connected through Embedded Signup, but Meta hasn't activated the
 * number yet ("Pending" in WhatsApp Manager). "Re-check status" asks Meta again
 * and registers the number; if Meta wants the number verified first, the
 * SMS / voice code steps show up.
 */
export function WhatsAppPendingSetup({
  needsVerification,
  onResult,
}: {
  needsVerification: boolean;
  onResult: (result: WhatsAppSyncResult) => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');

  const report = (result: WhatsAppSyncResult) => {
    onResult(result);
    if (result.status === 'CONNECTED') toast.success('WhatsApp number is live 🎉');
  };
  const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

  const resync = useMutation({
    mutationFn: () => api.post<WhatsAppSyncResult>('/channels/whatsapp/resync'),
    onSuccess: (r) => {
      report(r);
      if (r.status !== 'CONNECTED') toast.warning('Meta hasn’t activated the number yet — see the details on the card');
    },
    onError: (err) => toast.error(errorText(err, 'Could not check the status')),
  });

  const requestCode = useMutation({
    mutationFn: (method: 'SMS' | 'VOICE') => api.post<WhatsAppSyncResult>('/channels/whatsapp/request-code', { method }),
    onSuccess: (r, method) => {
      setCodeSent(true);
      report(r);
      toast.success(method === 'SMS' ? 'Code sent by SMS' : 'You’ll get a call with the code');
    },
    onError: (err) => toast.error(errorText(err, 'Could not send the code')),
  });

  const verify = useMutation({
    mutationFn: () => api.post<WhatsAppSyncResult>('/channels/whatsapp/verify-code', { code }),
    onSuccess: (r) => {
      report(r);
      setCode('');
      if (r.status !== 'CONNECTED') toast.warning('Code accepted, but Meta hasn’t activated the number yet — see the details on the card');
    },
    onError: (err) => toast.error(errorText(err, 'That code didn’t work')),
  });

  const codeFlow = needsVerification || showCode;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Finish activating your number</p>
      <p className="mt-1 text-xs text-amber-800">
        Meta added the number to your account but hasn’t activated it yet, so messages can’t be sent or received. Re-check once Meta finishes, or
        verify the number with a code.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => resync.mutate()} disabled={resync.isPending}>
          {resync.isPending ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />} Re-check status
        </Button>
        {!codeFlow && (
          <Button size="sm" variant="ghost" onClick={() => setShowCode(true)}>
            <ShieldCheck className="size-4" /> Verify with a code
          </Button>
        )}
      </div>

      {codeFlow && (
        <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
          <p className="text-xs font-medium text-amber-900">1. Get a code on the WhatsApp number</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => requestCode.mutate('SMS')} disabled={requestCode.isPending}>
              {requestCode.isPending && requestCode.variables === 'SMS' ? <Spinner className="size-4" /> : <MessageSquare className="size-4" />} Send by SMS
            </Button>
            <Button size="sm" variant="outline" onClick={() => requestCode.mutate('VOICE')} disabled={requestCode.isPending}>
              {requestCode.isPending && requestCode.variables === 'VOICE' ? <Spinner className="size-4" /> : <Phone className="size-4" />} Call me
            </Button>
          </div>
          <p className="pt-1 text-xs font-medium text-amber-900">2. Enter the 6-digit code{codeSent ? ' you received' : ''}</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              verify.mutate();
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123456"
              className="h-9 max-w-[9rem] bg-white"
              aria-label="Verification code"
            />
            <Button size="sm" type="submit" disabled={code.replace(/\D/g, '').length !== 6 || verify.isPending}>
              {verify.isPending && <Spinner className="size-4" />} Verify
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
