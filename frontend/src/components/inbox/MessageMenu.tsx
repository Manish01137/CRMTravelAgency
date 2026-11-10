import { useState } from 'react';
import { ChevronDown, Copy, Info, Plus, Reply, Star, StarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChannelMessage } from '@/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** WhatsApp's quick reactions. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/**
 * The ⌄ on each message (like WhatsApp Web): react, reply, copy, star, info.
 * Shows on hover on a computer; on touch screens it stays faintly visible.
 */
export function MessageMenu({
  align,
  reactions,
  onReply,
  onCopy,
  starred,
  onStar,
  onInfo,
}: {
  align: 'start' | 'end';
  /** Absent when this message can't be reacted to. */
  reactions?: { current: string | null; onReact: (emoji: string) => void; onMore: () => void };
  onReply?: () => void;
  onCopy?: () => void;
  starred: boolean;
  onStar: () => void;
  onInfo: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Message options"
          title="Options"
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#54656f] shadow-sm transition-opacity hover:text-[#111b21]',
            open ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60',
          )}
        >
          <ChevronDown className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        {reactions && (
          <>
            <div className="flex items-center justify-between gap-0.5 px-1 py-1" role="group" aria-label="React">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  title={reactions.current === e ? 'Remove reaction' : `React ${e}`}
                  onClick={() => {
                    reactions.onReact(reactions.current === e ? '' : e);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-[19px] leading-none transition-transform hover:scale-125',
                    reactions.current === e && 'bg-[#d9fdd3]',
                  )}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                title="More reactions"
                aria-label="More reactions"
                onClick={() => {
                  setOpen(false);
                  reactions.onMore();
                }}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {onReply && (
          <DropdownMenuItem onSelect={onReply}>
            <Reply className="size-4" /> Reply
          </DropdownMenuItem>
        )}
        {onCopy && (
          <DropdownMenuItem onSelect={onCopy}>
            <Copy className="size-4" /> Copy
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onStar}>
          {starred ? <StarOff className="size-4" /> : <Star className="size-4" />} {starred ? 'Unstar' : 'Star'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onInfo}>
          <Info className="size-4" /> Message info
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The reactions pill under a bubble — the customer's and ours. */
export function ReactionBadges({ m, contactName, side }: { m: Pick<ChannelMessage, 'customerReaction' | 'agentReaction'>; contactName: string; side: 'left' | 'right' }) {
  const list = [m.customerReaction, m.agentReaction].filter((e): e is string => !!e);
  if (list.length === 0) return null;
  const same = list.length === 2 && list[0] === list[1];
  const who = [m.customerReaction && `${contactName}: ${m.customerReaction}`, m.agentReaction && `You: ${m.agentReaction}`].filter(Boolean).join(' · ');
  return (
    <span
      title={who}
      className={cn(
        'absolute -bottom-[18px] z-[1] flex items-center gap-0.5 rounded-full border border-white bg-white px-1.5 py-[1px] text-[14px] leading-5 shadow-[0_1px_2px_rgba(11,20,26,0.18)]',
        side === 'right' ? 'right-2' : 'left-2',
      )}
    >
      {same ? list[0] : list.join('')}
      {same && <span className="text-[11px] text-[#667781]">2</span>}
    </span>
  );
}
