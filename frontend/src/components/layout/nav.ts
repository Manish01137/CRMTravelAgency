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
  Route as RouteIcon,
  ReceiptText,
  Wallet,
  MapPinned,
  Globe,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

/** Primary sidebar navigation. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Contact2 },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck2 },
  { to: '/events', label: 'Events', icon: Ticket },
  { to: '/itineraries', label: 'Itineraries', icon: RouteIcon },
  { to: '/packages', label: 'Packages', icon: PackageIcon },
  { to: '/sightseeing', label: 'Activities', icon: MapPinned },
  { to: '/hotels', label: 'Hotels', icon: HotelIcon },
  { to: '/host-page', label: 'Host Page', icon: Globe, adminOnly: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/invoices', label: 'Invoices', icon: ReceiptText },
  { to: '/bills', label: 'Bills', icon: Wallet },
  { to: '/team', label: 'Team', icon: Users2, adminOnly: true },
];

export const SETTINGS_ITEMS: NavItem[] = [
  { to: '/settings/profile', label: 'My profile', icon: UserRound },
  { to: '/settings/organization', label: 'Organization', icon: Building2, adminOnly: true },
];
