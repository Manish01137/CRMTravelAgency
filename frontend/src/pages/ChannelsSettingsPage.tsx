import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Instagram, Mail, MessageCircle, Plug, Unplug } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { ChannelsPlatformConfig, ChannelStatus, ChannelType } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { launchWhatsAppEmbeddedSignup, buildInstagramAuthUrl, instagramRedirectUri } from '@/lib/metaSignup';

function statusBadge(status: ChannelStatus['status']) {
  if (status === 'CONNECTED') return <Badge variant="success">Connected</Badge>;
  if (status === 'FAILED') return <Badge variant="destructive">Connection failed</Badge>;
  return <Badge variant="muted">Not connected</Badge>;
}

/** WhatsApp / Instagram card — OAuth connect via Embedded Signup or Instagram Login. */
function OAuthChannelCard({
  icon,
  title,
  description,
  status,
  enabled,
  onConnect,
  connecting,
  onDisconnect,
  disconnecting,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: ChannelStatus;
  enabled: boolean;
  onConnect: () => void;
  connecting: boolean;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {icon} {title}
          </CardTitle>
          {statusBadge(status.status)}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.status === 'CONNECTED' && status.displayName && (
          <p className="text-sm font-medium text-foreground">{status.displayName}</p>
        )}
        {status.status === 'FAILED' && status.lastError && (
          <p className="flex items-start gap-1.5 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {status.lastError}
          </p>
        )}
        {!enabled && status.status !== 'CONNECTED' && (
          <p className="text-xs text-muted-foreground">
            Not configured on this server yet — an admin needs to set up the Meta App first.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          {status.status === 'CONNECTED' ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={disconnecting}>
              {disconnecting ? <Spinner className="size-4" /> : <Unplug className="size-4" />} Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={onConnect} disabled={!enabled || connecting}>
              {connecting ? <Spinner className="size-4" /> : <Plug className="size-4" />}
              {status.status === 'FAILED' ? 'Try again' : `Connect ${title}`}
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Disconnect ${title}?`}
        description={`Your team will stop sending/receiving ${title} messages here until you reconnect.`}
        confirmLabel="Disconnect"
        destructive
        loading={disconnecting}
        onConfirm={() => {
          onDisconnect();
          setConfirmOpen(false);
        }}
      />
    </Card>
  );
}

/** Email card — plain API key form (no OAuth equivalent for email providers). */
function EmailChannelCard({ status }: { status: ChannelStatus }) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [fromAddress, setFromAddress] = useState(status.status === 'CONNECTED' ? status.displayName ?? '' : '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => api.patch<ChannelStatus>('/channels/email', { apiKey, fromAddress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Email connected');
      setApiKey('');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save Email settings'),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => api.delete('/channels/EMAIL'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Email disconnected');
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" /> Email
          </CardTitle>
          {statusBadge(status.status)}
        </div>
        <CardDescription>Resend (or SendGrid) API key — used to send package PDFs and follow-ups from a lead.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.status === 'CONNECTED' && (
          <p className="text-sm font-medium text-foreground">Sending as {status.displayName}</p>
        )}
        <Field label="From address" htmlFor="emailFrom">
          <Input id="emailFrom" type="email" placeholder="bookings@youragency.com" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} />
        </Field>
        <Field label="API key" htmlFor="emailKey" hint="Stored encrypted — never shown again after saving.">
          <Input id="emailKey" type="password" placeholder="re_xxxxxxxxxxxx" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={!apiKey.trim() || !fromAddress.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending && <Spinner className="size-4" />} Save
          </Button>
          {status.status === 'CONNECTED' && (
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={disconnectMutation.isPending}>
              <Unplug className="size-4" /> Disconnect
            </Button>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect Email?"
        description="Your team won't be able to send emails from leads until you reconnect."
        confirmLabel="Disconnect"
        destructive
        loading={disconnectMutation.isPending}
        onConfirm={() => {
          disconnectMutation.mutate();
          setConfirmOpen(false);
        }}
      />
    </Card>
  );
}

export function ChannelsSettingsPage() {
  const queryClient = useQueryClient();
  const [connectingChannel, setConnectingChannel] = useState<ChannelType | null>(null);

  const configQuery = useQuery({ queryKey: ['channels-config'], queryFn: () => api.get<ChannelsPlatformConfig>('/channels/config') });
  const channelsQuery = useQuery({ queryKey: ['channels'], queryFn: () => api.get<ChannelStatus[]>('/channels') });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['channels'] });

  const whatsapp = channelsQuery.data?.find((c) => c.channel === 'WHATSAPP');
  const instagram = channelsQuery.data?.find((c) => c.channel === 'INSTAGRAM');
  const email = channelsQuery.data?.find((c) => c.channel === 'EMAIL');

  const disconnectMutation = useMutation({
    mutationFn: (channel: ChannelType) => api.delete(`/channels/${channel}`),
    onSuccess: () => {
      invalidate();
      toast.success('Disconnected');
    },
    onError: () => toast.error('Could not disconnect'),
  });

  const handleConnectWhatsApp = async () => {
    const cfg = configQuery.data;
    if (!cfg?.metaAppId || !cfg.whatsappConfigId) {
      toast.error('WhatsApp is not configured on this server yet');
      return;
    }
    setConnectingChannel('WHATSAPP');
    try {
      const result = await launchWhatsAppEmbeddedSignup(cfg.metaAppId, cfg.whatsappConfigId);
      await api.post('/channels/whatsapp/connect', result);
      invalidate();
      toast.success('WhatsApp connected');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Connection failed, try again');
      invalidate();
    } finally {
      setConnectingChannel(null);
    }
  };

  const handleConnectInstagram = () => {
    const cfg = configQuery.data;
    if (!cfg?.instagramAppId) {
      toast.error('Instagram is not configured on this server yet');
      return;
    }
    window.location.href = buildInstagramAuthUrl(cfg.instagramAppId, instagramRedirectUri());
  };

  const loading = configQuery.isLoading || channelsQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Channels"
        description="Connect WhatsApp, Instagram and Email — each organization connects its own accounts."
      />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <OAuthChannelCard
            icon={<MessageCircle className="size-5 text-emerald-600" />}
            title="WhatsApp"
            description="Connect via Meta's Embedded Signup — you log into your own Meta account, we never see your password."
            status={whatsapp ?? { channel: 'WHATSAPP', status: 'NOT_CONNECTED', displayName: null, lastError: null, connectedAt: null }}
            enabled={!!configQuery.data?.whatsappEnabled}
            onConnect={handleConnectWhatsApp}
            connecting={connectingChannel === 'WHATSAPP'}
            onDisconnect={() => disconnectMutation.mutate('WHATSAPP')}
            disconnecting={disconnectMutation.isPending && disconnectMutation.variables === 'WHATSAPP'}
          />
          <OAuthChannelCard
            icon={<Instagram className="size-5 text-pink-600" />}
            title="Instagram"
            description="Direct Instagram Login — no Facebook Page required. Reuses the same inbox as WhatsApp."
            status={instagram ?? { channel: 'INSTAGRAM', status: 'NOT_CONNECTED', displayName: null, lastError: null, connectedAt: null }}
            enabled={!!configQuery.data?.instagramEnabled}
            onConnect={handleConnectInstagram}
            connecting={false}
            onDisconnect={() => disconnectMutation.mutate('INSTAGRAM')}
            disconnecting={disconnectMutation.isPending && disconnectMutation.variables === 'INSTAGRAM'}
          />
          <EmailChannelCard status={email ?? { channel: 'EMAIL', status: 'NOT_CONNECTED', displayName: null, lastError: null, connectedAt: null }} />
        </div>
      )}
    </div>
  );
}
