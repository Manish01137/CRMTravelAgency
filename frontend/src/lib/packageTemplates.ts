import type { Values } from '@/pages/PackageBuilderPage';

/**
 * Ready-made "Signature" package templates. All three share ONE underlying
 * public-page structure (cover, brief itinerary, one page per day,
 * inclusions/exclusions, pricing & booking, why choose us, things to carry,
 * terms & conditions, contact) — picking a template just seeds a curated
 * starting structure AND sets which color variant (signatureTheme) that
 * shared layout renders in. Layout and theme are one concept now, owned
 * entirely by this choice — there's no separate view-type control anymore.
 */
export interface PackageTemplate {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  /** Tailwind gradient for the picker card. */
  gradient: string;
  seed: TemplateSeed;
}

/** The subset of the builder form a template fills in. */
export type TemplateSeed = Pick<
  Values,
  | 'signatureTheme'
  | 'categories'
  | 'highlights'
  | 'inclusions'
  | 'exclusions'
  | 'itinerary'
  | 'thingsToCarry'
  | 'cancellationPolicy'
  | 'paymentTerms'
  | 'termsConditions'
  | 'faqs'
  | 'nights'
  | 'days'
>;

const day = (
  n: number,
  title: string,
  description = '',
): Values['itinerary'][number] => ({
  day: String(n),
  title,
  description,
  hotelId: '',
  stay: '',
  activities: '',
  meals: '',
  images: [],
  activityBlocks: [],
});

const hl = (values: string[]) => values.map((value) => ({ value }));

const STD_CANCELLATION =
  '15+ days before departure: 10% of trip cost.\n7–15 days before: 50% of trip cost.\n0–7 days before: 100% of trip cost (no refund).';
const STD_PAYMENT =
  'Booking amount to reserve your seat.\n50% of the total 15 days prior to the trip.\nFull payment before departure.';
const STD_TERMS =
  'Prices may change due to unforeseen circumstances (fuel, taxes, local surcharges).\nWe are not responsible for delays due to weather, roadblocks or events beyond our control.\nSeating/room allocation is at our discretion.';

export const PACKAGE_TEMPLATES: PackageTemplate[] = [
  {
    id: 'signature-sunrise',
    name: 'Signature — Sunrise',
    emoji: '🌅',
    tagline: 'The default Signature look — blue & yellow',
    gradient: 'from-sky-500 to-amber-400',
    seed: {
      signatureTheme: 'SUNRISE',
      categories: [{ value: 'Signature' }],
      nights: '3',
      days: '4',
      highlights: hl(['Handpicked stays', 'Day-by-day guided plan', 'Local trip captain', 'Transparent, all-in pricing']),
      inclusions: 'Stay on sharing basis\nDaily breakfast\nPickup & drop\nAll sightseeing as per plan\nTrip captain / guide',
      exclusions: 'GST as applicable\nLunch & dinner unless mentioned\nEntry/activity tickets\nPersonal expenses',
      itinerary: [
        day(1, 'Arrival & leisure', 'Pickup, hotel check-in, evening at leisure.'),
        day(2, 'Full-day sightseeing', 'Guided sightseeing covering the destination’s highlights.'),
        day(3, 'Local experiences', 'A relaxed day of local markets, viewpoints and free time.'),
        day(4, 'Departure', 'Breakfast and drop-off.'),
      ],
      thingsToCarry: 'Comfortable walking shoes\nWeather-appropriate clothing\nPower bank & valid photo ID\nPersonal medication',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Is the itinerary customisable?', answer: 'Yes — this is a starting point; every detail can be edited to fit the trip.' }],
    },
  },
  {
    id: 'signature-ocean',
    name: 'Signature — Ocean',
    emoji: '🌊',
    tagline: 'Teal & coral — coastal and beach trips',
    gradient: 'from-teal-500 to-orange-400',
    seed: {
      signatureTheme: 'OCEAN',
      categories: [{ value: 'Signature' }],
      nights: '3',
      days: '4',
      highlights: hl(['Beachfront stay', 'Sunset by the water', 'Water-sports session', 'Relaxed coastal pace']),
      inclusions: 'Airport/station transfers\nBeach-facing stay\nDaily breakfast\nOne water-sports session\nSightseeing as per plan',
      exclusions: 'GST as applicable\nLunch & dinner unless mentioned\nWater-sports beyond one session\nPersonal expenses',
      itinerary: [
        day(1, 'Arrival & beach time', 'Pickup, check-in, evening by the water.'),
        day(2, 'Island & water activities', 'Island hopping and a water-sports session.'),
        day(3, 'Leisure & sunset', 'Free morning, evening sunset by the coast.'),
        day(4, 'Departure', 'Breakfast and drop-off.'),
      ],
      thingsToCarry: 'Swimwear\nSunscreen & sunglasses\nFlip-flops & light cottons\nPower bank & valid photo ID',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Is the itinerary customisable?', answer: 'Yes — this is a starting point; every detail can be edited to fit the trip.' }],
    },
  },
  {
    id: 'signature-heritage',
    name: 'Signature — Heritage',
    emoji: '🏛️',
    tagline: 'Maroon & gold — cultural and pilgrimage trips',
    gradient: 'from-rose-800 to-amber-500',
    seed: {
      signatureTheme: 'HERITAGE',
      categories: [{ value: 'Signature' }],
      nights: '3',
      days: '4',
      highlights: hl(['Guided heritage walks', 'Comfortable stays', 'Experienced local guide', 'Culturally rich itinerary']),
      inclusions: 'Transport\nHotel stay\nDaily breakfast\nGuided heritage sightseeing\nLocal guide',
      exclusions: 'GST as applicable\nLunch & dinner unless mentioned\nEntry/monument tickets\nPersonal expenses',
      itinerary: [
        day(1, 'Arrival & local heritage', 'Pickup, check-in and an evening heritage walk.'),
        day(2, 'Main heritage sites', 'Full-day guided visit to the destination’s key heritage sites.'),
        day(3, 'Nearby excursion', 'Excursion to a nearby heritage or cultural site.'),
        day(4, 'Departure', 'Breakfast and drop-off.'),
      ],
      thingsToCarry: 'Comfortable footwear\nModest, weather-appropriate clothing\nPersonal medication\nPower bank & valid photo ID',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Is the itinerary customisable?', answer: 'Yes — this is a starting point; every detail can be edited to fit the trip.' }],
    },
  },
];
