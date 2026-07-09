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
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Lead, Paginated, User } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { LEAD_SOURCES, LEAD_STATUSES, leadSourceLabel, leadStatusMeta } from '@/lib/leadMeta';
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
  if (!lead.assignedTo) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-[10px]">{initials(lead.assignedTo.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm text-foreground">{lead.assignedTo.name}</span>
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

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:max-w-xs lg:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, phone…"
            className="pl-9"
            aria-label="Search leads"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-1 lg:justify-end">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="lg:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="lg:w-40" aria-label="Filter by source">
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
            <SelectTrigger className="col-span-2 sm:col-span-1 lg:w-44" aria-label="Filter by assignee">
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
                    const st = leadStatusMeta(lead.status);
                    return (
                      <tr key={lead.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{lead.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {lead.email || lead.phone || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{leadSourceLabel(lead.source)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.destination || '—'}</td>
                        <td className="px-4 py-3 text-foreground">
                          {formatCurrency(lead.budgetAmount, lead.budgetCurrency ?? 'USD')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={st.variant}>{st.label}</Badge>
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
              const st = leadStatusMeta(lead.status);
              return (
                <Card key={lead.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{lead.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.email || lead.phone || '—'}
                        </p>
                      </div>
                    </div>
                    <LeadActions onEdit={() => openEdit(lead)} onDelete={() => setDeletingLead(lead)} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={st.variant}>{st.label}</Badge>
                    <Badge variant="muted">{leadSourceLabel(lead.source)}</Badge>
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
