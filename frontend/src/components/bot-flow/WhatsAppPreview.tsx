import { Fragment, type ReactNode } from 'react';
import { CheckCheck, ExternalLink, FileText, List, Play, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotFlowStepMedia, BotFlowStepType, TravelPackage } from '@/types';

/**
 * What the traveller sees on WhatsApp for one Bot Flow step, drawn live from
 * the step editor's unsaved values. Mirrors how the backend sends each step
 * (bot-send.ts): up to 3 short options as reply buttons (media above them),
 * otherwise a list menu (media sent just before it); packages as a photo
 * with caption, several as a swipeable carousel.
 */

export interface PreviewOption {
  label: string;
  description?: string;
}

export interface WhatsAppPreviewProps {
  type: BotFlowStepType;
  text: string;
  options?: PreviewOption[];
  listButtonLabel?: string;
  media?: BotFlowStepMedia | null;
  packages?: TravelPackage[];
  /** COLLECT: the reply to an invalid answer, shown as the bot's second bubble. */
  errorMessage?: string;
  /** Lead-update steps send nothing — says so instead of a bubble. */
  silentNote?: string;
}

const WALLPAPER: React.CSSProperties = {
  backgroundColor: '#E5DDD5',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='none' stroke='%23000000' stroke-opacity='0.05' stroke-width='1.5'%3E%3Ccircle cx='20' cy='24' r='3'/%3E%3Cpath d='M88 92q10-18 20 0q-10 18-20 0'/%3E%3Cpath d='M34 78q8-14 16 0q-8 14-16 0'/%3E%3Ccircle cx='96' cy='28' r='2.5'/%3E%3C/g%3E%3C/svg%3E\")",
  backgroundSize: '120px 120px',
};

/** WhatsApp's own markup — *bold*, _italic_, ~strike~, ```mono``` — rendered as elements (never as HTML). */
export function formatWhatsApp(text: string): ReactNode[] {
  const pattern = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```)/g;
  return text.split('\n').map((line, li, lines) => (
    <Fragment key={li}>
      {line.split(pattern).map((part, i) => {
        if (/^\*[^*\n]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>;
        if (/^_[^_\n]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
        if (/^~[^~\n]+~$/.test(part)) return <s key={i}>{part.slice(1, -1)}</s>;
        if (/^```[^`]+```$/.test(part)) return <code key={i} className="font-mono text-[12px]">{part.slice(3, -3)}</code>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
      {li < lines.length - 1 && <br />}
    </Fragment>
  ));
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function packagePhoto(p: TravelPackage): string | null {
  return p.whatsappBannerUrl || p.bannerImageUrl || p.galleryImages?.[0] || null;
}

function MediaBlock({ media, rounded = 'rounded-md' }: { media: BotFlowStepMedia; rounded?: string }) {
  if (media.type === 'image') return <img src={media.url} alt="" className={cn('max-h-44 w-full object-cover', rounded)} />;
  if (media.type === 'video')
    return (
      <div className={cn('relative flex h-36 items-center justify-center overflow-hidden bg-black', rounded)}>
        <video src={media.url} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover opacity-80" />
        <span className="relative flex size-11 items-center justify-center rounded-full bg-black/50 text-white">
          <Play className="ml-0.5 size-5 fill-white" />
        </span>
      </div>
    );
  return (
    <div className={cn('flex items-center gap-2.5 bg-black/5 p-2.5', rounded)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded bg-red-500/15 text-red-600">
        <FileText className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium">{media.filename || media.url.split('/').pop()?.replace(/^\d+-[0-9a-f]+-/, '') || 'document.pdf'}</span>
        <span className="text-[10px] uppercase text-black/45">PDF</span>
      </span>
    </div>
  );
}

function Bubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative max-w-[88%] rounded-lg rounded-tl-none bg-white px-2 pb-1.5 pt-1.5 text-[13px] leading-snug text-[#111B21] shadow-sm', className)}>
      {children}
      <span className="mt-0.5 block text-right text-[10px] text-black/40">10:42</span>
    </div>
  );
}

function ButtonRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-0.5 flex max-w-[88%] items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-[13px] font-medium text-[#008069] shadow-sm">
      {children}
    </div>
  );
}

function PackageCaption({ p }: { p: TravelPackage }) {
  const blurb = (p.whatsappDescription || p.description || '').replace(/\s+/g, ' ').trim();
  return (
    <>
      <p>
        <strong>{p.name}</strong>
      </p>
      <p>
        {p.days}D / {p.nights}N{p.priceAmount ? ` · ${money(p.priceAmount, p.priceCurrency)}` : ''}
      </p>
      {blurb && <p className="mt-1 text-black/80">{clip(blurb, 160)}</p>}
      <p className="mt-1 text-[#027EB5]">View full itinerary: …/p/{p.id.slice(0, 8)}</p>
    </>
  );
}

