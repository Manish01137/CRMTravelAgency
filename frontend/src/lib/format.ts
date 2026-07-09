import { format, formatDistanceToNow, parseISO } from 'date-fns';

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

/** Converts a date string to the value an <input type="date"> expects (yyyy-MM-dd). */
export function toDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}
