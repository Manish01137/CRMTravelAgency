import { formatCurrency } from '@/lib/format';
import type { TravelPackage } from '@/types';

/** Public, login-free brochure link for a package (the shareable URL). */
export function brochureUrl(packageId: string): string {
  return `${window.location.origin}/p/${packageId}`;
}

/** WhatsApp deep link with a ready-to-send pitch + brochure link. */
export function packageWhatsAppUrl(
  pkg: Pick<TravelPackage, 'id' | 'name' | 'destination' | 'days' | 'nights' | 'priceAmount' | 'priceCurrency'>,
  phone?: string | null,
): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const text = [
    `*${pkg.name}* — ${pkg.destination}`,
    `${pkg.days}D / ${pkg.nights}N · from ${formatCurrency(pkg.priceAmount, pkg.priceCurrency)}`,
    '',
    `Full details & itinerary: ${brochureUrl(pkg.id)}`,
  ].join('\n');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Copy text to the clipboard; resolves true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
