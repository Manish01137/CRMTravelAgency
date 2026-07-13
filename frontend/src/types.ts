// Shapes returned by the API (mirror of the Prisma models, JSON-serialized).

export type Role = 'ADMIN' | 'AGENT';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'DISABLED';

export type LeadSource =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'WEBSITE'
  | 'REFERRAL'
  | 'WALK_IN'
  | 'PHONE'
  | 'MANUAL'
  | 'OTHER';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'PROPOSAL_SENT'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignedAgent {
  id: string;
  name: string;
  email: string;
}

export interface Lead {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  destination: string | null;
  travelDate: string | null;
  travelerCount: number | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  notes: string | null;
  assignedToId: string | null;
  assignedTo: AssignedAgent | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  invitedById: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadStats {
  total: number;
  open: number;
  won: number;
  lost: number;
  newThisWeek: number;
  newToday: number;
  byStatus: Record<string, number>;
}

// --- Phase 2 -----------------------------------------------------------------

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type TaskType = 'FOLLOW_UP' | 'CALL' | 'MEETING' | 'OTHER';
export type TaskStatus = 'PENDING' | 'DONE';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type BillCategory = 'HOTEL' | 'FLIGHT' | 'TRANSPORT' | 'ACTIVITY' | 'VISA' | 'FOOD' | 'OTHER';
export type BillStatus = 'UNPAID' | 'PAID';

export interface TravelPackage {
  id: string;
  organizationId: string;
  name: string;
  destination: string;
  nights: number;
  days: number;
  priceAmount: number;
  priceCurrency: string;
  description: string | null;
  inclusions: string | null;
  exclusions: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItineraryItem {
  id: string;
  bookingId: string;
  dayNumber: number;
  title: string;
  description: string | null;
}

export interface Booking {
  id: string;
  organizationId: string;
  bookingNumber: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  travelerCount: number | null;
  status: BookingStatus;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  notes: string | null;
  leadId: string | null;
  packageId: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  package: { id: string; name: string } | null;
  lead: { id: string; name: string } | null;
  itineraryItems?: ItineraryItem[];
  invoices?: Invoice[];
  bills?: Bill[];
  createdAt: string;
  updatedAt: string;
}

export interface BookingStats {
  total: number;
  byStatus: Record<string, number>;
  departingThisMonth: number;
  totalValue: number;
  totalCollected: number;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  type: TaskType;
  status: TaskStatus;
  dueAt: string;
  leadId: string | null;
  bookingId: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  lead: { id: string; name: string } | null;
  booking: { id: string; customerName: string; bookingNumber: number } | null;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  notes: string | null;
  color: string;
}

export interface CalendarFeed {
  events: CalendarEvent[];
  departures: { id: string; bookingNumber: number; customerName: string; destination: string; startDate: string; status: BookingStatus }[];
  returns: { id: string; bookingNumber: number; customerName: string; destination: string; endDate: string; status: BookingStatus }[];
  tasks: { id: string; title: string; dueAt: string; status: TaskStatus; type: TaskType }[];
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  invoiceNumber: number;
  bookingId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes: string | null;
  booking?: { id: string; bookingNumber: number; destination: string } | null;
  createdAt: string;
}

export interface Bill {
  id: string;
  bookingId: string | null;
  vendorName: string;
  category: BillCategory;
  amount: number;
  currency: string;
  billDate: string;
  status: BillStatus;
  notes: string | null;
  booking?: { id: string; bookingNumber: number; customerName: string } | null;
}

export interface AuthResponse {
  token: string;
  user: User;
  organization: Organization;
}

export interface SessionResponse {
  user: User;
  organization: Organization;
}

export interface InvitePreview {
  email: string;
  organizationName: string;
  role: Role;
}

export interface InviteResult {
  invitation: Invitation;
  token: string;
  acceptUrl: string;
}
