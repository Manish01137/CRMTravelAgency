import type { Request } from 'express';
import type { Prisma, Role } from '@prisma/client';
import { withTenant } from './prisma';
import { NotFound } from './errors';

/**
 * Who can see which leads and chats: an admin sees everything in the
 * organization; an agent only the leads assigned to them, and the WhatsApp /
 * Instagram chats of those leads (a chat is assigned through its lead).
 * Anything else answers "not found", same as another organization's data.
 */
export interface Viewer {
  userId: string;
  role: Role;
}

export const viewerOf = (req: Request): Viewer => ({ userId: req.auth!.userId, role: req.auth!.role });

export const seesEverything = (viewer: Viewer) => viewer.role === 'ADMIN';

export const leadScope = (viewer: Viewer): Prisma.LeadWhereInput => (seesEverything(viewer) ? {} : { assignedToId: viewer.userId });

export const conversationScope = (viewer: Viewer): Prisma.ConversationWhereInput =>
  seesEverything(viewer) ? {} : { lead: { assignedToId: viewer.userId } };

export async function assertLeadVisible(organizationId: string, viewer: Viewer, leadId: string): Promise<void> {
  if (seesEverything(viewer)) return;
  const visible = await withTenant(organizationId, (tx) => tx.lead.count({ where: { id: leadId, ...leadScope(viewer) } }));
  if (!visible) throw NotFound('Lead not found');
}

export async function assertConversationVisible(organizationId: string, viewer: Viewer, conversationId: string): Promise<void> {
  if (seesEverything(viewer)) return;
  const visible = await withTenant(organizationId, (tx) =>
    tx.conversation.count({ where: { id: conversationId, ...conversationScope(viewer) } }),
  );
  if (!visible) throw NotFound('Conversation not found');
}

/** An agent's bookings: assigned to them, or made from one of their leads. Invoices and bills follow their booking. */
export const bookingScope = (viewer: Viewer): Prisma.BookingWhereInput =>
  seesEverything(viewer) ? {} : { OR: [{ assignedToId: viewer.userId }, { lead: { assignedToId: viewer.userId } }] };

export const invoiceScope = (viewer: Viewer): Prisma.InvoiceWhereInput => (seesEverything(viewer) ? {} : { booking: bookingScope(viewer) });

export const billScope = (viewer: Viewer): Prisma.BillWhereInput => (seesEverything(viewer) ? {} : { booking: bookingScope(viewer) });

export async function assertBookingVisible(organizationId: string, viewer: Viewer, bookingId: string): Promise<void> {
  if (seesEverything(viewer)) return;
  const visible = await withTenant(organizationId, (tx) => tx.booking.count({ where: { id: bookingId, ...bookingScope(viewer) } }));
  if (!visible) throw NotFound('Booking not found');
}

export async function assertInvoiceVisible(organizationId: string, viewer: Viewer, invoiceId: string): Promise<void> {
  if (seesEverything(viewer)) return;
  const visible = await withTenant(organizationId, (tx) => tx.invoice.count({ where: { id: invoiceId, ...invoiceScope(viewer) } }));
  if (!visible) throw NotFound('Invoice not found');
}

export async function assertBillVisible(organizationId: string, viewer: Viewer, billId: string): Promise<void> {
  if (seesEverything(viewer)) return;
  const visible = await withTenant(organizationId, (tx) => tx.bill.count({ where: { id: billId, ...billScope(viewer) } }));
  if (!visible) throw NotFound('Bill not found');
}
