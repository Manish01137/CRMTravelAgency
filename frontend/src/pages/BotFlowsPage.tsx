import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { ArrowLeft, FileText, Instagram, Megaphone, MessageCircle, Plus, Sparkles, Trash2, Workflow } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AdPackageLink, BotFlow, BotFlowAssignment, BotFlowTemplate, ChannelStatus, TravelPackage } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormValues {
  name: string;
}

/** Two ways in: pick a ready-made starter (one click, pre-built steps) or start from a blank canvas. */
function NewFlowDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'choose' | 'blank'>('choose');
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({ defaultValues: { name: '' } });

  const templatesQuery = useQuery({
    queryKey: ['bot-flow-templates'],
    queryFn: () => api.get<BotFlowTemplate[]>('/bot-flows/templates'),
    enabled: open,
  });

  const goToFlow = (flow: BotFlow) => {
    queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
    setMode('choose');
    reset();
    onOpenChange(false);
    navigate(`/bot-flows/${flow.id}`);
  };

  const blankMutation = useMutation({
    mutationFn: (v: FormValues) => api.post<BotFlow>('/bot-flows', { name: v.name.trim() }),
    onSuccess: (flow) => {
      toast.success('Flow created');
      goToFlow(flow);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create flow'),
  });

  const templateMutation = useMutation({
    mutationFn: (templateKey: string) => api.post<BotFlow>('/bot-flows/from-template', { templateKey }),
    onSuccess: (flow) => {
      toast.success('Flow created from template');
      goToFlow(flow);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not create flow'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setMode('choose'); }}>
      <DialogContent className="sm:max-w-lg">
        {mode === 'choose' ? (
          <>
            <DialogHeader>
              <DialogTitle>New Bot Flow</DialogTitle>
              <DialogDescription>Start from a ready-made flow, or build from a blank canvas.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {templatesQuery.isLoading ? (
                <>
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </>
              ) : (
                (templatesQuery.data ?? []).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    disabled={templateMutation.isPending}
                    onClick={() => templateMutation.mutate(t.key)}
                    className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.description}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{t.stepCount} steps, ready to use</span>
                    </span>
                  </button>
                ))
              )}
              <button
                type="button"
                onClick={() => setMode('blank')}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">Blank flow</span>
                  <span className="block text-xs text-muted-foreground">Start from an empty canvas and build it yourself.</span>
                </span>
              </button>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setMode('choose')} aria-label="Back">
                  <ArrowLeft className="size-4" />
                </Button>
                Blank flow
              </DialogTitle>
              <DialogDescription>Give it a name, then build the conversation in the canvas.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit((v) => blankMutation.mutate(v))} className="space-y-4" noValidate>
              <Field label="Flow name" htmlFor="flowName" error={errors.name?.message} required>
                <Input id="flowName" placeholder="e.g. Kashmir Enquiry Bot" {...register('name', { required: 'Name is required' })} />
              </Field>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={blankMutation.isPending}>
                  {blankMutation.isPending && <Spinner className="size-4" />} Create & open builder
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignmentsCard() {
  const queryClient = useQueryClient();
  const channelsQuery = useQuery({ queryKey: ['channels'], queryFn: () => api.get<ChannelStatus[]>('/channels') });
  const flowsQuery = useQuery({ queryKey: ['bot-flows'], queryFn: () => api.get<BotFlow[]>('/bot-flows') });
  const assignmentsQuery = useQuery({ queryKey: ['bot-flow-assignments'], queryFn: () => api.get<BotFlowAssignment[]>('/bot-flows/assignments/all') });

  const channels = (channelsQuery.data ?? []).filter((c) => c.channel === 'WHATSAPP' || c.channel === 'INSTAGRAM');
  const flows = flowsQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  const assignMutation = useMutation({
    mutationFn: (v: { channel: string; flowId: string }) => api.post('/bot-flows/assignments', v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow-assignments'] });
      toast.success('Flow assigned');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not assign flow'),
  });
  const unassignMutation = useMutation({
    mutationFn: (channel: string) => api.delete(`/bot-flows/assignments/${channel}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flow-assignments'] });
      toast.success('Flow unassigned');
    },
  });

  if (channelsQuery.isLoading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Live on each channel</CardTitle>
        <CardDescription>Pick which flow runs automatically on each connected WhatsApp number / Instagram handle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Connect WhatsApp or Instagram in Settings → Channels first.</p>
        ) : (
          channels.map((c) => {
            const current = assignments.find((a) => a.channel === c.channel);
            return (
              <div key={c.channel} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  {c.channel === 'WHATSAPP' ? <MessageCircle className="size-4 text-emerald-600" /> : <Instagram className="size-4 text-pink-600" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'}</p>
                    <p className="text-xs text-muted-foreground">{c.displayName ?? (c.status === 'CONNECTED' ? 'Connected' : 'Not connected')}</p>
                  </div>
                </div>
                {c.status !== 'CONNECTED' ? (
                  <Badge variant="muted">Not connected</Badge>
                ) : (
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <Select
                      value={current?.flowId ?? '__none'}
                      onValueChange={(v) => {
                        if (v === '__none') {
                          if (current) unassignMutation.mutate(c.channel);
                          return;
                        }
                        assignMutation.mutate({ channel: c.channel, flowId: v });
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="No flow assigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No flow assigned</SelectItem>
                        {flows.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

const MAX_PACKAGES_PER_AD = 5;

/** Checkbox list of the org's packages — pick up to MAX_PACKAGES_PER_AD, in the order shown. */
function PackageChecklist({
  id,
  packages,
  loading,
  selected,
  onChange,
}: {
  id: string;
  packages: TravelPackage[];
  loading: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const full = selected.length >= MAX_PACKAGES_PER_AD;
  return (
    <div id={id} className="max-h-52 w-full min-w-0 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
      {loading ? (
        <p className="p-2 text-sm text-muted-foreground">Loading packages…</p>
      ) : packages.length === 0 ? (
        <p className="p-2 text-sm text-muted-foreground">No packages yet — create one in Packages first.</p>
      ) : (
        packages.map((p) => {
          const checked = selected.includes(p.id);
          return (
            <label
              key={p.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                !checked && full ? 'opacity-50' : 'cursor-pointer hover:bg-muted/60',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && full}
                onChange={(e) => onChange(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
              />
              <span className="min-w-0 flex-1 truncate">
                {p.name} <span className="text-muted-foreground">— {p.destination}</span>
              </span>
              {!p.isActive && <Badge variant="muted">Inactive</Badge>}
            </label>
          );
        })
      )}
    </div>
  );
}

/** Edit which packages one already-linked ad sends. */
function EditAdPackagesDialog({
  ad,
  packages,
  loading,
  onOpenChange,
}: {
  ad: AdPackageLink | null;
  packages: TravelPackage[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [lastAdId, setLastAdId] = useState<string | null>(null);
  if (ad && ad.adId !== lastAdId) {
    setLastAdId(ad.adId);
    setSelected(ad.packages.map((p) => p.id));
  }

  const saveMutation = useMutation({
    mutationFn: () => api.put<AdPackageLink>(`/ad-package-mappings/${ad!.adId}`, { packageIds: selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-package-mappings'] });
      toast.success('Ad updated');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update the ad'),
  });

  return (
    <Dialog
      open={!!ad}
      onOpenChange={(open) => {
        if (!open) setLastAdId(null);
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Packages for ad {ad?.adId}</DialogTitle>
          <DialogDescription>
            Each ticked package is sent as its own message to anyone who messages from this ad.
          </DialogDescription>
        </DialogHeader>
        <Field className="min-w-0" label="Packages to send" htmlFor="editAdPackages" hint={`${selected.length}/${MAX_PACKAGES_PER_AD} selected`}>
          <PackageChecklist id="editAdPackages" packages={packages} loading={loading} selected={selected} onChange={setSelected} />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => saveMutation.mutate()} disabled={selected.length === 0 || saveMutation.isPending}>
            {saveMutation.isPending && <Spinner className="size-4" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ads → Packages. A traveller who messages from a linked Click-to-WhatsApp ad
 * is sent that ad's packages automatically as the first replies; if a flow is
 * live on WhatsApp it then carries on, skipping its destination question when
 * the packages share one.
 */
function AdPackagesCard() {
  const queryClient = useQueryClient();
  const [adId, setAdId] = useState('');
  const [packageIds, setPackageIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<AdPackageLink | null>(null);
  const [removing, setRemoving] = useState<AdPackageLink | null>(null);

  const adsQuery = useQuery({ queryKey: ['ad-package-mappings'], queryFn: () => api.get<AdPackageLink[]>('/ad-package-mappings') });
  const packagesQuery = useQuery({ queryKey: ['packages'], queryFn: () => api.get<TravelPackage[]>('/packages') });
  const ads = adsQuery.data ?? [];
  const packages = packagesQuery.data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ad-package-mappings'] });

  const createMutation = useMutation({
    mutationFn: () => api.post<AdPackageLink>('/ad-package-mappings', { adId: adId.trim(), packageIds }),
    onSuccess: () => {
      invalidate();
      setAdId('');
      setPackageIds([]);
      toast.success(packageIds.length > 1 ? 'Ad linked — its packages will now be sent automatically' : 'Ad linked — its package will now be sent automatically');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not link the ad'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ad-package-mappings/${id}`),
    onSuccess: () => {
      invalidate();
      setRemoving(null);
      toast.success('Ad unlinked');
    },
    onError: () => toast.error('Could not remove the link'),
  });

  const adIdValid = /^\d{6,30}$/.test(adId.trim());

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-5 text-primary" /> Ads → Packages
        </CardTitle>
        <CardDescription>
          Running Click-to-WhatsApp ads? Link each ad to the package(s) it promotes — anyone who messages from that ad is sent
          them straight away, no questions first. If a flow is live on WhatsApp it carries on after.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            className="min-w-0"
            label="Ad ID"
            htmlFor="adId"
            error={adId.trim() && !adIdValid ? 'Digits only — the long number from Meta Ads Manager.' : undefined}
            hint="Meta Ads Manager → your ad → Ad ID."
          >
            <Input id="adId" inputMode="numeric" value={adId} onChange={(e) => setAdId(e.target.value)} placeholder="Paste the Ad ID" />
          </Field>
          <Field
            className="min-w-0"
            label="Packages to send"
            htmlFor="adPackages"
            error={packagesQuery.isError ? 'Could not load your packages — refresh the page.' : undefined}
            hint={`Up to ${MAX_PACKAGES_PER_AD} — each is sent as its own message. ${packageIds.length}/${MAX_PACKAGES_PER_AD} selected.`}
          >
            <PackageChecklist id="adPackages" packages={packages} loading={packagesQuery.isLoading} selected={packageIds} onChange={setPackageIds} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button className="w-full sm:w-auto" onClick={() => createMutation.mutate()} disabled={!adIdValid || packageIds.length === 0 || createMutation.isPending}>
            {createMutation.isPending ? <Spinner className="size-4" /> : <Plus />} Link ad
          </Button>
        </div>

        {adsQuery.isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : ads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No ads linked yet. Messages from ads will go through your normal flow until you link one.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {ads.map((ad) => (
              <div key={ad.adId} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="sm:w-56 sm:shrink-0">
                  <p className="text-xs text-muted-foreground">Ad ID</p>
                  <p className="break-all font-mono text-sm text-foreground">{ad.adId}</p>
                </div>
                <ul className="min-w-0 flex-1 space-y-1">
                  {ad.packages.map((p) => (
                    <li key={p.id} className="break-words text-sm">
                      <span className="font-medium text-foreground">{p.name}</span>{' '}
                      <span className="text-muted-foreground">— {p.destination}</span>
                      {!p.isActive && (
                        <Badge variant="muted" className="ml-2 align-middle">
                          Inactive · still sent
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(ad)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Unlink ad ${ad.adId}`} onClick={() => setRemoving(ad)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <EditAdPackagesDialog ad={editing} packages={packages} loading={packagesQuery.isLoading} onOpenChange={(open) => !open && setEditing(null)} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Unlink ad ${removing?.adId ?? ''}?`}
        description="Messages from this ad will go through your normal flow instead of getting its packages automatically."
        confirmLabel="Unlink"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => removing && deleteMutation.mutate(removing.adId)}
      />
    </Card>
  );
}

export function BotFlowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [deleting, setDeleting] = useState<BotFlow | null>(null);

  const flowsQuery = useQuery({ queryKey: ['bot-flows'], queryFn: () => api.get<BotFlow[]>('/bot-flows') });
  const flows = flowsQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bot-flows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-flows'] });
      toast.success('Flow deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Could not delete flow'),
  });

  return (
    <div>
      <PageHeader title="Bot Flows" description="Visual conversation flows for WhatsApp and Instagram — collect info, confirm, and hand off cleanly.">
        <Button onClick={() => setNewOpen(true)}>
          <Plus /> New flow
        </Button>
      </PageHeader>

      <AssignmentsCard />
      <AdPackagesCard />

      {flowsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : flows.length === 0 ? (
        <EmptyState
          icon={<Workflow />}
          title="No flows yet"
          description="Create a flow, then assign it to a connected WhatsApp number or Instagram handle."
          action={<Button onClick={() => setNewOpen(true)}><Plus /> New flow</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((f) => (
            <Card key={f.id} className="cursor-pointer transition-shadow hover:shadow-pop" onClick={() => navigate(`/bot-flows/${f.id}`)}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{f.name}</CardTitle>
                  <Badge variant={f.isActive ? 'success' : 'muted'}>{f.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <CardDescription>{f._count?.steps ?? 0} steps · {f._count?.assignments ?? 0} channel{(f._count?.assignments ?? 0) === 1 ? '' : 's'}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn('text-muted-foreground hover:text-destructive')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(f);
                  }}
                  aria-label="Delete flow"
                >
                  <Trash2 />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewFlowDialog open={newOpen} onOpenChange={setNewOpen} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this flow?"
        description={`"${deleting?.name}" and all its steps will be permanently removed. Any channel it's assigned to will stop running it.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
