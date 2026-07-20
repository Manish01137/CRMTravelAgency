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
  bio: string | null;
  hostLinks: HostLink[];
  bannerImageUrl: string | null;
  aboutText: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  linktreeCoverUrl: string | null;
  linktreeTheme: LinktreeTheme;
  createdAt: string;
  updatedAt: string;
}

export interface SiteDeparture {
  id: string;
  name: string | null;
  departureDate: string;
  capacity: number;
  pricePerPerson: number;
  priceCurrency: string;
  pickupCity: string | null;
  packageId: string;
  packageName: string;
  destination: string;
  days: number;
  nights: number;
  coverImage: string | null;
}

export interface SitePayload {
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
    brandPrimaryColor: string;
    brandSecondaryColor: string;
    bio: string | null;
    hostLinks: HostLink[];
    bannerImageUrl: string | null;
    aboutText: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
  };
  packages: Omit<LinktreePackage, 'departures'>[];
  departures: SiteDeparture[];
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

export type PackageViewType =
  | 'CLASSIC'
  | 'MODERN'
  | 'MINIMAL'
  | 'ADVENTURE'
  | 'BEACH'
  | 'PILGRIMAGE'
  | 'ROMANCE'
  | 'WILDLIFE'
  | 'WEEKEND'
  | 'LUXURY'
  | 'BACKPACK'
  | 'FAMILY'
  | 'HILLS';

export interface PricingOption {
  label: string;
  price: number;
}
export interface PackageItineraryDay {
  day: number;
  title: string;
  description?: string;
  hotelId?: string;
  stay?: string;
  activities?: string[];
  meals?: string;
  images?: string[];
}
export interface PackageFaq {
  question: string;
  answer: string;
}

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

  code: string | null;
  slug: string | null;
  viewType: PackageViewType;
  categories: string[];
  bookingTitle: string | null;
  originalPrice: number | null;
  pricingOptions: PricingOption[];
  bannerImageUrl: string | null;
  whatsappBannerUrl: string | null;
  whatsappDescription: string | null;
  contactNumber: string | null;
  contactEmail: string | null;
  itinerary: PackageItineraryDay[];
  thingsToCarry: string | null;
  pickupPoints: string | null;
  cancellationPolicy: string | null;
  paymentTerms: string | null;
  termsConditions: string | null;
  faqs: PackageFaq[];
  highlights: string[];
  galleryImages: string[];
  showOnLinktree: boolean;
  categoryIds: string[];

  createdAt: string;
  updatedAt: string;
}

export interface ItineraryItem {
  id: string;
  bookingId: string;
  dayNumber: number;
  title: string;
  subtitle: string | null;
  city: string | null;
  country: string | null;
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
  batchId: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  package: { id: string; name: string } | null;
  lead: { id: string; name: string } | null;
  itineraryItems?: ItineraryItem[];
  itineraryDays?: number;
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

export interface HostLink {
  label: string;
  url: string;
}

export interface Hotel {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  address: string | null;
  starRating: number;
  phone: string | null;
  email: string | null;
  pricePerNight: number | null;
  currency: string;
  notes: string | null;
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LeadActivityType = 'NOTE' | 'CALL' | 'WHATSAPP' | 'EMAIL' | 'MEETING' | 'STATUS_CHANGE';

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  outcome: string | null;
  message: string | null;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

// --- LinkTree module ---------------------------------------------------------

export interface Category {
  id: string;
  organizationId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  packageCount?: number;
}

export type LinktreeFont = 'figtree' | 'playfair' | 'grotesk' | 'lora' | 'bebas';
export type LinktreeBackgroundType = 'color' | 'image' | 'video';

export interface LinktreeTheme {
  logoUrl?: string | null;
  agencyName?: string | null;
  shortBio?: string | null;
  instagramUrl?: string | null;
  whatsappNumber?: string | null;
  websiteUrl?: string | null;
  buttonColor?: string | null;
  fontChoice?: LinktreeFont;
  backgroundType?: LinktreeBackgroundType;
  backgroundColor?: string | null;
  backgroundImageUrl?: string | null;
  backgroundVideoUrl?: string | null;
  allowVideoOnMobile?: boolean;
}

export interface LinktreeModulePackage {
  id: string;
  name: string;
  destination: string;
  nights: number;
  days: number;
  priceAmount: number;
  priceCurrency: string;
  originalPrice: number | null;
  bannerImageUrl: string | null;
  categoryIds: string[];
  departures: string[];
}

export interface LinktreeModulePayload {
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
    brandPrimaryColor: string;
    linktreeTheme: LinktreeTheme;
  };
  categories: { id: string; name: string }[];
  packages: LinktreeModulePackage[];
}

export type LinktreePackage = Pick<
  TravelPackage,
  | 'id'
  | 'name'
  | 'destination'
  | 'nights'
  | 'days'
  | 'priceAmount'
  | 'priceCurrency'
  | 'originalPrice'
  | 'description'
  | 'bannerImageUrl'
  | 'categories'
> & { departures: string[] };

export interface HostPagePayload {
  name: string;
  slug: string;
  logoUrl: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  bio: string | null;
  contactNumber: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  linktreeCoverUrl: string | null;
  hostLinks: HostLink[];
  packages: LinktreePackage[];
}

export type EventStatus = 'DRAFT' | 'LIVE' | 'COMPLETED' | 'CANCELLED';

/** An Event = one dated departure of a package. */
export interface EventItem {
  id: string;
  packageId: string;
  packageName: string;
  destination: string;
  days: number;
  nights: number;
  coverImage: string | null;
  name: string | null;
  departureDate: string;
  returnDate: string | null;
  bookingCloseDate: string | null;
  capacity: number;
  pricePerPerson: number;
  priceCurrency: string;
  pickupCity: string | null;
  status: EventStatus;
  notes: string | null;
  booked: number;
}

export interface EventStats {
  liveEvents: number;
  totalEvents: number;
  todaysRevenue: number;
  todaysBookings: number;
  pendingSettlement: number;
}

export interface EventPassenger {
  id: string;
  bookingNumber: number;
  customerName: string;
  customerPhone: string | null;
  travelerCount: number | null;
  status: BookingStatus;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
}

export interface EventDetail {
  event: EventItem;
  seatsBooked: number;
  seatsRemaining: number;
  revenue: number;
  pending: number;
  bookings: EventPassenger[];
}

export interface SightseeingActivity {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  country: string;
  timings: string | null;
  points: number;
  imageUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
