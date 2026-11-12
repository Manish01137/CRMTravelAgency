import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Image as ImageIcon, Megaphone, Pencil, Plus, Search, Send, Trash2, Users, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { toWhatsAppImage } from '@/lib/whatsappImage';
import type { ContactGroupDetail, ContactGroupSummary, Conversation, ConversationChannel, GroupSendResult, MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MAX_MEMBERS = 100;
const HOUR = 60 * 60 * 1000;
const err = (e: unknown, fallback: string) => toast.error(e instanceof ApiError ? e.message : fallback);
const nameOf = (c: Pick<Conversation, 'contactName' | 'contactPhone' | 'externalContactId'>) => c.contactName || c.contactPhone || c.externalContactId;

/** Pick chats (search + tick boxes). */
function ChatPicker({
  channel,
  picked,
  onChange,
  exclude = [],
  limit,
}: {
  channel: ConversationChannel;
  picked: string[];
  onChange: (ids: string[]) => void;
  exclude?: string[];
  limit: number;
}) {
  const [search, setSearch] = useState('');
  const chats = useQuery({
    queryKey: ['conversations', channel, 'picker'],
    queryFn: () => api.get<Conversation[]>(`/inbox/conversations?channel=${channel}&filter=all`),
    staleTime: 30_000,
  });
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (chats.data ?? []).filter((c) => !exclude.includes(c.id)).filter((c) => !q || nameOf(c).toLowerCase().includes(q) || (c.contactPhone ?? '').includes(q));
  }, [chats.data, search, exclude]);
  const toggle = (id: string) =>
    onChange(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length >= limit ? (toast.info(`Up to ${MAX_MEMBERS} chats in a group`), picked) : [...picked, id]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats"
          className="h-9 w-full rounded-lg bg-muted pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <ul className="max-h-[38vh] min-h-[120px] overflow-y-auto rounded-lg border border-border">
        {chats.isLoading ? (
          <li className="flex justify-center py-8">
            <Spinner />
          </li>
        ) : list.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">No chats found.</li>
        ) : (
          list.map((c) => {
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={cn('flex w-full items-center gap-3 px-3 py-2 text-left transition-colors', on ? 'bg-primary/10' : 'hover:bg-muted')}
                >
                  <span className={cn('flex size-5 shrink-0 items-center justify-center rounded border', on ? 'border-[#00a884] bg-[#00a884] text-white' : 'border-muted-foreground/40')}>
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{initials(nameOf(c))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{nameOf(c)}</span>
                    {c.contactName && c.contactPhone && <span className="block truncate text-xs text-muted-foreground">{c.contactPhone}</span>}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      <p className="text-xs text-muted-foreground">{picked.length} selected</p>
    </div>
  );
}

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'group'; id: string } | { kind: 'add'; id: string };

/**
 * Groups (broadcast lists): name a set of chats — "Manali Dec batch" — and
 * send one message to all of them. Each customer gets it as a normal
 * one-to-one message (they don't see each other).
 */
export function GroupsDialog({
  open,
  onOpenChange,
  channel,
  onOpenChat,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  channel: ConversationChannel;
  onOpenChat: (conversationId: string) => void;
}) {
  const wa = channel === 'WHATSAPP';
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>({ kind: 'list' });
  useEffect(() => {
    if (open) setView({ kind: 'list' });
  }, [open, channel]);

  const groups = useQuery({
    queryKey: ['groups', channel],
    queryFn: () => api.get<ContactGroupSummary[]>(`/inbox/groups?channel=${channel}`),
    enabled: open,
  });
  const groupId = view.kind === 'group' || view.kind === 'add' ? view.id : null;
  const group = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => api.get<ContactGroupDetail>(`/inbox/groups/${groupId}`),
    enabled: open && !!groupId,
  });
  const refresh = (detail?: ContactGroupDetail) => {
    queryClient.invalidateQueries({ queryKey: ['groups', channel] });
    if (detail) queryClient.setQueryData(['group', detail.id], detail);
  };

  // --- create
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: () => api.post<ContactGroupDetail>('/inbox/groups', { channel, name: name.trim(), description: description.trim() || undefined, conversationIds: picked }),
    onSuccess: (g) => {
      toast.success(`Group “${g.name}” created`);
      refresh(g);
      setName('');
      setDescription('');
      setPicked([]);
      setView({ kind: 'group', id: g.id });
    },
    onError: (e) => err(e, 'Could not create the group'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        {view.kind === 'list' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className={cn('size-5', wa ? 'text-[#00a884]' : 'text-[#3797f0]')} /> {wa ? 'WhatsApp' : 'Instagram'} groups
              </DialogTitle>
              <DialogDescription>Send one message to many customers at once — each gets it in their own chat, and they don’t see each other.</DialogDescription>
            </DialogHeader>
            <Button onClick={() => setView({ kind: 'create' })} className="w-full">
              <Plus className="size-4" /> New group
            </Button>
            {groups.isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (groups.data ?? []).length === 0 ? (
              <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">No groups yet — e.g. “Manali Dec batch” or “Honeymoon leads”.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {groups.data!.map((g) => (
                  <li key={g.id}>
                    <button type="button" onClick={() => setView({ kind: 'group', id: g.id })} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted">
                      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-white', wa ? 'bg-[#00a884]' : 'bg-[#3797f0]')}>
                        <Users className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{g.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {g.memberCount} chat{g.memberCount === 1 ? '' : 's'}
                          {g.description ? ` · ${g.description}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {view.kind === 'create' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button type="button" onClick={() => setView({ kind: 'list' })} aria-label="Back" className="rounded-full p-1 hover:bg-muted">
                  <ArrowLeft className="size-4" />
                </button>
                New group
              </DialogTitle>
              <DialogDescription>Name it and pick the chats to include (up to {MAX_MEMBERS}).</DialogDescription>
            </DialogHeader>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Manali Dec batch" maxLength={80} />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={300} />
            <ChatPicker channel={channel} picked={picked} onChange={setPicked} limit={MAX_MEMBERS} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setView({ kind: 'list' })}>
                Cancel
              </Button>
              <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
                {create.isPending && <Spinner className="size-4" />} Create group
              </Button>
            </div>
          </>
        )}

        {(view.kind === 'group' || view.kind === 'add') &&
          (group.isLoading || !group.data ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : view.kind === 'add' ? (
            <AddMembers group={group.data} onBack={() => setView({ kind: 'group', id: view.id })} onSaved={(g) => (refresh(g), setView({ kind: 'group', id: g.id }))} />
          ) : (
            <GroupDetail
              group={group.data}
              wa={wa}
              onBack={() => setView({ kind: 'list' })}
              onAdd={() => setView({ kind: 'add', id: view.id })}
              onChanged={refresh}
              onDeleted={() => {
                refresh();
                setView({ kind: 'list' });
              }}
              onOpenChat={(id) => {
                onOpenChange(false);
                onOpenChat(id);
              }}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}

function AddMembers({ group, onBack, onSaved }: { group: ContactGroupDetail; onBack: () => void; onSaved: (g: ContactGroupDetail) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const add = useMutation({
    mutationFn: () => api.post<ContactGroupDetail>(`/inbox/groups/${group.id}/members`, { conversationIds: picked }),
    onSuccess: (g) => {
      toast.success(`Added ${picked.length} chat${picked.length === 1 ? '' : 's'}`);
      onSaved(g);
    },
    onError: (e) => err(e, 'Could not add those chats'),
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-1 hover:bg-muted">
            <ArrowLeft className="size-4" />
          </button>
          Add chats to “{group.name}”
        </DialogTitle>
        <DialogDescription>{MAX_MEMBERS - group.members.length} more can be added.</DialogDescription>
      </DialogHeader>
      <ChatPicker channel={group.channel} picked={picked} onChange={setPicked} exclude={group.members.map((m) => m.id)} limit={MAX_MEMBERS - group.members.length} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button disabled={picked.length === 0 || add.isPending} onClick={() => add.mutate()}>
          {add.isPending && <Spinner className="size-4" />} Add {picked.length || ''}
        </Button>
      </div>
    </>
  );
}

function GroupDetail({
  group,
  wa,
  onBack,
  onAdd,
  onChanged,
  onDeleted,
  onOpenChat,
}: {
  group: ContactGroupDetail;
  wa: boolean;
  onBack: () => void;
  onAdd: () => void;
  onChanged: (g?: ContactGroupDetail) => void;
  onDeleted: () => void;
  onOpenChat: (id: string) => void;
}) {
  const { user: me, isAdmin } = useAuth();
  const canEdit = isAdmin || group.createdBy?.id === me?.id;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [result, setResult] = useState<GroupSendResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<MessageTemplate[]>('/inbox/templates'),
    enabled: wa,
    staleTime: 60_000,
  });
  const approved = (templates.data ?? []).filter((t) => t.status === 'APPROVED');
  // WhatsApp: who can still get a normal message (24 hours since their last message).
  const closed = wa ? group.members.filter((m) => !m.lastInboundAt || Date.now() - new Date(m.lastInboundAt).getTime() > 24 * HOUR).length : 0;

  const rename = useMutation({
    mutationFn: (name: string) => api.patch<ContactGroupDetail>(`/inbox/groups/${group.id}`, { name }),
    onSuccess: (g) => {
      onChanged(g);
      setRenaming(null);
    },
    onError: (e) => err(e, 'Could not rename'),
  });
  const remove = useMutation({
    mutationFn: (conversationId: string) => api.delete<ContactGroupDetail>(`/inbox/groups/${group.id}/members/${conversationId}`),
    onSuccess: (g) => onChanged(g),
    onError: (e) => err(e, 'Could not remove'),
  });
  const del = useMutation({
    mutationFn: () => api.delete(`/inbox/groups/${group.id}`),
    onSuccess: () => {
      toast.success('Group deleted');
      onDeleted();
    },
    onError: (e) => err(e, 'Could not delete the group'),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => api.upload('/uploads', wa ? await toWhatsAppImage(file) : file),
    onSuccess: (r, file) => setPhoto({ url: r.url, name: file.name }),
    onError: (e) => err(e, 'Could not upload the photo'),
  });
  const send = useMutation({
    mutationFn: () =>
      api.post<GroupSendResult>(`/inbox/groups/${group.id}/send`, templateName ? { templateName } : { body: text.trim() || undefined, mediaUrl: photo?.url }),
    onSuccess: (r) => {
      setResult(r);
      if (r.sent) toast.success(`Sent to ${r.sent} chat${r.sent === 1 ? '' : 's'}`);
      if (r.failed) toast.error(`${r.failed} couldn’t be sent — see below`);
      if (r.sent) {
        setText('');
        setPhoto(null);
        setTemplateName('');
      }
    },
    onError: (e) => err(e, 'Could not send'),
  });
  const igPhoto = !wa && !!photo;
  const canSend = group.members.length > 0 && !send.isPending && !upload.isPending && (!!templateName || !!text.trim() || !!photo);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="rounded-full p-1 hover:bg-muted">
            <ArrowLeft className="size-4" />
          </button>
          {renaming !== null ? (
            <form
              className="flex flex-1 items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (renaming.trim()) rename.mutate(renaming.trim());
              }}
            >
              <Input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={80} className="h-9" />
              <Button type="submit" size="icon-sm" disabled={!renaming.trim() || rename.isPending} aria-label="Save name">
                <Check className="size-4" />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => setRenaming(null)} aria-label="Cancel">
                <X className="size-4" />
              </Button>
            </form>
          ) : (
            <>
              <span className="min-w-0 truncate">{group.name}</span>
              {canEdit && (
                <button type="button" onClick={() => setRenaming(group.name)} aria-label="Rename group" title="Rename" className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                  <Pencil className="size-3.5" />
                </button>
              )}
            </>
          )}
        </DialogTitle>
        <DialogDescription>
          {group.members.length} chat{group.members.length === 1 ? '' : 's'}
          {group.description ? ` · ${group.description}` : ''}
        </DialogDescription>
      </DialogHeader>

      {/* Send to everyone */}
      <section className="space-y-2 rounded-xl border border-border p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Megaphone className="size-4" /> Message everyone in this group
        </p>
        {wa && approved.length > 0 && (
          <select
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm"
            aria-label="Send as a template"
          >
            <option value="">Normal message</option>
            {approved.map((t) => (
              <option key={t.id} value={t.name}>
                Template · {t.name}
              </option>
            ))}
          </select>
        )}
        {templateName ? (
          <p className="whitespace-pre-line rounded-lg bg-muted/60 p-2.5 text-sm text-foreground">{approved.find((t) => t.name === templateName)?.bodyText}</p>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={igPhoto ? "Instagram photos can't have text — send the text separately" : photo ? 'Caption (optional)' : 'Type the message'}
              rows={3}
              disabled={igPhoto}
              className="resize-none"
            />
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) upload.mutate(f);
                }}
              />
              {photo ? (
                <span className="flex min-w-0 items-center gap-2 rounded-lg bg-muted px-2 py-1 text-xs">
                  <img src={photo.url} alt="" className="size-8 rounded object-cover" />
                  <span className="truncate">{photo.name}</span>
                  <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="rounded-full p-0.5 hover:bg-black/10">
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
                  {upload.isPending ? <Spinner className="size-3.5" /> : <ImageIcon className="size-3.5" />} Photo
                </Button>
              )}
            </div>
          </>
        )}
        {wa && !templateName && closed > 0 && (
          <p className="flex gap-1.5 text-xs text-amber-700">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            {closed} of {group.members.length} haven’t messaged in the last 24 hours — WhatsApp only delivers a normal message to the others. Choose an approved template to reach everyone.
          </p>
        )}
        <Button className="w-full" disabled={!canSend || igPhoto && !!text.trim()} onClick={() => send.mutate()}>
          {send.isPending ? <Spinner className="size-4" /> : <Send className="size-4" />} Send to {group.members.length} chat{group.members.length === 1 ? '' : 's'}
        </Button>
        {result && (
          <ul className="max-h-40 space-y-1 overflow-y-auto pt-1 text-xs">
            {result.results.map((r) => (
              <li key={r.conversationId} className="flex items-start gap-1.5">
                {r.sent ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-[#00a884]" /> : <AlertCircle className="mt-px size-3.5 shrink-0 text-destructive" />}
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{r.name}</span>{' '}
                  <span className="text-muted-foreground">{r.sent ? 'sent' : `— ${r.error}`}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Members */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Chats in this group</p>
          <Button size="sm" variant="outline" onClick={onAdd} disabled={group.members.length >= MAX_MEMBERS}>
            <Plus className="size-3.5" /> Add chats
          </Button>
        </div>
        {group.members.length === 0 ? (
          <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">No chats yet.</p>
        ) : (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => onOpenChat(m.id)} title="Open chat" className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{initials(nameOf(m))}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{nameOf(m)}</span>
                    {m.contactName && m.contactPhone && <span className="block truncate text-xs text-muted-foreground">{m.contactPhone}</span>}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(m.id)}
                  disabled={remove.isPending}
                  aria-label={`Remove ${nameOf(m)}`}
                  title="Remove from group"
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {canEdit && (
        <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 self-start text-sm text-destructive hover:underline">
          <Trash2 className="size-4" /> Delete group
        </button>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${group.name}”?`}
        description="Only the group is deleted — the chats and their messages stay."
        confirmLabel="Delete group"
        destructive
        loading={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </>
  );
}
