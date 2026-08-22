/** Shared color-accent system for the owner panel — one hue per section, reused
 *  across nav, stat tiles, and badges so the whole panel reads as one design
 *  instead of each page inventing its own palette. */
export type OwnerAccent = 'indigo' | 'violet' | 'teal' | 'amber' | 'rose';

export const ACCENT_CLASSES: Record<OwnerAccent, { text: string; bg: string; ring: string; gradient: string; glow: string }> = {
  indigo: {
    text: 'text-indigo-300',
    bg: 'bg-indigo-500/15',
    ring: 'ring-indigo-400/20',
    gradient: 'from-indigo-500 to-indigo-600',
    glow: 'shadow-[0_0_24px_rgba(99,102,241,0.35)]',
  },
  violet: {
    text: 'text-violet-300',
    bg: 'bg-violet-500/15',
    ring: 'ring-violet-400/20',
    gradient: 'from-violet-500 to-purple-600',
    glow: 'shadow-[0_0_24px_rgba(139,92,246,0.35)]',
  },
  teal: {
    text: 'text-teal-300',
    bg: 'bg-teal-500/15',
    ring: 'ring-teal-400/20',
    gradient: 'from-teal-400 to-emerald-600',
    glow: 'shadow-[0_0_24px_rgba(45,212,191,0.35)]',
  },
  amber: {
    text: 'text-amber-300',
    bg: 'bg-amber-500/15',
    ring: 'ring-amber-400/20',
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-[0_0_24px_rgba(251,191,36,0.35)]',
  },
  rose: {
    text: 'text-rose-300',
    bg: 'bg-rose-500/15',
    ring: 'ring-rose-400/20',
    gradient: 'from-rose-500 to-pink-600',
    glow: 'shadow-[0_0_24px_rgba(244,63,94,0.35)]',
  },
};
