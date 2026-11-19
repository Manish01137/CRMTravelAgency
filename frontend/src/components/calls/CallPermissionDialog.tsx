import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PhoneCall, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';

interface Permission {
  status: string;
  expiresAt: number | null;
  canCall: boolean;
  canAsk: boolean;
  insideWindow: boolean;
}

/**
 * WhatsApp only lets a business call a customer who said yes first. This asks
 * them ("Allow calls?" with Allow / Don't allow buttons on their phone) and
 * shows where things stand. Their answer appears in the chat.
 */
export function CallPermissionDialog({
  conversationId,
  open,
  onOpenChange,
  agencyName,
  onCall,
}: {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyName?: string;
  onCall: () => void;
}) {
  const queryClient = useQueryClient();
  const defaultText = `Hi! ${agencyName || 'We'} would like to call you on WhatsApp about your trip. Is that okay?`;
  const [text, setText] = useState(defaultText);
  useEffect(() => {
    if (open) setText(defaultText);
  }, [open, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const permission = useQuery({
    queryKey: ['call-permission', conversationId],
    queryFn: () => api.get<Permission>(`/calls/conversations/${conversationId}/permission`),
    enabled: open,
    staleTime: 0,
    retry: false,
  });

  const ask = useMutation({
    mutationFn: () => api.post(`/calls/conversations/${conversationId}/permission`, { text }),
    onSuccess: () => {
      toast.success('Call request sent — you’ll see their answer in the chat');
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not send the request'),
  });

  const p = permission.data;
  const until = p?.expiresAt ? new Date(p.expiresAt * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permission to call</DialogTitle>
          <DialogDescription>
            WhatsApp only lets you call customers who said yes. They get a message with <b>Allow</b> / <b>Don’t allow</b> buttons — a yes usually lasts 7 days.
          </DialogDescription>
        </DialogHeader>

        {permission.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : permission.isError ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {permission.error instanceof ApiError ? permission.error.message : 'Could not check with WhatsApp right now.'}
          </p>
        ) : p && (p.status === 'temporary' || p.status === 'permanent') ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              {p.status === 'permanent' ? 'This customer has allowed your calls.' : `This customer has allowed your calls${until ? ` until ${until}` : ''}.`}
              {!p.canCall && ' WhatsApp is limiting calls to them right now — try again later.'}
            </p>
            <Button
              className="w-full"
              disabled={!p.canCall}
              onClick={() => {
                onOpenChange(false);
                onCall();
              }}
            >
              <PhoneCall className="size-4" /> Call now
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {p && !p.insideWindow ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                It’s been more than 24 hours since this customer last messaged, so WhatsApp won’t deliver a call request. Send them a template first — once they reply, ask here.
              </p>
            ) : p && !p.canAsk ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                You asked this customer recently — WhatsApp allows 1 request a day and 2 a week. Try again later, or ask them to call you.
              </p>
            ) : null}
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1024} aria-label="Message with the request" />
            <Button className="w-full" disabled={ask.isPending || !text.trim() || (!!p && (!p.insideWindow || !p.canAsk))} onClick={() => ask.mutate()}>
              {ask.isPending ? <Spinner className="size-4" /> : <PhoneCall className="size-4" />} Ask to allow calls
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
