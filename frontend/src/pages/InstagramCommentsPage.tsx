import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, CheckCircle2, Instagram, MessageCircle, Pencil, Plus, Trash2, XCircle, MinusCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TravelPackage } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TagInput } from '@/components/ui/tag-input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RuleMedia {
  id: string;
  caption?: string | null;
  thumbnailUrl?: string | null;
  permalink?: string | null;
}
interface Rule {
  id: string;
  name: string;
  isActive: boolean;
  media: RuleMedia[];
  keywords: string[];
  packageId: string | null;
  package: { id: string; name: string; bannerImageUrl: string | null } | null;
  dmText: string;
  publicReply: string | null;
  sentCount: number;
}
interface MediaItem {
  id: string;
  caption: string | null;
  mediaType: string;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
}
interface Activity {
  id: string;
  username: string | null;
  commentText: string | null;
  adId: string | null;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  error: string | null;
  createdAt: string;
  conversationId: string | null;
  rule: { id: string; name: string } | null;
}

const DEFAULT_DM = 'Hi {name}! 👋 Thanks for your comment. Here are the full trip details, dates and price:\n\n{link}\n\nReply here with your travel dates and number of people and we’ll share the best price 😊';
const DEFAULT_PUBLIC = 'Sent you the details in DM 📩';

