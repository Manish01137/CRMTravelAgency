import type { TenantTx } from './prisma';

/**
 * Repeat-customer detection — shared by every place a Lead gets created
 * (manual add, WhatsApp/Instagram webhook, public enquiry form). Matches a
 * new lead's phone/email against existing Bookings in the same org; the
 * most recent match wins if there's more than one.
 */
export async function findRepeatCustomerBooking(
  tx: TenantTx,
  organizationId: string,
  phone: string | null | undefined,
  email: string | null | undefined,
) {
  if (!phone && !email) return null;
  return tx.booking.findFirst({
    where: {
      organizationId,
      OR: [...(phone ? [{ customerPhone: phone }] : []), ...(email ? [{ customerEmail: email }] : [])],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, bookingNumber: true, destination: true, totalAmount: true, currency: true, createdAt: true },
  });
}
