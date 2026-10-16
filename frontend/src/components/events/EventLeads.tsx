import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Phone, Search, Ticket, Trash2, UserPlus, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EventItem, EventLeadItem, Lead, Paginated } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BOOKING_STATUS_STYLES, bookingRef } from '@/lib/crmMeta';
import { leadStatusStyle } from '@/lib/leadMeta';
import { formatCurrency } from '@/lib/format';

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/**
 * Existing CRM leads assigned to an event. Each row is the original lead
 * (never a copy); a lead can be converted into a booking on this event.
 */
export function EventLeads({ event, leads, seatsRemaining }: { event: EventItem; leads: EventLeadItem[]; seatsRemaining: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [converting, setConverting] = useState<EventLeadItem | null>(null);
  const [removing, setRemoving] = useState<EventLeadItem | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['event', event.id] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const removeMutation = useMutation({
    mutationFn: (leadId: string) => api.delete(`/events/${event.id}/leads/${leadId}`),
    onSuccess: () => {
      refresh();
      setRemoving(null);
      toast.success('Lead removed from the event');
    },
    onError: (err) => toast.error(errorText(err, 'Could not remove the lead')),
  });

  const booked = leads.filter((l) => l.booking).length;

  return (
    <>
      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-foreground">
          Leads ({leads.length})
          {leads.length > 0 && <span className="ml-2 text-xs font-medium text-muted-foreground">{booked} booked</span>}
        </h2>
        <Button size="sm" onClick={() => setAdding(true)}>
          <UserPlus /> Add leads
        </Button>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No leads assigned yet"
          description="Add people from your Leads list who are interested in this departure. When they confirm, convert them into a booking here."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border bg-primary/[0.04] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Travellers</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 text-right font-semibold">Booking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((l) => {
                  const st = leadStatusStyle(l.lead.status);
                  return (
                    <tr key={l.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{l.lead.name}</p>
                        {l.lead.phone && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="size-3" /> {l.lead.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {st && (
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', st.pill)}>
                            <span className={cn('size-1.5 rounded-full', st.dot)} />
                            {st.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{l.booking?.travelerCount ?? l.travelerCount}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.lead.assignedTo?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.booking ? (
                            <button
                              onClick={() => navigate(`/bookings/${l.booking!.id}`)}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset hover:opacity-80',
                                BOOKING_STATUS_STYLES[l.booking.status].pill,
                              )}
                            >
                              <Check className="size-3" /> {bookingRef(l.booking.bookingNumber)}
                            </button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setConverting(l)}>
                              <Ticket /> Convert to booking
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            title="Remove from event"
                            onClick={() => setRemoving(l)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddLeadsDialog
        open={adding}
        onOpenChange={setAdding}
        eventId={event.id}
        assignedIds={new Set(leads.map((l) => l.lead.id))}
        onAdded={refresh}
      />
      {converting && (
        <ConvertDialog
          event={event}
          item={converting}
          seatsRemaining={seatsRemaining}
          onClose={() => setConverting(null)}
          onDone={() => {
            refresh();
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this lead from the event?"
        description={
          removing?.booking
            ? `${removing.lead.name} stays in your Leads list, and their booking ${bookingRef(removing.booking.bookingNumber)} is not changed.`
            : `${removing?.lead.name ?? 'The lead'} stays in your Leads list — only the link to this event is removed.`
        }
        confirmLabel="Remove"
        destructive
        loading={removeMutation.isPending}
        onConfirm={() => removing && removeMutation.mutate(removing.lead.id)}
      />
    </>
  );
}

function AddLeadsDialog({
  open,
  onOpenChange,
  eventId,
  assignedIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  assignedIds: Set<string>;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ['event-lead-picker', search],
    queryFn: () =>
      api.get<Paginated<Lead>>(`/leads?pageSize=50&sort=createdAt&order=desc${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`),
    enabled: open,
  });

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setSelected(new Set());
      setSearch('');
    }
  };

  const addMutation = useMutation({
    mutationFn: () => api.post<{ added: number; alreadyInEvent: number }>(`/events/${eventId}/leads`, { leadIds: [...selected] }),
    onSuccess: (r) => {
      onAdded();
      toast.success(`${r.added} lead${r.added === 1 ? '' : 's'} added to the event`);
      close(false);
    },
    onError: (err) => toast.error(errorText(err, 'Could not add the leads')),
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const items = query.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add leads to this event</DialogTitle>
          <DialogDescription>Pick from your existing leads. They stay the same lead — nothing is copied.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or email" className="pl-9" />
        </div>
        <div className="-mx-1 max-h-[45vh] min-h-[120px] overflow-y-auto px-1">
          {query.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No leads found.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((lead) => {
                const already = assignedIds.has(lead.id);
                const checked = already || selected.has(lead.id);
                const st = leadStatusStyle(lead.status);
                return (
                  <li key={lead.id}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => toggle(lead.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                        already ? 'cursor-default border-transparent opacity-60' : checked ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded border',
                          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                        )}
                      >
                        {checked && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{lead.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[lead.phone, lead.destination, lead.travelerCount ? `${lead.travelerCount} travellers` : null].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                      {already ? (
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">Already added</span>
                      ) : (
                        st && <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', st.pill)}>{st.label}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button disabled={selected.size === 0 || addMutation.isPending} onClick={() => addMutation.mutate()}>
            {addMutation.isPending && <Spinner />}
            Add {selected.size > 0 ? selected.size : ''} lead{selected.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertDialog({
  event,
  item,
  seatsRemaining,
  onClose,
  onDone,
}: {
  event: EventItem;
  item: EventLeadItem;
  seatsRemaining: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const [travellers, setTravellers] = useState(String(item.travelerCount || 1));
  const count = Math.max(0, Math.floor(Number(travellers) || 0));
  const suggested = event.pricePerPerson * count;
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('');
  const tooMany = count > seatsRemaining;

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string; bookingNumber: number }>(`/events/${event.id}/leads/${item.lead.id}/convert`, {
        travelerCount: count,
        totalAmount: total === '' ? undefined : Number(total),
        amountPaid: paid === '' ? undefined : Number(paid),
      }),
    onSuccess: (b) => {
      onDone();
      onClose();
      toast.success(`Booking ${bookingRef(b.bookingNumber)} created for ${item.lead.name}`, {
        action: { label: 'Open', onClick: () => navigate(`/bookings/${b.id}`) },
      });
    },
    onError: (err) => toast.error(errorText(err, 'Could not create the booking')),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to booking</DialogTitle>
          <DialogDescription>
            {item.lead.name} is booked on this departure and their lead is marked Won. {seatsRemaining} seat{seatsRemaining === 1 ? '' : 's'} left.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ev-travellers">Travellers</Label>
            <Input id="ev-travellers" type="number" min={1} value={travellers} onChange={(e) => setTravellers(e.target.value)} />
            {tooMany && <p className="text-xs text-destructive">Only {seatsRemaining} seat{seatsRemaining === 1 ? '' : 's'} left on this event.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-total">Total amount</Label>
              <Input
                id="ev-total"
                type="number"
                min={0}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder={String(suggested)}
              />
              <p className="text-xs text-muted-foreground">
                {formatCurrency(event.pricePerPerson, event.priceCurrency)} × {count || 0}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-paid">Paid now</Label>
              <Input id="ev-paid" type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={count < 1 || tooMany || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner />}
            Create booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
