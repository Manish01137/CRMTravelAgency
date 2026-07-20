import type { PdfTemplateId } from '@/types';

/**
 * PDF brochure templates. Presentation-only: all 5 render the SAME package data
 * (cover, day-wise itinerary with activity image+description, inclusions/
 * exclusions, pricing & payment terms, FAQs, contact/CTA). Switching a package's
 * template only changes styling, never the underlying content.
 */
export interface PdfTemplate {
  id: PdfTemplateId;
  name: string;
  tagline: string;
  /** Preview swatch gradient for the Choose-Template thumbnails. */
  swatch: string;
  /** Cover layout variant. */
  cover: 'fullbleed' | 'framed' | 'airy' | 'band' | 'blocks';
  page: string; // page background + base text colour
  accent: string; // primary accent hex
  accent2: string; // secondary accent hex
  headingFont: string; // CSS font-family for headings
  bodyFont: string; // CSS font-family for body
  uppercaseHeadings: boolean;
  cardRadius: string; // tailwind radius class for cards
  rule: 'line' | 'ornament' | 'none';
}

const SANS = "'Figtree', sans-serif";
const GROTESK = "'Space Grotesk', 'Figtree', sans-serif";
const PLAYFAIR = "'Playfair Display', Georgia, serif";
const LORA = "'Lora', Georgia, serif";
const BEBAS = "'Bebas Neue', 'Figtree', sans-serif";

export const PDF_TEMPLATES: Record<PdfTemplateId, PdfTemplate> = {
  alpine: {
    id: 'alpine',
    name: 'Alpine Modern',
    tagline: 'Bold sans, dark full-bleed hero — adventure & mountains',
    swatch: 'from-slate-800 to-slate-950',
    cover: 'fullbleed',
    page: 'bg-white text-slate-900',
    accent: '#0f172a',
    accent2: '#0ea5e9',
    headingFont: GROTESK,
    bodyFont: SANS,
    uppercaseHeadings: true,
    cardRadius: 'rounded-xl',
    rule: 'line',
  },
  heritage: {
    id: 'heritage',
    name: 'Heritage Classic',
    tagline: 'Elegant serif, gold & maroon — pilgrimage & culture',
    swatch: 'from-amber-600 to-red-900',
    cover: 'framed',
    page: 'bg-[#fbf6ec] text-[#4a3418]',
    accent: '#9b1c1c',
    accent2: '#b8963e',
    headingFont: PLAYFAIR,
    bodyFont: LORA,
    uppercaseHeadings: false,
    cardRadius: 'rounded-md',
    rule: 'ornament',
  },
  beach: {
    id: 'beach',
    name: 'Beach Breeze',
    tagline: 'Light, airy, pastel teal — beach & leisure',
    swatch: 'from-cyan-300 to-sky-500',
    cover: 'airy',
    page: 'bg-[#f4fbfb] text-slate-700',
    accent: '#0891b2',
    accent2: '#f59e0b',
    headingFont: SANS,
    bodyFont: SANS,
    uppercaseHeadings: false,
    cardRadius: 'rounded-3xl',
    rule: 'none',
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate Clean',
    tagline: 'Minimal, neutral, professional — corporate & groups',
    swatch: 'from-slate-400 to-slate-600',
    cover: 'band',
    page: 'bg-white text-slate-800',
    accent: '#1e3a8a',
    accent2: '#64748b',
    headingFont: SANS,
    bodyFont: SANS,
    uppercaseHeadings: false,
    cardRadius: 'rounded-lg',
    rule: 'line',
  },
  vibrant: {
    id: 'vibrant',
    name: 'Vibrant Adventure',
    tagline: 'Bold, colourful, energetic — trekking & youth',
    swatch: 'from-orange-500 via-pink-500 to-violet-600',
    cover: 'blocks',
    page: 'bg-white text-slate-900',
    accent: '#7c3aed',
    accent2: '#f97316',
    headingFont: BEBAS,
    bodyFont: SANS,
    uppercaseHeadings: true,
    cardRadius: 'rounded-2xl',
    rule: 'line',
  },
};

export const PDF_TEMPLATE_LIST = Object.values(PDF_TEMPLATES);
