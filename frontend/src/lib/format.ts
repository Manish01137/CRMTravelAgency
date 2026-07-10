import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return '—';
  }
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'd MMM yyyy, HH:mm');
  } catch {
    return '—';
  }
}

export function fromNow(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const result = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return result || '?';
}

export function formatCurrency(amount?: number | null, currency = 'USD'): string {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** "Today at 01:29 AM" / "Yesterday at 02:45 PM" / "12 Jan at 09:10 AM". */
export function formatSmartTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = parseISO(iso);
    if (isToday(d)) return `Today at ${format(d, 'hh:mm a')}`;
    if (isYesterday(d)) return `Yesterday at ${format(d, 'hh:mm a')}`;
    return format(d, "d MMM 'at' hh:mm a");
  } catch {
    return '—';
  }
}

/** Short travel-date form like "Mon, 12th Jan". */
export function formatTravelDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'EEE, do MMM');
  } catch {
    return '—';
  }
}

/** Compact display id from a UUID (first 8 chars, uppercased). */
export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Converts a date string to the value an <input type="date"> expects (yyyy-MM-dd). */
export function toDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}
