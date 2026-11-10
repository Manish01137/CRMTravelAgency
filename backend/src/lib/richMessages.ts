/**
 * Locations and contacts are stored as one bracketed line in Message.body, e.g.
 *   [Location — Hotel Snow View, Mall Road — https://maps.google.com/?q=32.24,77.18]
 *   [Shared contact: Ramesh Driver (+91 98765 43210)]
 * Brackets mark it as "not something typed" for the bots (isPlaceholderBody),
 * and the Inbox turns it back into a map / contact card. The same format is
 * written for locations / contacts customers send and ones we send.
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

/** Back from the stored line (null when it isn't one). */
export function parseLocationBody(body: string | null | undefined): SharedLocation | null {
  const m = body?.trim().match(/^\[Location(?: — (.+?))? — https:\/\/maps\.google\.com\/\?q=(-?[\d.]+),(-?[\d.]+)\]$/s);
  return m ? { latitude: Number(m[2]), longitude: Number(m[3]), name: m[1] ?? null } : null;
}

export function parseContactBody(body: string | null | undefined): SharedContact[] | null {
  const m = body?.trim().match(/^\[Shared contact: (.+)\]$/s);
  if (!m) return null;
  return m[1].split('; ').map((entry) => {
    const p = entry.match(/^(.*?)\s*\(([^)]*)\)$/);
    return p ? { name: p[1], phones: p[2].split(', ').filter(Boolean) } : { name: entry, phones: [] };
  });
}

/** What the chat list shows for one. */
export function richPreview(body: string): string | null {
  const loc = parseLocationBody(body);
  if (loc) return `📍 ${loc.name || 'Location'}`;
  if (/^\[Location\b/.test(body)) return '📍 Location';
  const people = parseContactBody(body);
  if (people) return `👤 ${people.map((p) => p.name).join(', ')}`;
  return null;
}
