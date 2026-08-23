/** Shared color-accent system for the owner panel — one hue per section, reused
 *  across nav, stat tiles, and badges so the whole panel reads as one design,
 *  matching the exact gradient-tile pattern the tenant Dashboard already uses
 *  (StatCard's `tile` prop in pages/DashboardPage.tsx). */
export type OwnerAccent = 'indigo' | 'violet' | 'teal' | 'amber' | 'rose' | 'sky' | 'fuchsia';

export const ACCENT_CLASSES: Record<OwnerAccent, { tile: string; badgeBg: string; badgeText: string; navActive: string }> = {
  indigo: {
    tile: 'bg-gradient-to-br from-primary to-violet-500',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    navActive: 'bg-primary/10 text-primary',
  },
  violet: {
    tile: 'bg-gradient-to-br from-violet-500 to-purple-600',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-700',
    navActive: 'bg-violet-500/10 text-violet-700',
  },
  teal: {
    tile: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    navActive: 'bg-teal-500/10 text-teal-700',
  },
  amber: {
    tile: 'bg-gradient-to-br from-amber-400 to-orange-500',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    navActive: 'bg-amber-500/10 text-amber-700',
  },
  rose: {
    tile: 'bg-gradient-to-br from-rose-500 to-pink-600',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    navActive: 'bg-rose-500/10 text-rose-700',
  },
  sky: {
    tile: 'bg-gradient-to-br from-sky-500 to-blue-600',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    navActive: 'bg-sky-500/10 text-sky-700',
  },
  fuchsia: {
    tile: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    badgeBg: 'bg-fuchsia-50',
    badgeText: 'text-fuchsia-700',
    navActive: 'bg-fuchsia-500/10 text-fuchsia-700',
  },
};
