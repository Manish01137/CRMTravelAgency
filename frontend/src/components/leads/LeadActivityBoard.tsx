import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Eye,
  History,
  ListChecks,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Route as RouteIcon,
  Search,
  Send,
  Trash2,
  UserRound,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  Booking,
  Lead,
  LeadActivity,
  LeadActivityType,
  LeadStatus,
  Paginated,
  Task,
  TravelPackage,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_STATUSES, leadSourceLabel, leadStatusStyle } from '@/lib/leadMeta';
import { formatCurrency, formatDate, formatSmartTime, fromNow } from '@/lib/format';

type BoardTab = 'interaction' | 'history' | 'tasks' | 'itineraries' | 'packages' | 'whatsapp';

const TABS: { key: BoardTab; label: string; icon: typeof History }[] = [
  { key: 'interaction', label: 'Interaction', icon: ClipboardList },
  { key: 'history', label: 'History', icon: History },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'itineraries', label: 'Itineraries', icon: RouteIcon },
  { key: 'packages', label: 'Packages', icon: MapPin },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

const OUTCOMES = ['Answered', 'Call not picked', 'Busy — call later', 'Switched off', 'Wrong number', 'No response'];

const ACTIVITY_TYPES: { value: LeadActivityType; label: string }[] = [
  { value: 'CALL', label: 'Call' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'NOTE', label: 'Note' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Meeting' },
];

/** wa.me needs digits only; assume the stored number includes a country code. */
function waNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

function openWhatsApp(phone: string, text: string) {
  window.open(`https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`, '_blank');
}

function packageMessage(pkg: TravelPackage): string {
  const lines = [
    `*${pkg.name}* — ${pkg.destination}`,
    `${pkg.days}D / ${pkg.nights}N · ${formatCurrency(pkg.priceAmount, pkg.priceCurrency)}${
      pkg.originalPrice ? ` (was ${formatCurrency(pkg.originalPrice, pkg.priceCurrency)})` : ''
    }`,
  ];
  if (pkg.highlights.length) lines.push('', 'Highlights:', ...pkg.highlights.slice(0, 5).map((h) => `• ${h}`));
  if (pkg.whatsappDescription) lines.push('', pkg.whatsappDescription);
  if (pkg.contactNumber) lines.push('', `Call us: ${pkg.contactNumber}`);
  return lines.join('\n');
}

// LOST isn't part of the forward pipeline — it stays on the leads table dropdown.
const PIPELINE_STAGES = LEAD_STATUSES.filter((s) => s.value !== 'LOST');

/** Chevron pipeline (reference style) — click a stage to move the lead there. */
function PipelineProgression({ lead, disabled, onMove }: { lead: Lead; disabled: boolean; onMove: (s: LeadStatus) => void }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pipeline progression</p>
      <div className="mt-3 flex overflow-x-auto pb-1 scrollbar-thin">
        {PIPELINE_STAGES.map((s, i) => {
          const active = lead.status === s.value;
          const st = leadStatusStyle(s.value as LeadStatus);
          return (
            <button
              key={s.value}
              type="button"
              disabled={disabled || active}
              onClick={() => onMove(s.value as LeadStatus)}
              title={active ? 'Current stage' : `Move to ${s.label}`}
              className={cn(
                'relative shrink-0 whitespace-nowrap px-5 py-2.5 text-xs font-semibold uppercase tracking-wide transition-all first:rounded-l-full last:rounded-r-full',
                i > 0 && '-ml-3',
                active ? 'z-10 bg-primary text-white shadow-pop' : cn('hover:brightness-95', st.pill),
              )}
              style={{
                clipPath:
                  i === 0
                    ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                    : i === PIPELINE_STAGES.length - 1
                      ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)'
                      : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function InteractionTab({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<LeadActivityType>('CALL');
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [message, setMessage] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['lead-activities', lead.id] });
    queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
  };

  const moveMutation = useMutation({
    mutationFn: (status: LeadStatus) => api.patch<Lead>(`/leads/${lead.id}`, { status }),
    onSuccess: () => {
      invalidate();
      toast.success('Stage updated');
    },
    onError: () => toast.error('Could not move this lead'),
  });

  const logMutation = useMutation({
    mutationFn: (moveNext: boolean) => {
      const idx = PIPELINE_STAGES.findIndex((s) => s.value === lead.status);
      const next = moveNext && idx >= 0 && idx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[idx + 1].value : undefined;
      return api.post<LeadActivity>(`/leads/${lead.id}/activities`, {
        type,
        outcome: type === 'CALL' ? outcome : undefined,
        message: message.trim() || undefined,
        moveTo: next,
      });
    },
    onSuccess: (_a, moveNext) => {
      invalidate();
      setMessage('');
      toast.success(moveNext ? 'Logged & moved to next stage' : 'Interaction logged');
    },
    onError: () => toast.error('Could not log this interaction'),
  });

  return (
    <div className="space-y-4">
      <PipelineProgression lead={lead} disabled={moveMutation.isPending} onMove={(s) => moveMutation.mutate(s)} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Log interaction</p>
            <div className="flex gap-2">
              <Select value={type} onValueChange={(v) => setType(v as LeadActivityType)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {type === 'CALL' && (
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTCOMES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Note interaction details…"
            className="mt-3"
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={logMutation.isPending || (!message.trim() && type !== 'CALL')}
              onClick={() => logMutation.mutate(false)}
            >
              Save log
            </Button>
            <Button size="sm" disabled={logMutation.isPending} onClick={() => logMutation.mutate(true)}>
              {logMutation.isPending ? <Spinner className="size-4" /> : <Send />} Save & progress
            </Button>
          </div>
        </Card>

        {/* Lead facts rail (reference style: purple card) */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-violet-600 p-5 text-white shadow-pop">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                <CalendarDays className="size-3.5" /> Captured
              </dt>
              <dd className="mt-0.5 font-semibold">{formatDate(lead.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Source</dt>
              <dd className="mt-0.5 font-semibold">{leadSourceLabel(lead.source)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                <UserRound className="size-3.5" /> Assigned to
              </dt>
              <dd className="mt-0.5 break-all font-semibold">{lead.assignedTo?.name ?? 'Unassigned'}</dd>
            </div>
            {lead.destination && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Destination</dt>
                <dd className="mt-0.5 font-semibold">{lead.destination}</dd>
              </div>
            )}
            {lead.budgetAmount != null && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Budget</dt>
                <dd className="mt-0.5 font-semibold">{formatCurrency(lead.budgetAmount, lead.budgetCurrency ?? 'INR')}</dd>
              </div>
            )}
            {lead.phone && (
              <div className="flex gap-2 pt-1">
                <Button asChild size="sm" className="flex-1 bg-white/15 text-white hover:bg-white/25">
                  <a href={`tel:${lead.phone}`}>
                    <Phone /> Call
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600"
                  onClick={() => openWhatsApp(lead.phone!, `Hi ${lead.name.split(' ')[0]}, `)}
                >
                  <MessageCircle /> WhatsApp
                </Button>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ lead }: { lead: Lead }) {
  const activitiesQuery = useQuery({
    queryKey: ['lead-activities', lead.id],
    queryFn: () => api.get<LeadActivity[]>(`/leads/${lead.id}/activities`),
  });
  const items = activitiesQuery.data ?? [];

  if (activitiesQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No history yet — log a call or move the lead through the pipeline and it will show up here.
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-border p-0">
      {items.map((a) => {
        const isMove = a.type === 'STATUS_CHANGE' || (a.fromStatus && a.toStatus);
        return (
          <div key={a.id} className="flex items-start gap-3 p-4">
            <span
              className={cn(
                'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4',
                isMove ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {isMove ? <ArrowRight /> : a.type === 'CALL' ? <Phone /> : a.type === 'WHATSAPP' ? <MessageCircle /> : <ClipboardList />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                {isMove && a.fromStatus && a.toStatus ? (
                  <>
                    Moved <b>{leadStatusStyle(a.fromStatus).label}</b> → <b>{leadStatusStyle(a.toStatus).label}</b>
                  </>
                ) : (
                  <b>{ACTIVITY_TYPES.find((t) => t.value === a.type)?.label ?? a.type}</b>
                )}
                {a.outcome ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{a.outcome}</span> : null}
              </p>
              {a.message && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.message}</p>}
              <p className="mt-1 text-xs text-muted-foreground/70">
                {a.createdBy?.name ?? 'System'} · {fromNow(a.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function TasksTab({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  const tasksQuery = useQuery({
    queryKey: ['tasks', { leadId: lead.id }],
    queryFn: () => api.get<Task[]>(`/tasks?leadId=${lead.id}`),
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Task>('/tasks', {
        title: title.trim(),
        type: 'FOLLOW_UP',
        dueAt: new Date(`${dueDate}T10:00`).toISOString(),
        leadId: lead.id,
      }),
    onSuccess: () => {
      invalidate();
      setTitle('');
      setDueDate('');
      toast.success('Task added');
    },
    onError: () => toast.error('Could not add this task'),
  });
  const toggleMutation = useMutation({
    mutationFn: (t: Task) => api.patch<Task>(`/tasks/${t.id}`, { status: t.status === 'DONE' ? 'PENDING' : 'DONE' }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: invalidate,
  });

  const items = tasksQuery.data ?? [];
  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Create lead task</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task name…" className="flex-1" />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="sm:w-44" />
          <Button disabled={!title.trim() || !dueDate || createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Plus /> Add task
          </Button>
        </div>
      </Card>

      {tasksQuery.isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No tasks found for this lead yet.</Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {items.map((t) => {
            const done = t.status === 'DONE';
            return (
              <div key={t.id} className="flex items-center gap-3 p-3.5">
                <button
                  type="button"
                  aria-label={done ? 'Mark pending' : 'Mark done'}
                  onClick={() => toggleMutation.mutate(t)}
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors [&_svg]:size-3',
                    done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border hover:border-primary',
                  )}
                >
                  {done && <Check />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm', done ? 'text-muted-foreground line-through' : 'text-foreground')}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">{formatSmartTime(t.dueAt)}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Delete task" onClick={() => deleteMutation.mutate(t.id)}>
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function ItinerariesTab({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const navigate = useNavigate();
  const bookingsQuery = useQuery({
    queryKey: ['bookings', { leadId: lead.id }],
    queryFn: () => api.get<Paginated<Booking>>(`/bookings?leadId=${lead.id}&pageSize=50`),
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () => api.post<Booking>(`/bookings/from-lead/${lead.id}`, {}),
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
      navigate(`/bookings/${b.id}/itinerary`);
    },
    onError: () => toast.error('Could not create an itinerary for this lead'),
  });

  const items = bookingsQuery.data?.items ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Itineraries for this lead</p>
        <Button size="sm" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? <Spinner className="size-4" /> : <Plus />} Create itinerary for this lead
        </Button>
      </div>
      {bookingsQuery.isLoading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No itineraries linked to this lead yet.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((b) => {
            const days = b.itineraryDays ?? 0;
            return (
              <Card key={b.id} className="p-4">
                <p className="truncate font-display text-sm font-bold text-foreground">{b.destination}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {days > 0 ? `${days}-day plan` : 'Not designed yet'}
                  {b.startDate ? ` · departs ${formatDate(b.startDate)}` : ''}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      onClose();
                      navigate(`/bookings/${b.id}/itinerary`);
                    }}
                  >
                    <Wand2 /> {days > 0 ? 'Edit' : 'Design'}
                  </Button>
                  {days > 0 && (
                    <Button variant="outline" size="sm" onClick={() => window.open(`/bookings/${b.id}/itinerary/print`, '_blank')}>
                      PDF
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PackagesTab({ lead }: { lead: Lead }) {
  const [search, setSearch] = useState('');
  const packagesQuery = useQuery({
    queryKey: ['packages'],
    queryFn: () => api.get<TravelPackage[]>('/packages'),
  });

  const items = useMemo(() => {
    const all = (packagesQuery.data ?? []).filter((p) => p.isActive);
    const q = search.trim().toLowerCase();
    return q ? all.filter((p) => p.name.toLowerCase().includes(q) || p.destination.toLowerCase().includes(q)) : all;
  }, [packagesQuery.data, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Organization packages</p>
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search packages…" className="h-9 pl-9" />
        </div>
      </div>
      {packagesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No packages yet — build one in the Packages tab.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((p) => (
            <Card key={p.id} className="overflow-hidden p-0">
              <div className="relative h-28 bg-gradient-to-br from-primary/15 to-violet-200/40">
                {p.bannerImageUrl && <img src={p.bannerImageUrl} alt="" className="h-full w-full object-cover" />}
                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {p.days}D / {p.nights}N
                </span>
              </div>
              <div className="p-3.5">
                <p className="truncate font-display text-sm font-bold text-foreground">{p.name}</p>
                <p className="mt-1 text-sm">
                  <span className="font-bold text-foreground">{formatCurrency(p.priceAmount, p.priceCurrency)}</span>
                  {p.originalPrice != null && (
                    <span className="ml-2 text-xs text-muted-foreground line-through">
                      {formatCurrency(p.originalPrice, p.priceCurrency)}
                    </span>
                  )}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {p.code || p.destination}
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      aria-label="View brochure"
                      onClick={() => window.open(`/packages/${p.id}/brochure`, '_blank')}
                    >
                      <Eye />
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-500 text-white hover:bg-emerald-600"
                      disabled={!lead.phone}
                      title={lead.phone ? 'Send on WhatsApp' : 'Lead has no phone number'}
                      onClick={() => lead.phone && openWhatsApp(lead.phone, packageMessage(p))}
                    >
                      <Send /> Send
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WhatsAppTab({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const logMutation = useMutation({
    mutationFn: (message: string) =>
      api.post<LeadActivity>(`/leads/${lead.id}/activities`, { type: 'WHATSAPP', message }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead-activities', lead.id] }),
  });

  if (!lead.phone) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        This lead has no phone number — add one (Edit lead) to start a WhatsApp conversation.
      </Card>
    );
  }

  const send = () => {
    const message = text.trim();
    if (!message) return;
    openWhatsApp(lead.phone!, message);
    logMutation.mutate(message);
    setText('');
  };

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3 bg-emerald-50/60 p-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white [&_svg]:size-5">
          <MessageCircle />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-foreground">{lead.name}</p>
          <p className="text-xs text-muted-foreground">{lead.phone}</p>
        </div>
        <Button
          size="sm"
          className="bg-emerald-500 text-white hover:bg-emerald-600"
          onClick={() => openWhatsApp(lead.phone!, '')}
        >
          Open chat
        </Button>
      </Card>

      <Card className="p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Send a message</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Type a message… it opens in WhatsApp pre-filled, and gets logged to this lead's history."
          className="mt-3"
        />
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={!text.trim()} onClick={send} className="bg-emerald-500 text-white hover:bg-emerald-600">
            <Send /> Send on WhatsApp
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Messages open in WhatsApp and are logged here. Live two-way chat sync arrives with the WhatsApp Business API
        connection (Phase 3).
      </p>
    </div>
  );
}

export function LeadActivityBoard({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<BoardTab>('interaction');
  const queryClient = useQueryClient();

  // Keep the board's lead fresh (stage moves from inside the board update the row behind it).
  const leadQuery = useQuery({
    queryKey: ['lead', lead?.id],
    queryFn: () => api.get<Lead>(`/leads/${lead!.id}`),
    enabled: open && !!lead,
    initialData: lead ?? undefined,
  });
  const current = leadQuery.data ?? lead;

  if (!current) return null;
  const close = () => onOpenChange(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setTab('interaction');
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Gradient header (reference style) */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 to-primary px-5 py-4 text-white">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 [&_svg]:size-5">
            <ClipboardList />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-lg font-bold text-white">Lead Activity Board</DialogTitle>
            <p className="truncate text-xs font-medium uppercase tracking-wide text-white/70">{current.name}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-muted/40 px-3 pt-2 scrollbar-thin">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors [&_svg]:size-3.5',
                tab === t.key
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                t.key === 'whatsapp' && tab === t.key && 'text-emerald-600',
              )}
            >
              <t.icon /> {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[calc(92vh-8.5rem)] overflow-y-auto p-4 sm:p-5">
          {tab === 'interaction' && <InteractionTab lead={current} />}
          {tab === 'history' && <HistoryTab lead={current} />}
          {tab === 'tasks' && <TasksTab lead={current} />}
          {tab === 'itineraries' && <ItinerariesTab lead={current} onClose={close} />}
          {tab === 'packages' && <PackagesTab lead={current} />}
          {tab === 'whatsapp' && <WhatsAppTab lead={current} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