export function WhatsAppPreview(props: WhatsAppPreviewProps) {
  const { type, text, options = [], listButtonLabel, media, packages = [], errorMessage, silentNote } = props;
  const asButtons = options.length <= 3 && options.every((o) => o.label.trim().length <= 20);
  const shown = options.filter((o) => o.label.trim());

  let body: ReactNode;
  if (silentNote) {
    body = <p className="mx-auto mt-6 max-w-[85%] rounded-md bg-[#FFF3C4] px-3 py-2 text-center text-[11px] text-[#54656F] shadow-sm">{silentNote}</p>;
  } else if (type === 'SEND_PACKAGE') {
    const p = packages[0];
    body = p ? (
      <Bubble className="p-1">
        {packagePhoto(p) && <img src={packagePhoto(p)!} alt="" className="mb-1 max-h-40 w-full rounded-md object-cover" />}
        <div className="px-1">
          <PackageCaption p={p} />
        </div>
      </Bubble>
    ) : (
      <Empty>Choose a package to see it here.</Empty>
    );
  } else if (type === 'CAROUSEL') {
    body =
      packages.length === 0 ? (
        <Empty>Choose packages to see the cards here.</Empty>
      ) : packages.length === 1 ? (
        <Bubble className="p-1">
          {packagePhoto(packages[0]) && <img src={packagePhoto(packages[0])!} alt="" className="mb-1 max-h-40 w-full rounded-md object-cover" />}
          <div className="px-1">
            <PackageCaption p={packages[0]} />
          </div>
        </Bubble>
      ) : (
        <>
          <Bubble>Take a look at these packages 👇</Bubble>
          <div className="-mr-3 mt-1.5 flex gap-2 overflow-x-auto pb-1 pr-3 [scrollbar-width:none]">
            {packages.map((p) => (
              <div key={p.id} className="w-44 shrink-0 overflow-hidden rounded-lg bg-white shadow-sm">
                {packagePhoto(p) ? (
                  <img src={packagePhoto(p)!} alt="" className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-slate-100 text-[10px] text-slate-500">Your logo</div>
                )}
                <div className="p-2 text-[12px] leading-snug">
                  <p className="font-semibold">{clip(p.name, 40)}</p>
                  <p className="text-black/70">
                    {p.days}D / {p.nights}N{p.priceAmount ? ` · ${money(p.priceAmount, p.priceCurrency)}` : ''}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1 border-t border-black/10 py-1.5 text-[12px] font-medium text-[#008069]">
                  <ExternalLink className="size-3" /> View package
                </div>
              </div>
            ))}
          </div>
        </>
      );
  } else {
    const hasText = !!text.trim();
    const withButtons = type === 'CONFIRM' && asButtons && shown.length > 0;
    const withList = type === 'CONFIRM' && !asButtons && shown.length > 0;
    body = (
      <>
        {/* A list can't carry media — it's sent just before. */}
        {media && withList && (
          <Bubble className="p-1">
            <MediaBlock media={media} />
          </Bubble>
        )}
        {(hasText || (media && !withList)) && (
          <div className={withList && media ? 'mt-1.5' : undefined}>
            <Bubble className={media && !withList ? 'p-1' : undefined}>
              {media && !withList && <MediaBlock media={media} />}
              {hasText && <div className={media && !withList ? 'px-1 pt-1' : undefined}>{formatWhatsApp(text)}</div>}
            </Bubble>
          </div>
        )}
        {!hasText && !media && <Empty>Type a message to see it here.</Empty>}
        {withButtons && (
          <div className="space-y-0.5">
            {shown.map((o, i) => (
              <ButtonRow key={i}>
                <Reply className="size-3.5" /> {o.label.trim()}
              </ButtonRow>
            ))}
          </div>
        )}
        {withList && (
          <>
            <ButtonRow>
              <List className="size-3.5" /> {listButtonLabel?.trim() || 'Choose an option'}
            </ButtonRow>
            <div className="mt-2 max-w-[88%] overflow-hidden rounded-lg bg-white text-[12px] shadow-sm">
              <p className="border-b border-black/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-black/45">Opens a menu</p>
              {shown.map((o, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-black/5 px-3 py-1.5 last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate">{clip(o.label.trim(), 24)}</span>
                    {(o.description || o.label.trim().length > 24) && (
                      <span className="block truncate text-[11px] text-black/50">{o.description || o.label.trim()}</span>
                    )}
                  </span>
                  <span className="size-3.5 shrink-0 rounded-full border-2 border-[#8696A0]" />
                </div>
              ))}
            </div>
          </>
        )}
        {errorMessage && (
          <>
            <div className="mt-2 flex justify-end">
              <div className="max-w-[80%] rounded-lg rounded-tr-none bg-[#D9FDD3] px-2 py-1.5 text-[13px] italic text-black/50 shadow-sm">
                an invalid answer
                <span className="ml-1 inline-flex align-bottom text-sky-500">
                  <CheckCheck className="size-3.5" />
                </span>
              </div>
            </div>
            <div className="mt-2">
              <Bubble>{formatWhatsApp(errorMessage)}</Bubble>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-[22px] border-[6px] border-slate-800 bg-slate-800 shadow-lg">
      <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2 text-white">
        <span className="flex size-7 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold">You</span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-tight">Your business</span>
          <span className="block text-[10px] text-white/70">Preview</span>
        </span>
      </div>
      <div className="flex-1 space-y-0 overflow-y-auto p-3" style={WALLPAPER}>
        {body}
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mx-auto mt-6 max-w-[85%] rounded-md bg-white/80 px-3 py-2 text-center text-[11px] text-[#54656F]">{children}</p>;
}