/** Instagram "comment → DM": rules that DM a package to people who comment on posts / ads. */
export function InstagramCommentsPage() {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ['ig-comment-rules'], queryFn: () => api.get<Rule[]>('/instagram-comments/rules') });
  const activity = useQuery({ queryKey: ['ig-comment-activity'], queryFn: () => api.get<Activity[]>('/instagram-comments/activity'), refetchInterval: 30_000 });
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);

  const toggle = useMutation({
    mutationFn: (r: Rule) => api.patch<Rule>(`/instagram-comments/rules/${r.id}`, { isActive: !r.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ig-comment-rules'] }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not change the rule'),
  });
  const remove = useMutation({
    mutationFn: (r: Rule) => api.delete(`/instagram-comments/rules/${r.id}`),
    onSuccess: () => {
      toast.success('Rule deleted');
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ['ig-comment-rules'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete the rule'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comment → DM"
        description="When someone comments on your Instagram post or ad, they get your package in their DMs automatically — and become a lead in the Inbox."
      >
        <Button onClick={() => setEditing('new')}>
          <Plus /> New rule
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          {[
            ['1', 'Someone comments', '“Price?”, “Details pls”, or any word you choose — on a post, reel or ad.'],
            ['2', 'They get a DM', 'Your message with the package link, sent instantly. Optionally a public reply too.'],
            ['3', 'It’s a lead', 'They show up in Leads and the Inbox; when they reply, the chat carries on as usual.'],
          ].map(([n, t, d]) => (
            <div key={n} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-sm font-bold text-white">{n}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {rules.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rules.isError ? (
        <p className="text-sm text-destructive">{rules.error instanceof ApiError ? rules.error.message : 'Could not load the rules'}</p>
      ) : !rules.data?.length ? (
        <EmptyState
          icon={<Instagram />}
          title="No comment rules yet"
          description="Create one: pick your posts or ads, the words to listen for, and the package to send."
          action={
            <Button onClick={() => setEditing('new')}>
              <Plus /> New rule
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.data.map((r) => (
            <Card key={r.id} className={cn(!r.isActive && 'opacity-70')}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.sentCount} DM{r.sentCount === 1 ? '' : 's'} sent
                    </p>
                  </div>
                  <Switch checked={r.isActive} disabled={toggle.isPending} onCheckedChange={() => toggle.mutate(r)} aria-label={r.isActive ? 'Turn off' : 'Turn on'} />
                </div>
                <div className="space-y-1.5 text-sm">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">On</span>
                    {r.media.length ? (
                      <span className="flex items-center gap-1">
                        {r.media.slice(0, 5).map((m) =>
                          m.thumbnailUrl ? <img key={m.id} src={m.thumbnailUrl} alt="" className="size-8 rounded object-cover" /> : <span key={m.id} className="size-8 rounded bg-muted" />,
                        )}
                        <span className="text-xs text-muted-foreground">
                          {r.media.length} post{r.media.length === 1 ? '' : 's'}
                        </span>
                      </span>
                    ) : (
                      <span className="font-medium">Every post &amp; ad</span>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">When</span>
                    {r.keywords.length ? (
                      r.keywords.map((k) => (
                        <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {k}
                        </span>
                      ))
                    ) : (
                      <span className="font-medium">Any comment</span>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">Sends</span>
                    <span className="truncate font-medium">{r.package?.name ?? 'Message only'}</span>
                  </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(r)}>
                    <Trash2 className="text-destructive" /> Delete
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                    <Pencil /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent comments</CardTitle>
          <CardDescription>Comments that matched a rule, and what happened.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !activity.data?.length ? (
            <p className="text-sm text-muted-foreground">Nothing yet — matching comments will show up here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.data.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-3">
                  {a.status === 'SENT' ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : a.status === 'FAILED' ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <MinusCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{a.username ? `@${a.username}` : 'Someone'}</span>{' '}
                      <span className="text-muted-foreground">on {a.adId ? 'an ad' : 'a post'}:</span> “{a.commentText}”
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      {a.rule && ` · ${a.rule.name}`}
                      {a.status === 'SENT' ? ' · DM sent' : a.error ? ` · ${a.error}` : ''}
                    </p>
                  </div>
                  {a.status === 'SENT' && (
                    <Link to="/inbox" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <MessageCircle className="size-3.5" /> Chat
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <details className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Setup &amp; Instagram’s rules</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Instagram must be connected in Settings → Channels (a Business or Creator account). If a rule can’t be saved, disconnect and connect Instagram again, allowing every permission.</li>
          <li>Meta App Dashboard → Instagram → Webhooks: subscribe to <b>comments</b> (next to “messages”).</li>
          <li>Instagram allows one automatic DM per comment, within 7 days of it. The same person commenting again on the same post gets only one DM a day.</li>
          <li>The DM is text — include the package link with <code>{'{link}'}</code>. Photos and buttons can follow once they reply.</li>
        </ul>
      </details>

      {editing && <RuleDialog rule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this rule?"
        description="Comments won’t get this DM any more. Leads and chats already created stay."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}

function RuleDialog({ rule, onClose }: { rule: Rule | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(rule?.name ?? '');
  const [allPosts, setAllPosts] = useState(!rule || rule.media.length === 0);
  const [picked, setPicked] = useState<RuleMedia[]>(rule?.media ?? []);
  const [keywords, setKeywords] = useState<string[]>(rule?.keywords ?? ['price', 'details', 'info']);
  const [packageId, setPackageId] = useState<string>(rule?.packageId ?? 'none');
  const [dmText, setDmText] = useState(rule?.dmText ?? DEFAULT_DM);
  const [publicOn, setPublicOn] = useState(rule ? !!rule.publicReply : true);
  const [publicReply, setPublicReply] = useState(rule?.publicReply ?? DEFAULT_PUBLIC);
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);

  const packages = useQuery({ queryKey: ['packages'], queryFn: () => api.get<TravelPackage[]>('/packages') });
  const media = useQuery({ queryKey: ['ig-media'], queryFn: () => api.get<MediaItem[]>('/instagram-comments/media'), enabled: !allPosts, retry: false, staleTime: 60_000 });
  const pkg = packages.data?.find((p) => p.id === packageId) ?? null;

  const preview = useMemo(() => {
    const link = pkg ? `${window.location.origin}/p/${pkg.id}` : '';
    let t = dmText.replace(/\{name\}/gi, '@traveller').replace(/\{link\}/gi, link);
    if (pkg && !/\{link\}/i.test(dmText)) t += `\n\n👉 ${pkg.name}: ${link}`;
    return t.trim();
  }, [dmText, pkg]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        isActive,
        media: allPosts ? [] : picked,
        keywords,
        packageId: packageId === 'none' ? null : packageId,
        dmText: dmText.trim(),
        publicReply: publicOn ? publicReply.trim() : null,
      };
      return rule ? api.patch<Rule>(`/instagram-comments/rules/${rule.id}`, body) : api.post<Rule>('/instagram-comments/rules', body);
    },
    onSuccess: () => {
      toast.success(rule ? 'Rule saved' : 'Rule created — matching comments now get a DM');
      void queryClient.invalidateQueries({ queryKey: ['ig-comment-rules'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save the rule'),
  });

  const togglePost = (m: MediaItem) =>
    setPicked((list) =>
      list.some((x) => x.id === m.id) ? list.filter((x) => x.id !== m.id) : [...list, { id: m.id, caption: m.caption?.slice(0, 280) ?? null, thumbnailUrl: m.thumbnailUrl, permalink: m.permalink }],
    );

  const invalid = !name.trim() || !dmText.trim() || (!allPosts && picked.length === 0);

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[94dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit rule' : 'New comment rule'}</DialogTitle>
          <DialogDescription>Choose where to listen, which words trigger it, and what to send.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field label="Rule name" htmlFor="rule-name" required>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Spiti ad — send package" />
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Which posts &amp; ads</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                [true, 'Every post & ad', 'Any comment on your account'],
                [false, 'Only these posts', 'Pick posts or reels below'],
              ].map(([v, t, d]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setAllPosts(v as boolean)}
                  className={cn('rounded-xl border p-3 text-left transition-colors', allPosts === v ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}
                >
                  <p className="text-sm font-semibold">{t as string}</p>
                  <p className="text-xs text-muted-foreground">{d as string}</p>
                </button>
              ))}
            </div>
            {!allPosts && (
              <div className="mt-3">
                {media.isLoading ? (
                  <div className="flex justify-center py-6">
                    <Spinner />
                  </div>
                ) : media.isError ? (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {media.error instanceof ApiError ? media.error.message : 'Could not load your Instagram posts.'}
                  </p>
                ) : !media.data?.length ? (
                  <p className="text-sm text-muted-foreground">No posts found on this Instagram account.</p>
                ) : (
                  <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                    {media.data.map((m) => {
                      const on = picked.some((x) => x.id === m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => togglePost(m)}
                          title={m.caption ?? ''}
                          aria-pressed={on}
                          className={cn('relative aspect-square overflow-hidden rounded-lg border-2 bg-muted', on ? 'border-primary' : 'border-transparent')}
                        >
                          {m.thumbnailUrl && <img src={m.thumbnailUrl} alt={m.caption ?? 'Post'} className="size-full object-cover" />}
                          {on && (
                            <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Ads made from a post count as that post. For ads made only in Ads Manager, use “Every post &amp; ad” with keywords.
                </p>
              </div>
            )}
          </div>

          <Field label="Trigger words" hint="The comment must contain one of these. Leave empty to reply to every comment.">
            <TagInput value={keywords} onChange={setKeywords} placeholder="Type a word and press Enter" max={30} maxLength={40} />
          </Field>

          <Field label="Package to send">
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No package — message only</SelectItem>
                {(packages.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="DM message" hint="{name} = their @username · {link} = the package page" required>
              <Textarea value={dmText} onChange={(e) => setDmText(e.target.value)} rows={7} maxLength={900} />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Preview</p>
              <div className="rounded-2xl bg-[#efefef] p-3">
                <p className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[13px] leading-snug text-[#262626] shadow-sm">{preview}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Also reply publicly under the comment</p>
                <p className="text-xs text-muted-foreground">Others see you answered — and that the details are in DM.</p>
              </div>
              <Switch checked={publicOn} onCheckedChange={setPublicOn} aria-label="Reply publicly" />
            </div>
            {publicOn && <Input value={publicReply} onChange={(e) => setPublicReply(e.target.value)} maxLength={300} aria-label="Public reply" />}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <p className="text-sm font-medium">Rule is on</p>
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Rule is on" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={invalid || save.isPending}>
            {save.isPending && <Spinner className="size-4" />} {rule ? 'Save rule' : 'Create rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
