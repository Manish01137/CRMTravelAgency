/**
 * True when the search text appears in any of the fields (case-insensitive).
 * Phone numbers also match ignoring spaces / + / dashes, so "98765 43" finds
 * "+91 98765-43210". Several words must each match somewhere: "rahul call"
 * finds Rahul's call tasks.
 */
export function matchesSearch(search: string, fields: (string | null | undefined)[]): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const present = fields.filter((f): f is string => !!f);
  const text = present.join(' ').toLowerCase();
  if (text.includes(q)) return true;
  const qDigits = q.replace(/\D/g, '');
  if (qDigits.length >= 3 && /^[\d\s+()-]+$/.test(q)) return present.some((f) => f.replace(/\D/g, '').includes(qDigits));
  const words = q.split(/\s+/).filter(Boolean);
  return words.length > 1 && words.every((w) => text.includes(w));
}
