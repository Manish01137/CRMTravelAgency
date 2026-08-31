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
  | 'OTHER'
  | 'GOOGLE_ADS'
  | 'GOOGLE_MY_BUSINESS'
  | 'YOUTUBE'
  | 'EMAIL'
  | 'JUSTDIAL'
  | 'EXHIBITION';

export type CustomerType = 'B2C' | 'B2B' | 'CORPORATE' | 'VIP';

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
  hostGallery: string[];
  defaultCancellationPolicy: string | null;
  defaultPaymentTerms: string | null;
  defaultTermsConditions: string | null;
  // Tax invoice details — printed on the invoice header/footer.
  secondaryPhone: string | null;
  secondaryEmail: string | null;
  stateName: string | null;
  stateCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  ifscCode: string | null;
  gstin: string | null;
  pan: string | null;
  hsnCode: string | null;
  signatureImageUrl: string | null;
  signatoryTitle: string | null;
  invoiceTermsConditions: string | null;
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

export interface HostReview {
  id: string;
  organizationId?: string;
  reviewerName: string;
  photoUrl: string | null;
  quote: string;
  rating: number | null;
  sortOrder?: number;
  createdAt?: string;
}

export interface SiteTeamMember {
  id: string;
  name: string;
  photoUrl: string | null;
  title: string | null;
  bio: string | null;
}

export interface SitePackage {
  id: string;
  name: string;
  destination: string;
  nights: number;
  days: number;
  priceAmount: number;
  priceCurrency: string;
  originalPrice: number | null;
  bannerImageUrl: string | null;
}

export interface SitePayload {
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
    brandPrimaryColor: string;
    brandSecondaryColor: string;
    bio: string | null;
    bannerImageUrl: string | null;
    aboutText: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
    instagramUrl: string | null;
    whatsappNumber: string | null;
  };
  packages: SitePackage[];
  reviews: Omit<HostReview, 'organizationId' | 'sortOrder' | 'createdAt'>[];
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  featureOnHostpage: boolean;
  publicPhotoUrl: string | null;
  publicTitle: string | null;
  publicBio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignedAgent {
  id: string;
  name: string;
  email: string;
}

export interface RepeatCustomerBooking {
  id: string;
  bookingNumber: number;
  destination: string;
  totalAmount: number;
  currency: string;
}

export interface Lead {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  customerType: CustomerType;
  destination: string | null;
  travelDate: string | null;
  travelerCount: number | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  notes: string | null;
  assignedToId: string | null;
  assignedTo: AssignedAgent | null;
  packageId: string | null;
  package: { id: string; name: string; destination: string } | null;
  // Phase 4 (Bot Flow) — set when an inbound message matched a "Needs Review"
  // keyword; the bot stopped and handed off to a human.
  needsReview: boolean;
  needsReviewReason: string | null;
  // Set at creation if this lead's phone/email matched an existing booking.
  isRepeatCustomer: boolean;
  repeatBooking: RepeatCustomerBooking | null;
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

/** The package PDF brochure has a single fixed design — every package uses it. */
export type PdfTemplateId = 'signature';

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
  /** Optional — lets the brochure split pricing into standard vs. a peak-season
   *  block (e.g. Christmas/New Year). Defaults to standard when omitted. */
  season?: 'STANDARD' | 'PEAK';
}
/** An activity copied from the Sightseeing library into one day of one package. */
export interface DayActivityBlock {
  name: string;
  description?: string;
  imageUrl?: string;
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
  activityBlocks?: DayActivityBlock[];
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
  showOnHostpage: boolean;
  pdfTemplateId: PdfTemplateId;
  linktreeCategoryIds: string[];

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
  // True when created automatically (a Lead was marked WON) rather than via
  // the manual "Convert to booking" action.
  autoCreated: boolean;
  assignedTo: { id: string; name: string; email: string } | null;
  package: { id: string; name: string } | null;
  lead: { id: string; name: string } | null;
  batch: { id: string; name: string | null; departureDate: string } | null;
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
  // Tax-invoice extras — optional, rendered only when present.
  fromDate?: string | null;
  toDate?: string | null;
  sharingCapacity?: string | null;
}

