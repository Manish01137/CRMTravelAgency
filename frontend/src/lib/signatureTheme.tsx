import type { ReactNode } from 'react';
import type { SignatureTheme } from '@/types';

/**
 * Single source of truth for the "Signature" brochure design system — colors,
 * type, and the two shared building blocks (Banner, BulletList). Used by both
 * the public package page (/p/:id, continuous scroll) and its PDF download
 * (/p/:id/pdf, paginated) so the two render from the exact same values
 * instead of two independent copies that can drift apart, which is what
 * happened before this was extracted (the PDF kept looking like a different
 * design even after its colors were manually kept in sync by hand).
 *
 * Real color values from the "Signature" brochure reference template — its
 * :root / .theme-ocean / .theme-heritage custom properties — applied here as
 * CSS custom properties, the same mechanism the reference file itself uses.
 */
export const THEME_VARS: Record<SignatureTheme, Record<string, string>> = {
  SUNRISE: {
    '--blue': '#1867B4',
    '--blue-dark': '#0E4C87',
    '--blue-pale': '#EAF3FC',
    '--yellow': '#FFC72C',
    '--yellow-pale': '#FFF4D6',
    '--orange': '#F2801E',
  },
  OCEAN: {
    '--blue': '#0E7C86',
    '--blue-dark': '#0A5860',
    '--blue-pale': '#E4F5F6',
    '--yellow': '#FF8A65',
    '--yellow-pale': '#FFE9DE',
    '--orange': '#E85D2A',
  },
  HERITAGE: {
    '--blue': '#7A2E3B',
    '--blue-dark': '#521D27',
    '--blue-pale': '#F6E9EA',
    '--yellow': '#D8A24A',
    '--yellow-pale': '#F6EAD1',
    '--orange': '#B5651D',
  },
};

// Constant across all 3 variants in the reference template — only blue/yellow/orange shift.
export const INK = '#1B1F27';
export const MUTED = '#57626F';
export const HAIRLINE = '#E4E9EF';
export const DISPLAY_FONT = "'Baloo 2', 'Figtree', sans-serif";
export const BODY_FONT = "'Poppins', 'Figtree', sans-serif";

/** The reference template's pill-shaped section header ("BRIEF ITINERARY", "INCLUSIONS", …). */
export function Banner({ children, yellow }: { children: ReactNode; yellow?: boolean }) {
  return (
    <div className="my-5 text-center">
      <span
        className="inline-block rounded-2xl px-6 py-2.5 text-lg font-bold tracking-wide"
        style={{
          fontFamily: DISPLAY_FONT,
          backgroundColor: yellow ? 'var(--yellow)' : 'var(--blue)',
          color: yellow ? INK : '#fff',
        }}
      >
        {children}
      </span>
    </div>
  );
}

export function BulletList({ items, dotColor }: { items: string[]; dotColor?: string }) {
  return (
    <ul className="space-y-2.5">
      {items.map((l, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed" style={{ color: INK }}>
          <span
            className="mt-2 size-2 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor ?? 'var(--blue)' }}
          />
          {l}
        </li>
      ))}
    </ul>
  );
}
