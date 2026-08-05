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
  Globe2,
  Ticket,
  ListChecks,
  Inbox,
  Send,
  PhoneCall,
  Plug,
  Workflow,
  Bot,
  Zap,
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
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/communications', label: 'Communications', icon: Send },
  { to: '/call-log', label: 'Call Log', icon: PhoneCall },
  { to: '/bot-flows', label: 'Bot Flows', icon: Workflow, adminOnly: true },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck2 },
  { to: '/events', label: 'Events', icon: Ticket },
  { to: '/itineraries', label: 'Itineraries', icon: RouteIcon },
  { to: '/packages', label: 'Packages', icon: PackageIcon },
  { to: '/sightseeing', label: 'Sightseeing', icon: MapPinned },
  { to: '/hotels', label: 'Hotels', icon: HotelIcon },
  { to: '/website', label: 'Host Page', icon: Globe2, adminOnly: true },
  { to: '/linktree', label: 'LinkTree', icon: Globe, adminOnly: true },
  { to: '/tasks', label: 'Follow-ups', icon: ListChecks },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/invoices', label: 'Invoices', icon: ReceiptText },
  { to: '/bills', label: 'Bills', icon: Wallet },
  { to: '/team', label: 'Team', icon: Users2, adminOnly: true },
];

export const SETTINGS_ITEMS: NavItem[] = [
  { to: '/settings/profile', label: 'My profile', icon: UserRound },
  { to: '/settings/organization', label: 'Organization', icon: Building2, adminOnly: true },
  { to: '/settings/channels', label: 'Channels', icon: Plug, adminOnly: true },
  { to: '/settings/ai-agent', label: 'AI Agent', icon: Bot, adminOnly: true },
  { to: '/settings/automation', label: 'Automation', icon: Zap, adminOnly: true },
];