export interface Invoice {
  id: string;
  organizationId: string;
  invoiceNumber: number;
  bookingId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCompanyName: string | null;
  customerAddress: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  advanceAmount: number;
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

export interface LinktreeCategory {
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
  linktreeCategoryIds: string[];
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

// --- Phase 3: Communication ---------------------------------------------------

export type ChannelType = 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL';
export type ChannelConnectionStatus = 'NOT_CONNECTED' | 'CONNECTED' | 'FAILED';

export interface ChannelStatus {
  channel: ChannelType;
  status: ChannelConnectionStatus;
  displayName: string | null;
  lastError: string | null;
  connectedAt: string | null;
}

export interface ChannelsPlatformConfig {
  whatsappEnabled: boolean;
  instagramEnabled: boolean;
  emailEnabled: boolean;
  metaAppId: string | null;
  metaGraphVersion: string | null;
  whatsappConfigId: string | null;
}

/** One Facebook Page + its linked Instagram account — shown in the picker when more than one matches. */
export interface InstagramPageOption {
  pageId: string;
  pageName: string;
  instagramBusinessAccountId: string;
  instagramUsername: string;
  pageAccessToken: string;
}

export type ConnectInstagramResult =
  | { status: 'connected'; channel: ChannelStatus }
  | { status: 'needs_selection'; options: InstagramPageOption[] };

export type ConversationChannel = 'WHATSAPP' | 'INSTAGRAM';

export interface Conversation {
  id: string;
  organizationId: string;
  channel: ConversationChannel;
  externalContactId: string;
  contactName: string | null;
  contactPhone: string | null;
  leadId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastInboundAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface ChannelMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  externalMessageId: string | null;
  body: string | null;
  mediaUrl: string | null;
  templateName: string | null;
  status: MessageStatus;
  errorMessage: string | null;
  sentById: string | null;
  createdAt: string;
}

export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  bodyText: string;
  status: TemplateStatus;
  externalTemplateId: string | null;
  createdAt: string;
}

export type CommChannel = 'EMAIL';
export type CommStatus = 'SENT' | 'FAILED';

export interface CommunicationLog {
  id: string;
  leadId: string;
  channel: CommChannel;
  toAddress: string;
  subject: string | null;
  body: string;
  status: CommStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentById: string | null;
  createdAt: string;
}

/** One row of the org-wide Call Log — a LeadActivity of type CALL, with its lead + author joined in. */
export interface CallLogEntry {
  id: string;
  outcome: string | null;
  message: string | null;
  createdAt: string;
  lead: { id: string; name: string; phone: string | null } | null;
  createdBy: { id: string; name: string } | null;
}

// --- Phase 4: Automation & AI -------------------------------------------------

export type BotFlowStepType = 'COLLECT' | 'CONFIRM' | 'CLOSING';
export type BotFlowSessionStatus = 'ACTIVE' | 'COMPLETED' | 'NEEDS_REVIEW';
export type FollowUpStatus = 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED';

/** Which existing Lead field a COLLECT step writes its answer into. */
export type BotFlowLeadField = 'name' | 'email' | 'phone' | 'destination' | 'travelDate' | 'travelerCount' | 'notes';

export interface BotFlowConfirmOption {
  label: string;
  nextStepId: string | null;
}

export interface BotFlowStep {
  id: string;
  flowId: string;
  type: BotFlowStepType;
  order: number;
  question: string | null;
  leadField: BotFlowLeadField | null;
  options: BotFlowConfirmOption[] | null;
  nextStepId: string | null;
  canvasX: number | null;
  canvasY: number | null;
}

export interface BotFlow {
  id: string;
  organizationId: string;
  name: string;
  fallbackMessage: string;
  needsReviewKeywords: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { steps: number; assignments: number };
}

export interface BotFlowDetail extends BotFlow {
  steps: BotFlowStep[];
}

export interface BotFlowAssignment {
  id: string;
  channel: ConversationChannel;
  flowId: string;
  flow: { id: string; name: string; isActive: boolean };
}

export interface AiAgentSettings {
  systemPrompt: string | null;
  agencyFacts: string | null;
  tone: string | null;
  hasGeminiKey: boolean;
  updatedAt: string | null;
}

export interface AutomationSettingsData {
  enabled: boolean;
  delayHours: number;
  nudgeMessage: string | null;
}

export interface FollowUpAttempt {
  id: string;
  leadId: string;
  channel: string;
  scheduledFor: string;
  status: FollowUpStatus;
  reason: string | null;
  createdAt: string;
  lead: { id: string; name: string } | null;
}
