import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, ExternalLink, FileText, Info, Link2, MessageCircle, Mic, Phone, Play, Star, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { copyToClipboard } from '@/lib/share';
import { LEAD_STATUS_STYLES } from '@/lib/leadMeta';
import type { Conversation, MessageDirection } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { isAudioUrl, isStickerMessage } from './MediaPlayers';

type SharedFile = { id: string; direction: MessageDirection; mediaUrl: string; body: string | null; createdAt: string };
type SharedLink = { messageId: string; direction: MessageDirection; url: string; createdAt: string };
type Shared = {
  media: SharedFile[];
  docs: SharedFile[];
  links: SharedLink[];
  stats: { received: number; sent: number; firstMessageAt: string };
};

const isVideo = (url: string) => /\.(mp4|mov|webm|3gp)(?:[?#]|$)/i.test(url);
const fileName = (url: string) => {
  const last = decodeURIComponent(url.split('/').pop()?.split(/[?#]/)[0] ?? 'file');
  return last.replace(/^\d+-[0-9a-f]+-?/, '') || last;
};
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * WhatsApp Web's "Contact info": who this is, their lead, and everything
 * shared in the chat (photos & videos, documents & voice notes, links).
 */
export function ContactInfoPanel({
  conversation,
  channel,
  onClose,
  onJump,
  onShowStarred,
}: {
  conversation: Conversation;
  channel: 'WHATSAPP' | 'INSTAGRAM';
  onClose: () => void;
  /** Go to a message in the chat; false when it isn't among the loaded ones. */
  onJump: (messageId: string) => boolean;
  onShowStarred: () => void;
}) {
  const wa = channel === 'WHATSAPP';
  const [tab, setTab] = useState<'media' | 'docs' | 'links'>('media');
  const shared = useQuery({
    queryKey: ['shared', conversation.id],
    queryFn: () => api.get<Shared>(`/inbox/conversations/${conversation.id}/shared`),
    staleTime: 30_000,
  });
  const name = conversation.contactName || conversation.contactPhone || conversation.externalContactId;
  const phone = conversation.contactPhone;
  const lead = conversation.lead;
  const open = (messageId: string, url: string) => {
    if (!onJump(messageId)) window.open(url, '_blank', 'noreferrer');
  };
  const list = shared.data ? (tab === 'media' ? shared.data.media.length : tab === 'docs' ? shared.data.docs.length : shared.data.links.length) : 0;

  return (
    <aside className={cn('absolute inset-0 z-40 flex flex-col bg-[#f0f2f5] md:left-auto md:w-[400px] md:border-l md:shadow-[-8px_0_24px_rgba(0,0,0,0.06)]', wa ? 'md:border-[#d1d7db]' : 'bg-white md:border-[#dbdbdb]')}>
      <div className={cn('flex h-[60px] shrink-0 items-center gap-3 px-4', wa ? 'bg-[#f0f2f5]' : 'border-b border-[#efefef] bg-white')}>
        <button type="button" onClick={onClose} aria-label="Close contact info" className="flex size-9 items-center justify-center rounded-full text-[#54656f] hover:bg-black/[0.06]">
          <X className="size-5" />
        </button>
        <h3 className="text-[16px] font-medium text-[#111b21]">Contact info</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Who */}
        <section className="flex flex-col items-center bg-white px-6 pb-6 pt-7 text-center">
          <Avatar className="size-[132px]">
            {conversation.contactAvatarUrl && <AvatarImage src={conversation.contactAvatarUrl} alt="" className="object-cover" />}
            <AvatarFallback className="bg-[#dfe5e7] text-4xl font-light text-[#54656f]">{initials(name)}</AvatarFallback>
          </Avatar>
          <p className="mt-4 text-[22px] leading-tight text-[#111b21]">{name}</p>
          {phone && conversation.contactName && <p className="mt-1 text-[15px] text-[#667781]">{phone}</p>}
          <p className="mt-0.5 text-[13px] text-[#667781]">{wa ? 'WhatsApp' : 'Instagram'}</p>
          {wa && phone && (
            <div className="mt-5 flex gap-3">
              {[
                { icon: <Phone className="size-5" />, label: 'Call', href: `tel:+${phone.replace(/\D/g, '')}` },
                { icon: <MessageCircle className="size-5" />, label: 'WhatsApp', href: `https://wa.me/${phone.replace(/\D/g, '')}` },
              ].map((a) => (
                <a key={a.label} href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="flex w-[84px] flex-col items-center gap-1.5 rounded-lg border border-[#e9edef] py-2.5 text-[13px] text-[#008069] hover:bg-[#f5f6f6]">
                  {a.icon}
                  {a.label}
                </a>
              ))}
              <button
                type="button"
                onClick={async () => ((await copyToClipboard(phone)) ? toast.success('Number copied') : toast.error('Could not copy'))}
                className="flex w-[84px] flex-col items-center gap-1.5 rounded-lg border border-[#e9edef] py-2.5 text-[13px] text-[#008069] hover:bg-[#f5f6f6]"
              >
                <Copy className="size-5" /> Copy
              </button>
            </div>
          )}
          {wa && !conversation.contactAvatarUrl && (
            <p className="mt-4 flex items-start gap-1.5 text-left text-[11.5px] leading-4 text-[#8696a0]">
              <Info className="mt-px size-3.5 shrink-0" />
              WhatsApp doesn’t share customers’ profile photos or “About” with business apps — only the name they set in WhatsApp.
            </p>
          )}
        </section>

        {/* Lead + history */}
        <section className="mt-2 space-y-3 bg-white px-6 py-4 text-sm">
          {lead && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#667781]">Lead</span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', LEAD_STATUS_STYLES[lead.status].pill)}>{LEAD_STATUS_STYLES[lead.status].label}</span>
              <span className="text-[#667781]">· {lead.assignedTo ? `Assigned to ${lead.assignedTo.name}` : 'Unassigned'}</span>
            </div>
          )}
          {lead && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.map((t) => (
                <span key={t} className="rounded-full bg-[#f0f2f5] px-2 py-0.5 text-xs text-[#54656f]">
                  {t}
                </span>
              ))}
            </div>
          )}
          {shared.data ? (
            <p className="text-[#667781]">
              Chatting since {shortDate(shared.data.stats.firstMessageAt)} · {shared.data.stats.received} received · {shared.data.stats.sent} sent
            </p>
          ) : (
            <Skeleton className="h-4 w-3/4" />
          )}
          <button type="button" onClick={onShowStarred} className="flex w-full items-center gap-3 py-1 text-left text-[#111b21] hover:text-[#008069]">
            <Star className="size-4 text-[#8696a0]" /> Starred messages
          </button>
        </section>

        {/* Shared */}
        <section className="mt-2 bg-white pb-6">
          <div className="flex border-b border-[#e9edef]">
            {(
              [
                ['media', 'Media', shared.data?.media.length],
                ['docs', 'Docs', shared.data?.docs.length],
                ['links', 'Links', shared.data?.links.length],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn('flex-1 border-b-[3px] py-3 text-sm font-medium transition-colors', tab === key ? 'border-[#00a884] text-[#008069]' : 'border-transparent text-[#667781] hover:text-[#111b21]')}
              >
                {label}
                {n ? ` · ${n}` : ''}
              </button>
            ))}
          </div>
          <div className="px-4 pt-3">
            {shared.isLoading ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : list === 0 ? (
              <p className="py-8 text-center text-sm text-[#8696a0]">{tab === 'media' ? 'No photos or videos yet' : tab === 'docs' ? 'No documents or voice notes yet' : 'No links yet'}</p>
            ) : tab === 'media' ? (
              <div className="grid grid-cols-3 gap-1.5">
                {shared.data!.media.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => open(m.id, m.mediaUrl)}
                    title={shortDate(m.createdAt)}
                    className={cn('relative aspect-square overflow-hidden rounded-md', isStickerMessage(m) ? 'bg-[#f0f2f5]' : 'bg-black/5')}
                  >
                    {isVideo(m.mediaUrl) ? (
                      <>
                        <video src={`${m.mediaUrl}#t=0.1`} preload="metadata" muted className="size-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="size-7 fill-white text-white" />
                        </span>
                      </>
                    ) : (
                      <img src={m.mediaUrl} alt="" loading="lazy" className={cn('size-full', isStickerMessage(m) ? 'object-contain p-2' : 'object-cover')} />
                    )}
                  </button>
                ))}
              </div>
            ) : tab === 'docs' ? (
              <ul className="divide-y divide-[#f0f2f5]">
                {shared.data!.docs.map((d) => {
                  const audio = isAudioUrl(d.mediaUrl);
                  return (
                    <li key={d.id}>
                      <button type="button" onClick={() => open(d.id, d.mediaUrl)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[#f5f6f6]">
                        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md text-white', audio ? 'bg-[#00a884]' : 'bg-[#ff5c5c]')}>
                          {audio ? <Mic className="size-5" /> : <FileText className="size-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-[#111b21]">{audio ? (d.body?.includes('Voice') ? 'Voice message' : 'Audio') : fileName(d.mediaUrl)}</span>
                          <span className="block text-xs text-[#667781]">
                            {d.direction === 'INBOUND' ? 'Received' : 'Sent'} · {shortDate(d.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="divide-y divide-[#f0f2f5]">
                {shared.data!.links.map((l, i) => (
                  <li key={`${l.messageId}-${i}`} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#f0f2f5] text-[#54656f]">
                      <Link2 className="size-5" />
                    </span>
                    <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[#027eb5] hover:underline">{l.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                      <span className="block text-xs text-[#667781]">
                        {l.direction === 'INBOUND' ? 'Received' : 'Sent'} · {shortDate(l.createdAt)}
                      </span>
                    </a>
                    <button type="button" onClick={() => onJump(l.messageId) || toast.info('That message is older than the ones shown in this chat')} title="Show in chat" className="shrink-0 rounded-full p-1.5 text-[#8696a0] hover:bg-black/5">
                      <ExternalLink className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
