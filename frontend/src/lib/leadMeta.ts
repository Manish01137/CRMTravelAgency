import type { LeadSource, LeadStatus, Role, UserStatus } from '@/types';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'
  | 'muted'
  | 'outline';

export const LEAD_STATUSES: { value: LeadStatus; label: string; variant: BadgeVariant }[] = [
  { value: 'NEW', label: 'New', variant: 'info' },
  { value: 'CONTACTED', label: 'Contacted', variant: 'default' },
  { value: 'QUALIFIED', label: 'Qualified', variant: 'default' },
  { value: 'PROPOSAL_SENT', label: 'Proposal sent', variant: 'warning' },
  { value: 'NEGOTIATION', label: 'Negotiation', variant: 'warning' },
  { value: 'WON', label: 'Won', variant: 'success' },
  { value: 'LOST', label: 'Lost', variant: 'destructive' },
];

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'OTHER', label: 'Other' },
];

const statusMap = new Map(LEAD_STATUSES.map((s) => [s.value, s]));
const sourceMap = new Map(LEAD_SOURCES.map((s) => [s.value, s]));

export function leadStatusMeta(status: LeadStatus): { label: string; variant: BadgeVariant } {
  return statusMap.get(status) ?? { label: status, variant: 'muted' };
}

export function leadSourceLabel(source: LeadSource): string {
  return sourceMap.get(source)?.label ?? source;
}

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', AGENT: 'Agent' };

export const USER_STATUS_META: Record<UserStatus, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  INVITED: { label: 'Invited', variant: 'warning' },
  DISABLED: { label: 'Disabled', variant: 'muted' },
};
