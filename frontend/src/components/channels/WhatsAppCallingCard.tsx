import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellRing, PhoneCall } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface CallingSettings {
  enabled: boolean;
  callIconVisibility: 'DEFAULT' | 'DISABLE_ALL';
  callbackPermission: 'ENABLED' | 'DISABLED';
}

/** Settings → Channels: turn WhatsApp calling on for this number (incoming + outgoing, answered in the browser). */
export function WhatsAppCallingCard() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['whatsapp-calling'],
    queryFn: () => api.get<CallingSettings>('/calls/settings'),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (next: CallingSettings) => api.put<CallingSettings>('/calls/settings', next),
    onSuccess: (data) => {
      queryClient.setQueryData(['whatsapp-calling'], data);
      toast.success(data.enabled ? 'WhatsApp calling is on' : 'WhatsApp calling is off');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not change the calling settings'),
  });
  const [alerts, setAlerts] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));

  const s = settings.data;
  const update = (patch: Partial<CallingSettings>) => s && save.mutate({ ...s, ...patch });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="size-5 text-[#25d366]" /> WhatsApp calling
        </CardTitle>
        <CardDescription>
          Customers can call your WhatsApp number and your team answers right here in the CRM (headset or laptop mic). You can also call customers from any WhatsApp chat once they
          allow it. Incoming calls are free; calls you make are charged by Meta per minute.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : settings.isError || !s ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {settings.error instanceof ApiError ? settings.error.message : 'Could not load the calling settings from WhatsApp.'}
          </p>
        ) : (
          <>
            <Row
              title="Turn on WhatsApp calling"
              text="Calls to your WhatsApp number ring in the CRM — for admins and for the teammate the chat is assigned to."
              checked={s.enabled}
              disabled={save.isPending}
              onChange={(on) => update({ enabled: on })}
            />
            {s.enabled && (
              <>
                <Row
                  title="Show the call button to customers"
                  text="Off: customers can't start calls, but you can still call those who allowed it."
                  checked={s.callIconVisibility === 'DEFAULT'}
                  disabled={save.isPending}
                  onChange={(on) => update({ callIconVisibility: on ? 'DEFAULT' : 'DISABLE_ALL' })}
                />
                <Row
                  title="Ask callers if you may call them back"
                  text="When a customer calls, WhatsApp asks them to allow your calls too — so you can call back without a separate request."
                  checked={s.callbackPermission === 'ENABLED'}
                  disabled={save.isPending}
                  onChange={(on) => update({ callbackPermission: on ? 'ENABLED' : 'DISABLED' })}
                />
              </>
            )}
          </>
        )}

        {alerts !== 'unsupported' && alerts !== 'granted' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Ring me when the CRM is in the background</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {alerts === 'denied' ? 'Notifications are blocked for this site — allow them from the 🔒 icon in the address bar.' : 'Shows a desktop alert for incoming calls on this computer.'}
              </p>
            </div>
            {alerts !== 'denied' && (
              <Button variant="outline" size="sm" onClick={() => void Notification.requestPermission().then(setAlerts)}>
                <BellRing className="size-4" /> Turn on alerts
              </Button>
            )}
          </div>
        )}

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">Before the first call (one-time setup)</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              In the Meta App Dashboard → WhatsApp → Configuration → Webhook fields, subscribe to <b>calls</b> (next to “messages”).
            </li>
            <li>Meta allows calling on numbers with a messaging limit of at least 2,000 customers a day.</li>
            <li>Keep the CRM open in a tab to hear calls ring, and allow the microphone when the browser asks.</li>
            <li>To call a customer, open their chat → phone icon → “Ask permission to call”. Once they tap Allow, choose “WhatsApp call”.</li>
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

function Row({ title, text, checked, disabled, onChange }: { title: string; text: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
