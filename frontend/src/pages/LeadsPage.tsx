import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowDown,
  CalendarCheck2,
  ArrowUp,
  ArrowUpDown,
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Contact2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone as PhoneIcon,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
  X,
  MessageSquareText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Lead, LeadSource, LeadStats, LeadStatus, Paginated, User } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadActivityBoard } from '@/components/leads/LeadActivityBoard';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  QUICK_FILTERS,
  leadSourceStyle,
  leadStatusStyle,
  leadTemperature,
} from '@/lib/leadMeta';
import {
  formatCurrency,
  formatSmartTime,
  formatTravelDate,
  initials,
  shortId,
} from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

const PAGE_SIZE = 10;
const ALL = 'ALL';
const UNASSIGNED = 'unassigned';

// Arrow/chevron chip shape (pointed right edge, notched left edge) — the
// pipeline-stage look from the reference dashboard.
const ARROW_CLIP =
  '[clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%,8px_50%)]';

/* ---------------------------------- Bits ---------------------------------- */

function StatTile({ label, value, loading, className }: { label: string; value: number; loading: boolean; className?: string }) {
  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
          {value.toLocaleString()}
        </p>
      )}
    </Card>
  );
}

/** Horizontal pipeline of arrow-shaped stage chips with scroll buttons. */
function StageArrowBar({
  statuses,
  onToggle,
}: {
  statuses: LeadStatus[];
  onToggle: (status: LeadStatus) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) =>
    scrollRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });

  return (
    <div className="mb-3 flex items-center gap-1">
      <button
        type="button"
        aria-label="Scroll stages left"
        onClick={() => scroll(-1)}
        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted md:flex"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div
        ref={scrollRef}
        className="flex flex-1 items-center overflow-x-auto pb-1 pl-1 scrollbar-thin -space-x-1"
        role="group"
        aria-label="Filter by pipeline stage"
      >
        {LEAD_STATUSES.map((s) => {
          const st = leadStatusStyle(s.value);
          const active = statuses.includes(s.value);
          const anySelected = statuses.length > 0;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(s.value)}
              className={cn(
                'shrink-0 whitespace-nowrap px-5 py-1.5 text-xs font-semibold transition-all duration-150',
                ARROW_CLIP,
                st.solid,
                anySelected && !active && 'opacity-35 saturate-50 hover:opacity-70',
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Scroll stages right"
        onClick={() => scroll(1)}
        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted md:flex"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/** All / Hot / Warm / Cold / Won / Lost quick pills. */
function QuickPills({
  statuses,
  onPick,
}: {
  statuses: LeadStatus[];
  onPick: (statuses: LeadStatus[]) => void;
}) {
  const isGroup = (group: LeadStatus[]) =>
    statuses.length === group.length && group.every((g) => statuses.includes(g));
  const pill = (active: boolean) =>
    cn(
      'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
      active
        ? 'bg-foreground text-background'
        : 'border border-border bg-card text-muted-foreground hover:bg-muted',
    );
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      <button type="button" className={pill(statuses.length === 0)} onClick={() => onPick([])}>
        All
      </button>
      {QUICK_FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          className={pill(isGroup(f.statuses))}
          onClick={() => onPick(isGroup(f.statuses) ? [] : f.statuses)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function SourceBadge({ source }: { source: LeadSource }) {
  const s = leadSourceStyle(source);
  const Icon = s.Icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        s.badge,
      )}
    >
      <Icon className="size-3" />
      {s.label}
    </span>
  );
}

function TemperaturePill({ lead }: { lead: Lead }) {
  const temp = leadTemperature(lead);
  if (!temp) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none ring-1 ring-inset',
        temp.pill,
      )}
    >
      {temp.label}
    </span>
  );
}

/** Inline status changer: solid colored pill + dropdown of all stages. */
function StatusDropdown({
  lead,
  onChange,
  disabled,
}: {
  lead: Lead;
  onChange: (status: LeadStatus) => void;
  disabled?: boolean;
}) {
  const st = leadStatusStyle(lead.status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60',
            st.solid,
          )}
          aria-label={`Change status for ${lead.name}`}
        >
          {st.label}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
        {LEAD_STATUSES.map((s) => {
          const style = leadStatusStyle(s.value);
          return (
            <DropdownMenuItem
              key={s.value}
              onSelect={() => s.value !== lead.status && onChange(s.value)}
            >
              <span className={cn('size-2 rounded-full', style.dot)} />
              {s.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Inline assignee changer: avatar + name + dropdown of team members. */
function AssigneeDropdown({
  lead,
  users,
  onChange,
  disabled,
}: {
  lead: Lead;
  users: User[];
  onChange: (userId: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted disabled:opacity-60"
          aria-label={`Change assignee for ${lead.name}`}
        >
          {lead.assignedTo ? (
            <>
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{initials(lead.assignedTo.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-foreground">{lead.assignedTo.name}</span>
            </>
          ) : (
            <>
              <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40">
                <UserRound className="size-3.5 text-muted-foreground" />
              </span>
              <span className="text-sm italic text-muted-foreground">Unassigned</span>
            </>
          )}
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Assign to</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => lead.assignedToId && onChange(null)}>
          <span className="flex size-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40">
            <UserRound className="size-3" />
          </span>
          Unassigned
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {users.map((u) => (
          <DropdownMenuItem key={u.id} onSelect={() => u.id !== lead.assignedToId && onChange(u.id)}>
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px]">{initials(u.name)}</AvatarFallback>
            </Avatar>
            {u.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Dark per-row Actions button (reference style) with Convert / Edit / Delete. */
function RowActions({
  onEdit,
  onDelete,
  onConvert,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-8 bg-foreground px-3 text-xs text-background hover:bg-foreground/85"
        >
          Actions <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onConvert}>
          <CalendarCheck2 /> Convert to booking
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LeadIdentityCell({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="truncate text-left text-sm font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {lead.name}
        </button>
        <TemperaturePill lead={lead} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <SourceBadge source={lead.source} />
        <span className="text-[11px] text-muted-foreground">ID: {shortId(lead.id)}</span>
      </div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock3 className="size-3" /> {formatSmartTime(lead.createdAt)}
      </p>
    </div>
  );
}

function EnquiryCell({ lead }: { lead: Lead }) {
  const phoneDigits = lead.phone?.replace(/\D/g, '') ?? '';
  return (
    <div className="min-w-0 space-y-1.5">
      {lead.phone ? (
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <span className="truncate">{lead.phone}</span>
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`WhatsApp ${lead.name}`}
              className="flex size-5 items-center justify-center rounded-full bg-green-100 text-green-700 transition-colors hover:bg-green-200"
            >
              <MessageCircle className="size-3" />
            </a>
          )}
          <a
            href={`tel:${lead.phone}`}
            aria-label={`Call ${lead.name}`}
            className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-border"
          >
            <PhoneIcon className="size-3" />
          </a>
        </div>
      ) : lead.email ? (
        <a
          href={`mailto:${lead.email}`}
          className="flex items-center gap-1.5 text-sm text-foreground hover:underline"
        >
          <Mail className="size-3.5 text-muted-foreground" />
          <span className="truncate">{lead.email}</span>
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">No contact</p>
      )}

      {lead.destination && (
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <MapPin className="size-4" />
          </span>
          <span className="truncate text-sm font-medium text-foreground">{lead.destination}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {lead.travelerCount != null && (
          <span className="flex items-center gap-1">
            <UsersRound className="size-3" /> {lead.travelerCount} Pax
          </span>
        )}
        {lead.travelDate && (
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3" /> {formatTravelDate(lead.travelDate)}
          </span>
        )}
        {lead.budgetAmount != null && (
          <span className="flex items-center gap-1">
            <Wallet className="size-3" /> {formatCurrency(lead.budgetAmount, lead.budgetCurrency ?? 'USD')}
          </span>
        )}
      </div>
    </div>
  );
}

function RemarkCell({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  return (
    <div className="min-w-0 max-w-[220px] space-y-1.5">
      {lead.notes && (
        <div className="flex items-start gap-1.5">
          <BellRing className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <p className="line-clamp-2 text-xs text-foreground">{lead.notes}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="size-3" /> {lead.notes ? 'Edit remark' : 'Add Remark'}
      </button>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export function LeadsPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [source, setSource] = useState<string>(ALL);
  const [assignee, setAssignee] = useState<string>(ALL);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<'createdAt' | 'name'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [boardLead, setBoardLead] = useState<Lead | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setPage(1);
  }, [search, statuses, source, assignee]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statuses.length > 0) params.set('status', statuses.join(','));
    if (source !== ALL) params.set('source', source);
    if (assignee !== ALL) params.set('assignedToId', assignee);
    params.set('sort', sort);
    params.set('order', order);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    return params.toString();
  }, [search, statuses, source, assignee, sort, order, page]);

  // Selection only makes sense within the current result set.
  useEffect(() => {
    setSelected(new Set());
  }, [queryString]);

  const leadsQuery = useQuery({
    queryKey: ['leads', queryString],
    queryFn: () => api.get<Paginated<Lead>>(`/leads?${queryString}`),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['lead-stats'],
    queryFn: () => api.get<LeadStats>('/leads/stats'),
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
  });
  const users = usersQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Lead, 'status' | 'assignedToId'>> }) =>
      api.patch<Lead>(`/leads/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast.success('Lead updated');
    },
    onError: () => toast.error('Could not update this lead'),
  });

  const convertMutation = useMutation({
    mutationFn: (leadId: string) => api.post<{ id: string }>(`/bookings/from-lead/${leadId}`, {}),
    onSuccess: (booking) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
      toast.success('Booking created from lead');
      setConvertingLead(null);
      navigate(`/bookings/${booking.id}`);
    },
    onError: () => toast.error('Could not convert this lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Lead deleted');
      setDeletingLead(null);
    },
    onError: () => toast.error('Could not delete this lead'),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: Record<string, unknown> }) =>
      Promise.all(ids.map((id) => api.patch(`/leads/${id}`, data))),
    onSuccess: (_res, vars) => {
      invalidate();
      setSelected(new Set());
      toast.success(`${vars.ids.length} lead${vars.ids.length > 1 ? 's' : ''} updated`);
    },
    onError: () => {
      invalidate();
      toast.error('Some leads could not be updated');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.delete(`/leads/${id}`))),
    onSuccess: (_res, ids) => {
      invalidate();
      setSelected(new Set());
      toast.success(`${ids.length} lead${ids.length > 1 ? 's' : ''} deleted`);
    },
    onError: () => {
      invalidate();
      toast.error('Some leads could not be deleted');
    },
  });

  const data = leadsQuery.data;
  const leads = data?.items ?? [];
  const stats = statsQuery.data;
  const hasActiveFilters =
    Boolean(search) || statuses.length > 0 || source !== ALL || assignee !== ALL;
  const secondaryFiltersActive = source !== ALL || assignee !== ALL;
  const busy = updateMutation.isPending || bulkUpdateMutation.isPending || bulkDeleteMutation.isPending;

  const openCreate = () => {
    setEditingLead(null);
    setFormOpen(true);
  };
  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormOpen(true);
  };

  const clearFilters = () => {
    setSearchInput('');
    setStatuses([]);
    setSource(ALL);
    setAssignee(ALL);
  };

  const toggleStage = (status: LeadStatus) =>
    setStatuses((prev) => (prev.length === 1 && prev[0] === status ? [] : [status]));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = selected.size > 0 && !allSelected;
    }
  }, [selected, allSelected]);

  const cycleSort = () => {
    if (sort !== 'name') {
      setSort('name');
      setOrder('asc');
    } else if (order === 'asc') {
      setOrder('desc');
    } else {
      setSort('createdAt');
      setOrder('desc');
    }
  };
  const SortIcon = sort !== 'name' ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;

  const selectedIds = [...selected];

  const rowCells = (lead: Lead): ReactNode => (
    <>
      <td className="px-3 py-4">
        <EnquiryCell lead={lead} />
      </td>
      <td className="px-3 py-4">
        <RemarkCell lead={lead} onEdit={() => openEdit(lead)} />
      </td>
      <td className="px-3 py-4">
        <StatusDropdown
          lead={lead}
          disabled={busy}
          onChange={(status) => updateMutation.mutate({ id: lead.id, data: { status } })}
        />
      </td>
      <td className="px-3 py-4">
        <AssigneeDropdown
          lead={lead}
          users={users}
          disabled={busy}
          onChange={(assignedToId) => updateMutation.mutate({ id: lead.id, data: { assignedToId } })}
        />
      </td>
      <td className="px-3 py-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" className="h-8 px-3 text-xs" onClick={() => setBoardLead(lead)}>
            <MessageSquareText className="size-3.5" /> Follow up
          </Button>
          <RowActions onEdit={() => openEdit(lead)} onDelete={() => setDeletingLead(lead)} onConvert={() => setConvertingLead(lead)} />
        </div>
      </td>
    </>
  );

  return (
    <div>
      <PageHeader title="Leads" description="Track and manage every enquiry in one place.">
        <Button onClick={openCreate}>
          <Plus /> New lead
        </Button>
      </PageHeader>

      {/* Stat tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Overall leads captured"
          value={stats?.total ?? 0}
          loading={statsQuery.isLoading}
          className="col-span-2 sm:col-span-1"
        />
        <StatTile label="Today's leads" value={stats?.newToday ?? 0} loading={statsQuery.isLoading} />
        <StatTile label="Leads converted" value={stats?.won ?? 0} loading={statsQuery.isLoading} />
      </div>

      {/* Search + filters toggle */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, phone, destination…"
            className="pl-9"
            aria-label="Search leads"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setFiltersOpen((o) => !o)}
          className="relative shrink-0"
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal /> Filters
          {secondaryFiltersActive && (
            <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary" />
          )}
        </Button>
      </div>

      {/* Collapsible secondary filters */}
      {filtersOpen && (
        <div className="mb-3 grid animate-slide-up grid-cols-2 gap-3 sm:flex">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everyone</SelectItem>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {secondaryFiltersActive && (
            <Button
              variant="ghost"
              onClick={() => {
                setSource(ALL);
                setAssignee(ALL);
              }}
              className="col-span-2 sm:col-span-1"
            >
              <X /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Pipeline stage arrows */}
      <StageArrowBar statuses={statuses} onToggle={toggleStage} />

      {/* Quick pills + result count + refresh */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <QuickPills statuses={statuses} onPick={setStatuses} />
        <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
          <span>
            Showing {leads.length} lead{leads.length === 1 ? '' : 's'} out of {data?.total ?? 0}
          </span>
          <button
            type="button"
            aria-label="Refresh leads"
            onClick={() => leadsQuery.refetch()}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <RefreshCw className={cn('size-3.5', leadsQuery.isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card className="mb-3 flex animate-slide-up flex-wrap items-center gap-2 border-primary/30 bg-primary/5 p-2.5">
          <span className="px-1.5 text-sm font-medium text-foreground">{selected.size} selected</span>
          <Select value="" onValueChange={(v) => bulkUpdateMutation.mutate({ ids: selectedIds, data: { status: v } })}>
            <SelectTrigger className="h-9 w-40" aria-label="Set status for selected">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value=""
            onValueChange={(v) =>
              bulkUpdateMutation.mutate({ ids: selectedIds, data: { assignedToId: v === UNASSIGNED ? null : v } })
            }
          >
            <SelectTrigger className="h-9 w-40" aria-label="Assign selected to">
              <SelectValue placeholder="Assign to…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={busy}
            onClick={() => bulkDeleteMutation.mutate(selectedIds)}
          >
            <Trash2 /> Delete
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
            <X />
          </Button>
        </Card>
      )}

      {/* Content */}
      {leadsQuery.isLoading ? (
        <LeadsSkeleton />
      ) : leads.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={<SearchX />}
            title="No leads match your filters"
            description="Try adjusting or clearing your search and filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Contact2 />}
            title="No leads yet"
            description="Add your first enquiry to start building your pipeline."
            action={
              <Button onClick={openCreate}>
                <Plus /> Add a lead
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-10 px-3 py-3">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        aria-label="Select all leads on this page"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="size-4 cursor-pointer rounded border-input accent-primary"
                      />
                    </th>
                    <th className="w-12 px-2 py-3 font-medium">S.No.</th>
                    <th className="px-3 py-3 font-medium">
                      <button
                        type="button"
                        onClick={cycleSort}
                        className="flex items-center gap-1 hover:text-foreground"
                        aria-label="Sort by name"
                      >
                        Lead Details <SortIcon className="size-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium">Enquiry Details</th>
                    <th className="px-3 py-3 font-medium">Remarks</th>
                    <th className="px-3 py-3 font-medium">Quick Actions</th>
                    <th className="px-3 py-3 font-medium">Assigned To</th>
                    <th className="px-3 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((lead, i) => {
                    const temp = leadTemperature(lead);
                    return (
                      <tr
                        key={lead.id}
                        className={cn(
                          'align-top transition-colors',
                          temp
                            ? cn('bg-gradient-to-r to-transparent', temp.key === 'HOT' ? 'from-amber-100/70 via-amber-50/40' : 'from-sky-100/60 via-sky-50/30')
                            : 'hover:bg-muted/50',
                          selected.has(lead.id) && 'bg-primary/5',
                        )}
                      >
                        <td className={cn('px-3 py-4', temp?.accentCell)}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${lead.name}`}
                            checked={selected.has(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                            className="size-4 cursor-pointer rounded border-input accent-primary"
                          />
                        </td>
                        <td className="px-2 py-4 text-muted-foreground">
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-3 py-4">
                          <LeadIdentityCell lead={lead} onEdit={() => openEdit(lead)} />
                        </td>
                        {rowCells(lead)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {leads.map((lead) => {
              const temp = leadTemperature(lead);
              return (
                <Card key={lead.id} className={cn('p-4', temp?.cardClass)}>
                  <div className="flex items-start justify-between gap-3">
                    <LeadIdentityCell lead={lead} onEdit={() => openEdit(lead)} />
                    <RowActions onEdit={() => openEdit(lead)} onDelete={() => setDeletingLead(lead)} onConvert={() => setConvertingLead(lead)} />
                  </div>
                  <div className="mt-3">
                    <EnquiryCell lead={lead} />
                  </div>
                  {lead.notes && (
                    <div className="mt-2 flex items-start gap-1.5">
                      <BellRing className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                      <p className="line-clamp-2 text-xs text-foreground">{lead.notes}</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <StatusDropdown
                      lead={lead}
                      disabled={busy}
                      onChange={(status) => updateMutation.mutate({ id: lead.id, data: { status } })}
                    />
                    <AssigneeDropdown
                      lead={lead}
                      users={users}
                      disabled={busy}
                      onChange={(assignedToId) =>
                        updateMutation.mutate({ id: lead.id, data: { assignedToId } })
                      }
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {data && (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                Showing {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1 || leadsQuery.isFetching}
                >
                  <ChevronLeft /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={data.page >= data.totalPages || leadsQuery.isFetching}
                >
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editingLead} users={users} />

      <LeadActivityBoard lead={boardLead} open={!!boardLead} onOpenChange={(o) => !o && setBoardLead(null)} />

      <ConfirmDialog
        open={!!deletingLead}
        onOpenChange={(open) => !open && setDeletingLead(null)}
        title="Delete lead?"
        description={
          deletingLead ? (
            <>
              This permanently removes <span className="font-medium text-foreground">{deletingLead.name}</span>{' '}
              from your pipeline. This can't be undone.
            </>
          ) : undefined
        }
        confirmLabel="Delete lead"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deletingLead && deleteMutation.mutate(deletingLead.id)}
      />

      <ConfirmDialog
        open={!!convertingLead}
        onOpenChange={(open) => !open && setConvertingLead(null)}
        title="Convert to booking?"
        description={
          convertingLead ? (
            <>
              A booking will be created for{' '}
              <span className="font-medium text-foreground">{convertingLead.name}</span> with this
              lead's details, and the lead will be marked <span className="font-medium text-foreground">Won</span>.
            </>
          ) : undefined
        }
        confirmLabel="Create booking"
        loading={convertMutation.isPending}
        onConfirm={() => convertingLead && convertMutation.mutate(convertingLead.id)}
      />
    </div>
  );
}

function LeadsSkeleton() {
  return (
    <Card className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="hidden h-7 w-24 rounded-md sm:block" />
          <Skeleton className="hidden h-7 w-20 rounded-md sm:block" />
        </div>
      ))}
    </Card>
  );
}
