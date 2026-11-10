import { toast } from 'sonner';
import { Copy, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/share';

/**
 * Locations and contacts are stored as one bracketed line (same format as the
 * backend's lib/richMessages.ts) and shown here as cards:
 *   [Location — Hotel Snow View, Mall Road — https://maps.google.com/?q=32.24,77.18]
 *   [Shared contact: Ramesh Driver (+91 98765 43210)]
 */

export interface SharedLocation {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
}
export interface SharedContact {
  name: string;
  phones: string[];
}

export const mapsLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat},${lng}`;

export function locationBody(l: SharedLocation): string {
  const where = [l.name, l.address].map((s) => s?.trim()).filter(Boolean).join(', ');
  return `[${['Location', where, mapsLink(l.latitude, l.longitude)].filter(Boolean).join(' — ')}]`;
}

export function contactBody(people: SharedContact[]): string {
  const list = people.map((p) => (p.phones.length ? `${p.name} (${p.phones.join(', ')})` : p.name)).join('; ');
  return `[Shared contact${list ? `: ${list}` : ''}]`;
}

export function parseLocation(body: string | null | undefined): (SharedLocation & { url: string }) | null {
  const m = body?.trim().match(/^\[Location(?: — (.+?))? — (https:\/\/maps\.google\.com\/\?q=(-?[\d.]+),(-?[\d.]+))\]$/s);
  return m ? { latitude: Number(m[3]), longitude: Number(m[4]), name: m[1] ?? null, url: m[2] } : null;
}

export function parseContacts(body: string | null | undefined): SharedContact[] | null {
  const m = body?.trim().match(/^\[Shared contact: (.+)\]$/s);
  if (!m) return null;
  return m[1].split('; ').map((entry) => {
    const p = entry.match(/^(.*?)\s*\(([^)]*)\)$/);
    return p ? { name: p[1], phones: p[2].split(', ').filter(Boolean) } : { name: entry, phones: [] };
  });
}

/** One line for a quote / preview, or null when it isn't a location / contact. */
export function richSummary(body: string | null | undefined): string | null {
  const loc = parseLocation(body);
  if (loc) return `📍 ${loc.name || 'Location'}`;
  const people = parseContacts(body);
  return people ? `👤 ${people.map((p) => p.name).join(', ')}` : null;
}

/** What Copy puts on the clipboard for one. */
export function richCopyText(body: string | null | undefined): string | null {
  const loc = parseLocation(body);
  if (loc) return [loc.name, loc.url].filter(Boolean).join('\n');
  const people = parseContacts(body);
  return people ? people.map((p) => `${p.name}: ${p.phones.join(', ')}`).join('\n') : null;
}

/** A map pin card: opens Google Maps. */
export function LocationCard({ location, tone }: { location: SharedLocation & { url: string }; tone: 'wa' | 'ig-out' | 'ig-in' }) {
  return (
    <a
      href={location.url}
      target="_blank"
      rel="noreferrer"
      title="Open in Google Maps"
      className={cn('-mx-1 mb-1 block w-[240px] max-w-full overflow-hidden rounded-[6px] transition-opacity hover:opacity-90', tone === 'ig-out' ? 'bg-white/15' : 'bg-black/[0.04]')}
    >
      {/* A drawn "map" — no map service or key needed. */}
      <div className="relative h-[110px] overflow-hidden bg-[#e8f0e2]">
        <svg viewBox="0 0 240 110" className="absolute inset-0 size-full" aria-hidden>
          <rect width="240" height="110" fill="#e9efe3" />
          <path d="M0 78 Q60 60 120 72 T240 58" stroke="#ffffff" strokeWidth="9" fill="none" />
          <path d="M70 0 Q80 50 60 110" stroke="#ffffff" strokeWidth="7" fill="none" />
          <path d="M170 0 Q160 40 190 110" stroke="#fdf6d8" strokeWidth="6" fill="none" />
          <circle cx="198" cy="26" r="16" fill="#cfe3c4" />
          <rect x="18" y="14" width="34" height="22" rx="3" fill="#dde6d4" />
        </svg>
        <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[85%] flex-col items-center">
          <MapPin className="size-9 fill-[#ea4335] text-[#a52714] drop-shadow" strokeWidth={1.4} />
        </span>
      </div>
      <div className="px-2.5 py-1.5">
        <p className={cn('truncate text-[13.5px] font-medium', tone === 'ig-out' ? 'text-white' : 'text-[#111b21]')}>{location.name || 'Shared location'}</p>
        <p className={cn('text-[11.5px]', tone === 'ig-out' ? 'text-white/80' : 'text-[#027eb5]')}>Open in Google Maps</p>
      </div>
    </a>
  );
}

/** A contact card: name, number(s), call / copy. */
export function ContactCard({ people, tone }: { people: SharedContact[]; tone: 'wa' | 'ig-out' | 'ig-in' }) {
  const onDark = tone === 'ig-out';
  return (
    <div className="mb-1 w-[240px] max-w-full space-y-1.5">
      {people.map((p, i) => (
        <div key={i} className={cn('rounded-[6px] p-2', onDark ? 'bg-white/15' : 'bg-black/[0.04]')}>
          <div className="flex items-center gap-2.5">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold', onDark ? 'bg-white/25 text-white' : 'bg-[#dfe5e7] text-[#54656f]')}>
              {p.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join('')}
            </span>
            <div className="min-w-0">
              <p className={cn('truncate text-[14px] font-medium', onDark ? 'text-white' : 'text-[#111b21]')}>{p.name}</p>
              {p.phones.map((ph) => (
                <p key={ph} className={cn('truncate text-[12.5px]', onDark ? 'text-white/85' : 'text-[#667781]')}>
                  {ph}
                </p>
              ))}
            </div>
          </div>
          {p.phones[0] && (
            <div className={cn('mt-2 grid grid-cols-2 border-t pt-1.5 text-center text-[12.5px] font-medium', onDark ? 'border-white/25 text-white' : 'border-black/10 text-[#027eb5]')}>
              <a href={`tel:${p.phones[0].replace(/[^\d+]/g, '')}`} className="flex items-center justify-center gap-1 rounded py-0.5 hover:bg-black/5">
                <Phone className="size-3.5" /> Call
              </a>
              <button
                type="button"
                onClick={async () => ((await copyToClipboard(p.phones[0])) ? toast.success('Number copied') : toast.error('Could not copy'))}
                className="flex items-center justify-center gap-1 rounded py-0.5 hover:bg-black/5"
              >
                <Copy className="size-3.5" /> Copy number
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
