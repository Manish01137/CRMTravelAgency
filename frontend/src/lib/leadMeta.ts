import {
  Camera,
  CircleDashed,
  Footprints,
  Globe,
  MessageCircle,
  PencilLine,
  Phone,
  Share2,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react';
import type { Lead, LeadSource, LeadStatus, Role, UserStatus } from '@/types';

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

/**
 * Per-status colour system. Every pipeline stage gets its own deliberate colour
 * (not a handful reused): used by the pipeline filter chips AND the status pill.
 *   chipIdle  — unselected filter chip
 *   chipActive — selected filter chip (filled)
 *   pill      — the status pill in the table
 *   dot       — the leading dot inside the pill
 */
export interface LeadStatusStyle {
  label: string;
  chipIdle: string;
  chipActive: string;
  pill: string;
  dot: string;
}

export const LEAD_STATUS_STYLES: Record<LeadStatus, LeadStatusStyle> = {
  NEW: {
    label: 'New',
    chipIdle: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100',
    chipActive: 'bg-blue-600 text-white ring-1 ring-inset ring-blue-600',
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
  },
  CONTACTED: {
    label: 'Contacted',
    chipIdle: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-100',
    chipActive: 'bg-violet-600 text-white ring-1 ring-inset ring-violet-600',
    pill: 'bg-violet-50 text-violet-700 ring-violet-200',
    dot: 'bg-violet-500',
  },
  QUALIFIED: {
    label: 'Qualified',
    chipIdle: 'bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-200 hover:bg-pink-100',
    chipActive: 'bg-pink-600 text-white ring-1 ring-inset ring-pink-600',
    pill: 'bg-pink-50 text-pink-700 ring-pink-200',
    dot: 'bg-pink-500',
  },
  PROPOSAL_SENT: {
    label: 'Proposal sent',
    chipIdle: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100',
    chipActive: 'bg-amber-500 text-white ring-1 ring-inset ring-amber-500',
    pill: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
  },
  NEGOTIATION: {
    label: 'Negotiation',
    chipIdle: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 hover:bg-orange-100',
    chipActive: 'bg-orange-500 text-white ring-1 ring-inset ring-orange-500',
    pill: 'bg-orange-50 text-orange-700 ring-orange-200',
    dot: 'bg-orange-500',
  },
  WON: {
    label: 'Won',
    chipIdle: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100',
    chipActive: 'bg-emerald-600 text-white ring-1 ring-inset ring-emerald-600',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  LOST: {
    label: 'Lost',
    chipIdle: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-200',
    chipActive: 'bg-slate-600 text-white ring-1 ring-inset ring-slate-600',
    pill: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
  },
};

/** Per-channel styling: WhatsApp = green, Instagram = gradient, rest = neutral. */
export interface LeadSourceStyle {
  label: string;
  Icon: LucideIcon;
  badge: string;
}

export const LEAD_SOURCE_STYLES: Record<LeadSource, LeadSourceStyle> = {
  WHATSAPP: { label: 'WhatsApp', Icon: MessageCircle, badge: 'bg-green-50 text-green-700 ring-green-200' },
  INSTAGRAM: {
    label: 'Instagram',
    Icon: Camera,
    badge: 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 text-white ring-0 shadow-sm',
  },
  FACEBOOK: { label: 'Facebook', Icon: ThumbsUp, badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  WEBSITE: { label: 'Website', Icon: Globe, badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  REFERRAL: { label: 'Referral', Icon: Share2, badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  WALK_IN: { label: 'Walk-in', Icon: Footprints, badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  PHONE: { label: 'Phone', Icon: Phone, badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  MANUAL: { label: 'Manual', Icon: PencilLine, badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
  OTHER: { label: 'Other', Icon: CircleDashed, badge: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = (
  Object.keys(LEAD_SOURCE_STYLES) as LeadSource[]
).map((value) => ({ value, label: LEAD_SOURCE_STYLES[value].label }));

const statusMap = new Map(LEAD_STATUSES.map((s) => [s.value, s]));

export function leadStatusMeta(status: LeadStatus): { label: string; variant: BadgeVariant } {
  return statusMap.get(status) ?? { label: status, variant: 'muted' };
}

export function leadStatusStyle(status: LeadStatus): LeadStatusStyle {
  return LEAD_STATUS_STYLES[status];
}

export function leadSourceStyle(source: LeadSource): LeadSourceStyle {
  return LEAD_SOURCE_STYLES[source] ?? LEAD_SOURCE_STYLES.OTHER;
}

export function leadSourceLabel(source: LeadSource): string {
  return leadSourceStyle(source).label;
}

// --- Lead temperature (priority) ------------------------------------------
// PLACEHOLDER VISUAL ONLY. Phase 1 has no `temperature`/`priority` field on Lead,
// so this is derived from the pipeline stage purely so the row-tinting treatment
// is visible. A real, editable field is a later-phase backend change — do not
// treat this as business logic.
export type LeadTemperature = 'HOT' | 'WARM';

export interface TemperatureStyle {
  key: LeadTemperature;
  label: string;
  rowClass: string; // table <tr> background tint
  accentCell: string; // left-accent applied to the first <td>
  cardClass: string; // mobile card border + tint
  pill: string; // small label chip
}

const TEMPERATURE_STYLES: Record<LeadTemperature, TemperatureStyle> = {
  HOT: {
    key: 'HOT',
    label: 'Hot',
    rowClass: 'bg-amber-50/60 hover:bg-amber-50',
    accentCell: 'border-l-[3px] border-l-amber-400',
    cardClass: 'border-l-4 border-l-amber-400 bg-amber-50/50',
    pill: 'bg-amber-100 text-amber-700 ring-amber-200',
  },
  WARM: {
    key: 'WARM',
    label: 'Warm',
    rowClass: 'bg-sky-50/50 hover:bg-sky-50',
    accentCell: 'border-l-[3px] border-l-sky-400',
    cardClass: 'border-l-4 border-l-sky-400 bg-sky-50/40',
    pill: 'bg-sky-100 text-sky-700 ring-sky-200',
  },
};

export function leadTemperature(lead: Lead): TemperatureStyle | null {
  if (lead.status === 'NEGOTIATION' || lead.status === 'PROPOSAL_SENT') return TEMPERATURE_STYLES.HOT;
  if (lead.status === 'QUALIFIED' || lead.status === 'CONTACTED') return TEMPERATURE_STYLES.WARM;
  return null;
}

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', AGENT: 'Agent' };

export const USER_STATUS_META: Record<UserStatus, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  INVITED: { label: 'Invited', variant: 'warning' },
  DISABLED: { label: 'Disabled', variant: 'muted' },
};
