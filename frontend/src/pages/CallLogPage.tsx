import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Phone, PhoneCall, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { CallLogEntry, Lead, Paginated, User } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadPicker } from '@/components/communications/LeadPicker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { formatSmartTime } from '@/lib/format';
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

const OUTCOMES = ['Connected', 'No answer', 'Voicemail', 'Busy', 'Wrong number'];

/** "Log a call" dialog — writes to the existing `POST /leads/:id/activities`
 *  (type=CALL), unchanged. This module never edits Leads' own files. */
function LogCallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [lead, setLead] = useState<Lead | null>(null);
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setLead(null);
    setOutcome('');
    setNotes('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/leads/${lead!.id}/activities`, { type: 'CALL', outcome: outcome.trim() || undefined, message: notes.trim() || undefined }),
    onSuccess: () => {
      toast.success('Call logged');
      queryClient.invalidateQueries({ queryKey: ['call-log'] });
      onOpenChange(false);
      reset();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not log this call'),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a call</DialogTitle>
          <DialogDescription>Record who you called, the outcome, and any notes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Lead" required>
            <LeadPicker selected={lead} onSelect={setLead} />
          </Field>
          <Field label="Outcome" htmlFor="callOutcome">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {OUTCOMES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    outcome === o ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
            <input
              id="callOutcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Or type a custom outcome…"
              maxLength={60}
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
            />
          </Field>
          <Field label="Notes" htmlFor="callNotes">
            <Textarea id="callNotes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed…" />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button disabled={!lead || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner className="size-4" />} Log call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CallLogPage() {
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState<string>('all');
  const [leadFilter, setLeadFilter] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (userId !== 'all') params.set('userId', userId);
  if (leadFilter) params.set('leadId', leadFilter.id);

  const logQuery = useQuery({
    queryKey: ['call-log', page, userId, leadFilter?.id],
    queryFn: () => api.get<Paginated<CallLogEntry>>(`/call-log?${params.toString()}`),
  });
  const data = logQuery.data;

  return (
    <div>
      <PageHeader title="Call Log" description="Manually logged calls against a lead — who called, when, and the outcome.">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus /> Log a call
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Field label="User" htmlFor="callLogUser">
            <Select
              value={userId}
              onValueChange={(v) => {
                setUserId(v);
                setPage(1);
              }}
            >
              <SelectTrigger id="callLogUser">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {(usersQuery.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="w-72">
          <Field label="Lead">
            <LeadPicker
              selected={leadFilter}
              onSelect={(l) => {
                setLeadFilter(l);
                setPage(1);
              }}
            />
          </Field>
        </div>
      </div>

      {logQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<PhoneCall />}
          title="No calls logged yet"
          description="Log your first call to start building the call history."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> Log a call
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {data.items.map((entry) => (
              <Card key={entry.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Phone className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{entry.lead?.name ?? 'Unknown lead'}</p>
                    <span className="text-xs text-muted-foreground">{formatSmartTime(entry.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {entry.lead?.phone && <span>{entry.lead.phone}</span>}
                    {entry.outcome && (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">{entry.outcome}</span>
                    )}
                    {entry.createdBy && <span>by {entry.createdBy.name}</span>}
                  </div>
                  {entry.message && <p className="mt-1.5 text-sm text-foreground">{entry.message}</p>}
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1 || logQuery.isFetching}>
                <ChevronLeft /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={data.page >= data.totalPages || logQuery.isFetching}
              >
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}

      <LogCallDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
