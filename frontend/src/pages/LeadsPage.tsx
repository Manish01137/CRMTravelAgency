import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Contact2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Lead, LeadSource, LeadStatus, Paginated, User } from '@/types';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  leadSourceStyle,
  leadStatusStyle,
  leadTemperature,
} from '@/lib/leadMeta';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

const PAGE_SIZE = 10;
const ALL = 'ALL';
const UNASSIGNED = 'unassigned';

function LeadActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Lead actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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

function AssigneeBadge({ lead }: { lead: Lead }) {
  if (!lead.assignedTo) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40">
          <UserRound className="size-3.5" />
        </span>
        <span className="italic">Unassigned</span>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-[10px]">{initials(lead.assignedTo.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm text-foreground">{lead.assignedTo.name}</span>
    </div>
  );
}

function StatusPill({ status }: { status: LeadStatus }) {
  const st = leadStatusStyle(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        st.pill,
      )}
    >
      <span className={cn('size-1.5 rounded-full', st.dot)} />
      {st.label}
    </span>
  );
}

function SourceBadge({ source }: { source: LeadSource }) {
  const s = leadSourceStyle(source);
  const Icon = s.Icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        s.badge,
      )}
    >
      <Icon className="size-3.5" />
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
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none ring-1 ring-inset',
        temp.pill,
      )}
    >
      {temp.label}
    </span>
  );
}

/** Horizontal, scrollable pipeline-stage filter chips (one colour per stage). */
function PipelineChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const base =
    'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin" role="tablist" aria-label="Filter by pipeline stage">
      <button
        type="button"
        role="tab"
        aria-selected={value === ALL}
        onClick={() => onChange(ALL)}
        className={cn(
          base,
          value === ALL
            ? 'bg-foreground text-background ring-1 ring-inset ring-foreground'
            : 'bg-card text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted',
        )}
      >
        All leads
      </button>
      {LEAD_STATUSES.map((s) => {
        const st = leadStatusStyle(s.value);
        const active = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(active ? ALL : s.value)}
            className={cn(base, active ? st.chipActive : st.chipIdle)}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function LeadsPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [status, setStatus] = useState<string>(ALL);
  const [source, setSource] = useState<string>(ALL);
  const [assignee, setAssignee] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);

  // Reset to first page whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [search, status, source, assignee]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== ALL) params.set('status', status);
    if (source !== ALL) params.set('source', source);
    if (assignee !== ALL) params.set('assignedToId', assignee);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    return params.toString();
  }, [search, status, source, assignee, page]);

  const leadsQuery = useQuery({
    queryKey: ['leads', queryString],
    queryFn: () => api.get<Paginated<Lead>>(`/leads?${queryString}`),
    placeholderData: keepPreviousData,
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
  });
  const users = usersQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      toast.success('Lead deleted');
      setDeletingLead(null);
    },
    onError: () => toast.error('Could not delete this lead'),
  });

  const data = leadsQuery.data;
  const leads = data?.items ?? [];
  const hasActiveFilters = Boolean(search) || status !== ALL || source !== ALL || assignee !== ALL;

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
    setStatus(ALL);
    setSource(ALL);
    setAssignee(ALL);
  };

  return (
    <div>
      <PageHeader title="Leads" description="Track and manage every enquiry in one place.">
        <Button onClick={openCreate}>
          <Plus /> New lead
        </Button>
      </PageHeader>

      {/* Pipeline stage filter — colored, horizontally scrollable */}
      <PipelineChips value={status} onChange={setStatus} />

      {/* Toolbar: search + secondary filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, phone…"
            className="pl-9"
            aria-label="Search leads"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-1 sm:justify-end">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by source">
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
            <SelectTrigger className="sm:w-44" aria-label="Filter by assignee">
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
        </div>
      </div>

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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Lead</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Destination</th>
                    <th className="px-4 py-3 font-medium">Budget</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Assignee</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((lead) => {
                    const temp = leadTemperature(lead);
                    return (
                      <tr
                        key={lead.id}
                        className={cn('transition-colors', temp ? temp.rowClass : 'hover:bg-muted/50')}
                      >
                        <td className={cn('px-4 py-3', temp?.accentCell)}>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-medium text-foreground">{lead.name}</p>
                                <TemperaturePill lead={lead} />
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {lead.email || lead.phone || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <SourceBadge source={lead.source} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.destination || '—'}</td>
                        <td className="px-4 py-3 text-foreground">
                          {formatCurrency(lead.budgetAmount, lead.budgetCurrency ?? 'USD')}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={lead.status} />
                        </td>
                        <td className="px-4 py-3">
                          <AssigneeBadge lead={lead} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <LeadActions onEdit={() => openEdit(lead)} onDelete={() => setDeletingLead(lead)} />
                        </td>
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
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-foreground">{lead.name}</p>
                          <TemperaturePill lead={lead} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.email || lead.phone || '—'}
                        </p>
                      </div>
                    </div>
                    <LeadActions onEdit={() => openEdit(lead)} onDelete={() => setDeletingLead(lead)} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusPill status={lead.status} />
                    <SourceBadge source={lead.source} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Destination</dt>
                      <dd className="flex items-center gap-1 text-foreground">
                        {lead.destination ? (
                          <>
                            <MapPin className="size-3.5 text-muted-foreground" />
                            <span className="truncate">{lead.destination}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Budget</dt>
                      <dd className="text-foreground">
                        {formatCurrency(lead.budgetAmount, lead.budgetCurrency ?? 'USD')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Travel date</dt>
                      <dd className="text-foreground">{formatDate(lead.travelDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Assignee</dt>
                      <dd className="text-foreground">
                        {lead.assignedTo ? lead.assignedTo.name : 'Unassigned'}
                      </dd>
                    </div>
                  </dl>
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
    </div>
  );
}

function LeadsSkeleton() {
  return (
    <Card className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </Card>
  );
}
