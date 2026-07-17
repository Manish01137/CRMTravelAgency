import {
  LayoutDashboard,
  Users2,
  Building2,
  UserRound,
  Contact2,
  CalendarCheck2,
  Package as PackageIcon,
  CalendarDays,
  Hotel as HotelIcon,
  ListChecks,
  Route as RouteIcon,
  ReceiptText,
  Wallet,
  MapPinned,
  Globe,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Shows a live count badge (e.g. follow-ups due) next to the label. */
  badge?: 'dueTasks';
}

/** Primary sidebar navigation. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Contact2 },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck2 },
  { to: '/itineraries', label: 'Itineraries', icon: RouteIcon },
  { to: '/packages', label: 'Packages', icon: PackageIcon },
  { to: '/sightseeing', label: 'Sightseeing', icon: MapPinned },
  { to: '/hotels', label: 'Hotels', icon: HotelIcon },
  { to: '/host-page', label: 'Host Page', icon: Globe, adminOnly: true },
  { to: '/tasks', label: 'Follow-ups', icon: ListChecks, badge: 'dueTasks' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/invoices', label: 'Invoices', icon: ReceiptText },
  { to: '/bills', label: 'Bills', icon: Wallet },
  { to: '/team', label: 'Team', icon: Users2, adminOnly: true },
];

export const SETTINGS_ITEMS: NavItem[] = [
  { to: '/settings/profile', label: 'My profile', icon: UserRound },
  { to: '/settings/organization', label: 'Organization', icon: Building2, adminOnly: true },
];
