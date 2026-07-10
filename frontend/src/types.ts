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
