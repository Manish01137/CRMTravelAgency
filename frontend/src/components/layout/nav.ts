import { LayoutDashboard, Users2, Building2, UserRound, Contact2, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

/** Primary sidebar navigation. Phase 2+ sections (Bookings, Packages, …) slot in here. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Contact2 },
  { to: '/team', label: 'Team', icon: Users2, adminOnly: true },
];

export const SETTINGS_ITEMS: NavItem[] = [
  { to: '/settings/profile', label: 'My profile', icon: UserRound },
  { to: '/settings/organization', label: 'Organization', icon: Building2, adminOnly: true },
];
