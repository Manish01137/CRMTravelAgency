export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'DISABLED';
export type Role = 'ADMIN' | 'AGENT';

export interface PlatformStats {
  organizations: { total: number; suspended: number; newLast7d: number; newLast30d: number };
  users: { total: number; disabled: number };
  leads: { total: number };
  bookings: { total: number; totalValue: number };
  recentOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: OrganizationStatus;
    createdAt: string;
    _count: { users: number };
  }>;
}

export interface OwnerOrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  _count: { users: number; leads: number; bookings: number };
}

export interface OwnerOrganizationUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface OwnerOrganizationDetail extends Omit<OwnerOrganizationRow, '_count'> {
  users: OwnerOrganizationUser[];
  totalBookingValue: number;
  _count: { leads: number; bookings: number };
}

export interface OwnerUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string; status: OrganizationStatus };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OrganizationNote {
  id: string;
  organizationId: string;
  adminEmail: string;
  body: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  adminEmail: string;
  action: string;
  targetType: 'ORGANIZATION' | 'USER' | 'EXPENSE';
  targetId: string;
  targetLabel: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type ChannelType = 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL';

export interface ChannelHealth {
  summary: Record<ChannelType, Record<string, number>>;
  failedConnections: Array<{
    id: string;
    channel: ChannelType;
    status: string;
    displayName: string | null;
    lastError: string | null;
    connectedAt: string | null;
    updatedAt: string;
    organization: { id: string; name: string; slug: string };
  }>;
}

export interface GrowthWeek {
  weekStart: string;
  count: number;
}

export interface GrowthData {
  weeks: GrowthWeek[];
}

export interface SearchResults {
  organizations: Array<{ id: string; name: string; slug: string; status: OrganizationStatus }>;
  users: Array<{ id: string; name: string; email: string; organization: { id: string; name: string } }>;
  leads: Array<{ id: string; name: string; email: string | null; phone: string | null; organization: { id: string; name: string } }>;
  bookings: Array<{ id: string; bookingNumber: number; customerName: string; customerPhone: string | null; organization: { id: string; name: string } }>;
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'WON' | 'LOST';
export type LeadSource = 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'WEBSITE' | 'REFERRAL' | 'WALK_IN' | 'PHONE' | 'MANUAL' | 'OTHER';

export interface OwnerLeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: LeadSource;
  destination: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface OwnerBookingRow {
  id: string;
  bookingNumber: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  destination: string;
  status: BookingStatus;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  startDate: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
}

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planName: string;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  startedAt: string;
  renewsAt: string | null;
  notes: string | null;
}

export interface SubscriptionRow {
  organization: { id: string; name: string; slug: string; status: OrganizationStatus };
  subscription: OrganizationSubscription | null;
}

export type ExpenseCategory = 'HOSTING' | 'API_COSTS' | 'SOFTWARE' | 'MARKETING' | 'PAYROLL' | 'OTHER';

export interface PlatformExpense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  createdAt: string;
}

export interface RevenueData {
  mrr: number;
  currency: string;
  activeSubscriptions: number;
  byPlan: Record<string, { count: number; amount: number }>;
  subscriptions: Array<{ organizationName: string; planName: string; amount: number }>;
}

export interface ProfitData {
  mrr: number;
  totalExpenses: number;
  profit: number;
  currency: string;
  months: Array<{ month: string; expenses: number; revenue: number; profit: number }>;
}

export interface SystemHealth {
  database: { ok: boolean; latencyMs: number };
  redisConfigured: boolean;
  process: { uptimeSeconds: number; memoryUsedMb: number; nodeVersion: string; platform: string };
  checkedAt: string;
}
