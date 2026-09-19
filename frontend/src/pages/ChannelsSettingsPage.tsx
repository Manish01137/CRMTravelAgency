import { useMemo, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Camera, Instagram, Mail, MessageCircle, Plug, Plus, Trash2, Unplug, UserRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { ChannelsPlatformConfig, ChannelStatus, ChannelType, WhatsAppBusinessProfile } from '@/types';
import { WHATSAPP_VERTICALS } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { launchWhatsAppEmbeddedSignup, buildInstagramAuthUrl, instagramRedirectUri } from '@/lib/metaSignup';

const VERTICAL_LABELS: Record<string, string> = {
  UNDEFINED: 'Not set',
  OTHER: 'Other',
  AUTO: 'Automotive',
  BEAUTY: 'Beauty, spa & salon',
  APPAREL: 'Clothing & apparel',
  EDU: 'Education',
  ENTERTAIN: 'Entertainment',
  EVENT_PLAN: 'Event planning',
  FINANCE: 'Finance & banking',
  GROCERY: 'Grocery',
  GOVT: 'Government',
  HOTEL: 'Hotel & lodging',
  HEALTH: 'Medical & health',
  NONPROFIT: 'Non-profit',
  PROF_SERVICES: 'Professional services',
  RETAIL: 'Shopping & retail',
  TRAVEL: 'Travel & transportation',
  RESTAURANT: 'Restaurant',
  NOT_A_BIZ: 'Not a business',
};

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

interface BusinessProfileFormValues {
  about: string;
  description: string;
  address: string;
  email: string;
  vertical: string;
  websites: { value: string }[];
}

const toFormValues = (p: WhatsAppBusinessProfile | undefined): BusinessProfileFormValues => ({
  about: p?.about ?? '',
  description: p?.description ?? '',
  address: p?.address ?? '',
  email: p?.email ?? '',
  vertical: p?.vertical ?? 'TRAVEL',
  websites: (p?.websites ?? []).map((value) => ({ value })),
});

/**
 * The "About" info a customer sees when they tap your business's name in
 * WhatsApp — photo, status line, description, address, email, websites.
 * Only shown once WhatsApp is connected (there's no phone number to attach
 * a profile to otherwise).
 */
function WhatsAppBusinessProfileCard() {
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery({
    queryKey: ['whatsapp-business-profile'],
    queryFn: () => api.get<WhatsAppBusinessProfile>('/channels/whatsapp/business-profile'),
  });

  // RHF's `values` option resets the form whenever this reference changes —
  // memoized so typing (which doesn't touch profileQuery.data) never fights it.
  const formValues = useMemo(() => toFormValues(profileQuery.data), [profileQuery.data]);
  const { register, handleSubmit, control, watch } = useForm<BusinessProfileFormValues>({ values: formValues });
  const { fields, append, remove } = useFieldArray({ control, name: 'websites' });
  const aboutLength = watch('about')?.length ?? 0;

  const saveMutation = useMutation({
    mutationFn: (v: BusinessProfileFormValues) =>
      api.patch<WhatsAppBusinessProfile>('/channels/whatsapp/business-profile', {
        about: v.about.trim(),
        description: v.description.trim(),
        address: v.address.trim(),
        email: v.email.trim(),
        vertical: v.vertical,
        websites: v.websites.map((w) => w.value.trim()).filter(Boolean),
      }),
    onSuccess: (updated) => {
      // Updates profileQuery.data → the memoized `values` above re-syncs the form automatically.
      queryClient.setQueryData(['whatsapp-business-profile'], updated);
      toast.success('WhatsApp Business Profile updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update the profile'),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.upload<WhatsAppBusinessProfile>('/channels/whatsapp/business-profile/photo', file),
    onSuccess: (updated) => {
      queryClient.setQueryData(['whatsapp-business-profile'], updated);
      toast.success('Profile photo updated');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not upload the photo'),
  });

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'image/jpeg') {
      toast.error('WhatsApp only accepts a JPEG photo for the Business Profile');
      return;
    }
    photoMutation.mutate(file);
  };

  return (
    <Card className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-5 text-emerald-600" /> WhatsApp Business Profile
        </CardTitle>
        <CardDescription>
          What a customer sees when they tap your business's name inside WhatsApp — photo, status line, description,
          address and contact details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {profileQuery.isLoading ? (
          <Skeleton className="h-56 rounded-lg" />
        ) : (
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4" noValidate>
            <div className="flex items-center gap-4">
              <input ref={photoInputRef} type="file" accept="image/jpeg" className="hidden" onChange={handlePhotoSelected} />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoMutation.isPending}
                className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-input bg-surface transition-colors hover:border-primary"
                aria-label="Upload profile photo"
              >
                {photoMutation.isPending ? (
                  <Spinner className="size-5" />
                ) : profileQuery.data?.profilePictureUrl ? (
                  <>
                    <img src={profileQuery.data.profilePictureUrl} alt="" className="size-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Camera className="size-5 text-white" />
                    </span>
                  </>
                ) : (
                  <Camera className="size-6 text-muted-foreground/60" />
                )}
              </button>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Profile photo</p>
                <p>JPEG only, up to 5 MB — shown as your business's DP inside WhatsApp.</p>
              </div>
            </div>

            <Field label="About" htmlFor="waAbout" hint={`Short status line under your name (${aboutLength}/139).`}>
              <Input id="waAbout" maxLength={139} placeholder="Making your trips unforgettable ✈" {...register('about')} />
            </Field>
            <Field label="Description" htmlFor="waDescription" hint="Shown on your Business Profile's info screen.">
              <Textarea id="waDescription" rows={3} maxLength={512} placeholder="Full-service travel agency for domestic & international holidays." {...register('description')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address" htmlFor="waAddress">
                <Textarea id="waAddress" rows={2} maxLength={256} placeholder="123 MG Road, Bengaluru, India" {...register('address')} />
              </Field>
              <div className="space-y-4">
                <Field label="Email" htmlFor="waEmail">
                  <Input id="waEmail" type="email" placeholder="hello@youragency.com" {...register('email')} />
                </Field>
                <Field label="Business category" htmlFor="waVertical">
                  <select
                    id="waVertical"
                    className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                    {...register('vertical')}
                  >
                    {WHATSAPP_VERTICALS.map((v) => (
                      <option key={v} value={v}>
                        {VERTICAL_LABELS[v] ?? v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Websites</p>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2">
                    <Input placeholder="https://youragency.com" {...register(`websites.${idx}.value`)} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove website" onClick={() => remove(idx)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              {fields.length < 2 && (
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ value: '' })}>
                  <Plus /> Add website
                </Button>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Spinner />}
                Save Business Profile
              </Button>
            </div>
          </form>
        )}
      </CardContent>
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
    if (!cfg?.whatsappAppId || !cfg.whatsappConfigId) {
      toast.error('WhatsApp is not configured on this server yet');
      return;
    }
    setConnectingChannel('WHATSAPP');
    try {
      const result = await launchWhatsAppEmbeddedSignup(cfg.whatsappAppId, cfg.whatsappConfigId);
      // TEMP DEBUG: this is the actual call to our backend — if this log
      // never appears, the flow died inside launchWhatsAppEmbeddedSignup
      // (see metaSignup.ts logs) before ever getting here.
      console.log('[ChannelsSettingsPage] calling POST /channels/whatsapp/connect with payload:', result);
      const response = await api.post('/channels/whatsapp/connect', result);
      console.log('[ChannelsSettingsPage] POST /channels/whatsapp/connect succeeded — response body:', response);
      invalidate();
      toast.success('WhatsApp connected');
    } catch (err) {
      // Log the FULL error object (status/code/details for ApiError, or the
      // raw error otherwise) — not just the message string used for the toast.
      console.error('[ChannelsSettingsPage] WhatsApp connect flow failed — full error:', err);
      if (err instanceof ApiError) {
        console.error('[ChannelsSettingsPage] ApiError details — status:', err.status, '| code:', err.code, '| details:', err.details);
      }
      toast.error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Connection failed, try again');
      invalidate();
    } finally {
      setConnectingChannel(null);
    }
  };

  const handleConnectInstagram = () => {
    const cfg = configQuery.data;
    if (!cfg?.metaAppId || !cfg.metaGraphVersion) {
      toast.error('Instagram is not configured on this server yet');
      return;
    }
    window.location.href = buildInstagramAuthUrl(cfg.metaAppId, cfg.metaGraphVersion, instagramRedirectUri());
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
          {whatsapp?.status === 'CONNECTED' && <WhatsAppBusinessProfileCard />}
        </div>
      )}
    </div>
  );
}
