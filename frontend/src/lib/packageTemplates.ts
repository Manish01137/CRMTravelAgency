import type { Values } from '@/pages/PackageBuilderPage';

/**
 * Ready-made premium package templates. Picking one seeds the builder with a
 * curated structure (categories, highlights, inclusions/exclusions, a day-by-day
 * skeleton, policies & FAQs) plus a matching public View Type — the agent then
 * just edits the specifics.
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
  | 'viewType'
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
    id: 'adventure',
    name: 'Adventure Trek',
    emoji: '🏔️',
    tagline: 'Mountains, treks & adrenaline',
    gradient: 'from-orange-500 to-red-600',
    seed: {
      viewType: 'ADVENTURE',
      categories: [{ value: 'Adventure Trips' }],
      nights: '4',
      days: '5',
      highlights: hl(['Experienced trek captain', 'Riverside camps & bonfire', 'All safety gear included', 'Small-group experience']),
      inclusions: 'Transport (AC where applicable)\nStay on sharing basis\nBreakfast & dinner\nTrek captain / guide\nBasic first aid',
      exclusions: 'Any meals not mentioned\nPersonal expenses & tips\nAdventure activity charges\nAnything not in inclusions',
      itinerary: [
        day(1, 'Arrival & briefing', 'Reach base camp, check-in, evening briefing and bonfire.'),
        day(2, 'Acclimatisation walk', 'Short warm-up hike and local sightseeing.'),
        day(3, 'Summit / main trek', 'Full-day trek to the highlight point with packed lunch.'),
        day(4, 'Explore & leisure', 'Optional activities — rafting, rappelling or rest.'),
        day(5, 'Departure', 'Breakfast and departure with memories.'),
      ],
      thingsToCarry: 'Trekking shoes\nWarm layers & raincoat\nWater bottle\nPersonal medication\nSunscreen & cap',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [
        { question: 'How difficult is this trek?', answer: 'Moderate — suitable for first-timers with basic fitness.' },
        { question: 'Is it safe for solo travellers?', answer: 'Yes, we run small guided groups with a trek captain throughout.' },
      ],
    },
  },
  {
    id: 'beach',
    name: 'Beach Getaway',
    emoji: '🏖️',
    tagline: 'Sun, sand & island vibes',
    gradient: 'from-sky-400 to-cyan-500',
    seed: {
      viewType: 'BEACH',
      categories: [{ value: 'Weekend Getaways' }],
      nights: '3',
      days: '4',
      highlights: hl(['Beachfront stay', 'Water sports session', 'Sunset cruise', 'Candlelit beach dinner']),
      inclusions: 'Airport transfers\nBeach resort stay\nDaily breakfast\nOne water-sports session\nSightseeing as per plan',
      exclusions: 'Flights\nLunch & dinner unless mentioned\nWater-sports beyond one session\nPersonal expenses',
      itinerary: [
        day(1, 'Arrival & beach time', 'Airport pickup, check-in, evening at the beach.'),
        day(2, 'Island & water sports', 'Island hopping and water-sports session.'),
        day(3, 'Leisure & sunset cruise', 'Free morning, evening sunset cruise.'),
        day(4, 'Departure', 'Breakfast and airport drop.'),
      ],
      thingsToCarry: 'Swimwear\nSunscreen & sunglasses\nFlip-flops\nLight cottons\nHat',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Are water sports included?', answer: 'One session is included; more can be added at cost.' }],
    },
  },
  {
    id: 'pilgrimage',
    name: 'Pilgrimage / Spiritual',
    emoji: '🛕',
    tagline: 'Temples, faith & serenity',
    gradient: 'from-amber-500 to-orange-600',
    seed: {
      viewType: 'PILGRIMAGE',
      categories: [{ value: 'Pilgrimage' }],
      nights: '5',
      days: '6',
      highlights: hl(['Guided darshan', 'Comfortable stays', 'Experienced tour manager', 'Vegetarian meals']),
      inclusions: 'Transport\nHotel/dharamshala stay\nBreakfast & dinner (veg)\nTour manager\nDarshan assistance',
      exclusions: 'Special/VIP darshan tickets\nDonations & pooja charges\nPersonal expenses\nAnything not in inclusions',
      itinerary: [
        day(1, 'Arrival & local temple', 'Reach, check-in and evening aarti.'),
        day(2, 'Main darshan', 'Early darshan and temple visits.'),
        day(3, 'Nearby holy sites', 'Excursion to nearby shrines.'),
        day(4, 'River / ghat visit', 'Morning ritual and sightseeing.'),
        day(5, 'Leisure & shopping', 'Local market and rest.'),
        day(6, 'Departure', 'Breakfast and departure.'),
      ],
      thingsToCarry: 'Comfortable footwear\nTraditional/modest clothing\nPersonal medication\nShawl',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Are meals vegetarian?', answer: 'Yes, all included meals are pure vegetarian.' }],
    },
  },
  {
    id: 'honeymoon',
    name: 'Honeymoon / Romantic',
    emoji: '💞',
    tagline: 'Private, cosy & unforgettable',
    gradient: 'from-pink-500 to-rose-600',
    seed: {
      viewType: 'ROMANCE',
      categories: [{ value: 'Premium Experiences' }],
      nights: '4',
      days: '5',
      highlights: hl(['Private candlelight dinner', 'Room decorated on arrival', 'Couple spa session', 'Premium stays']),
      inclusions: 'Private transfers\nPremium couple stay\nDaily breakfast\nOne candlelight dinner\nRoom decoration',
      exclusions: 'Flights\nSpa beyond one session\nMeals unless mentioned\nPersonal expenses',
      itinerary: [
        day(1, 'Arrival & welcome', 'Private pickup, decorated room, relaxed evening.'),
        day(2, 'Sightseeing for two', 'Curated romantic spots and viewpoints.'),
        day(3, 'Leisure & spa', 'Couple spa and candlelight dinner.'),
        day(4, 'Excursion day', 'Full-day romantic excursion.'),
        day(5, 'Departure', 'Breakfast and private drop.'),
      ],
      thingsToCarry: 'Light formals for dinner\nComfortable wear\nSunscreen\nCamera',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Can you arrange a cake or surprise?', answer: 'Yes — tell us in advance and we will arrange it (may be chargeable).' }],
    },
  },
  {
    id: 'wildlife',
    name: 'Wildlife Safari',
    emoji: '🐯',
    tagline: 'Jungles, safaris & the wild',
    gradient: 'from-emerald-600 to-green-700',
    seed: {
      viewType: 'WILDLIFE',
      categories: [{ value: 'Nature & Wildlife' }],
      nights: '2',
      days: '3',
      highlights: hl(['Jeep safari with naturalist', 'Jungle resort stay', 'Birdwatching walk', 'Bonfire evening']),
      inclusions: 'Transport\nJungle resort stay\nAll meals\nOne jeep safari\nNaturalist guide',
      exclusions: 'Camera fees\nAdditional safaris\nPersonal expenses\nAnything not in inclusions',
      itinerary: [
        day(1, 'Arrival & nature walk', 'Reach resort, check-in, evening nature walk.'),
        day(2, 'Morning safari', 'Early jeep safari and afternoon at leisure.'),
        day(3, 'Departure', 'Breakfast and departure.'),
      ],
      thingsToCarry: 'Neutral-coloured clothing\nBinoculars\nInsect repellent\nHat & sunscreen',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Are tiger sightings guaranteed?', answer: 'Sightings depend on nature and cannot be guaranteed, but our naturalists maximise chances.' }],
    },
  },
  {
    id: 'weekend',
    name: 'Weekend Getaway',
    emoji: '🚗',
    tagline: 'Quick 2–3 day escapes',
    gradient: 'from-violet-500 to-purple-600',
    seed: {
      viewType: 'WEEKEND',
      categories: [{ value: 'Weekend Getaways' }],
      nights: '2',
      days: '3',
      highlights: hl(['Great value short trip', 'Comfortable stay', 'Local sightseeing', 'Fun group vibe']),
      inclusions: 'Transport\nStay on sharing basis\nBreakfast\nSightseeing as per plan',
      exclusions: 'Lunch & dinner\nEntry/activity tickets\nPersonal expenses',
      itinerary: [
        day(1, 'Departure & arrival', 'Travel, check-in and evening local walk.'),
        day(2, 'Sightseeing day', 'Full-day local sightseeing and activities.'),
        day(3, 'Return', 'Breakfast, last spot and return journey.'),
      ],
      thingsToCarry: 'Comfortable clothing\nWater bottle\nPersonal medication',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Where does the trip start from?', answer: 'Pickup and drop point will be shared before departure.' }],
    },
  },
  {
    id: 'luxury',
    name: 'Luxury Escape',
    emoji: '✨',
    tagline: '5-star stays & fine experiences',
    gradient: 'from-yellow-500 to-amber-700',
    seed: {
      viewType: 'LUXURY',
      categories: [{ value: 'Premium Experiences' }],
      nights: '4',
      days: '5',
      highlights: hl(['5-star handpicked stays', 'Private transfers', 'Curated fine dining', 'Personal trip concierge']),
      inclusions: 'Private luxury transfers\n5-star stay\nDaily breakfast\nCurated experiences\nDedicated concierge',
      exclusions: 'Flights\nMeals unless mentioned\nPersonal shopping\nAnything not in inclusions',
      itinerary: [
        day(1, 'Arrival in style', 'Private transfer and luxury check-in.'),
        day(2, 'Signature experiences', 'Curated premium sightseeing.'),
        day(3, 'Leisure & fine dining', 'Relax and a fine-dining evening.'),
        day(4, 'Exclusive excursion', 'Private full-day excursion.'),
        day(5, 'Departure', 'Breakfast and private drop.'),
      ],
      thingsToCarry: 'Smart casuals & formals\nSunscreen\nCamera\nPersonal essentials',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Can the itinerary be fully customised?', answer: 'Absolutely — luxury trips are tailored to your preferences.' }],
    },
  },
  {
    id: 'backpacking',
    name: 'Backpacking',
    emoji: '🎒',
    tagline: 'Budget-friendly & offbeat',
    gradient: 'from-teal-500 to-emerald-600',
    seed: {
      viewType: 'BACKPACK',
      categories: [{ value: 'Adventure Trips' }],
      nights: '5',
      days: '6',
      highlights: hl(['Budget-friendly', 'Offbeat routes', 'Hostel/camp stays', 'Meet fellow travellers']),
      inclusions: 'Shared transport\nHostel/camp stay\nBreakfast\nTrip leader',
      exclusions: 'Most meals\nActivities & entry tickets\nPersonal expenses',
      itinerary: [
        day(1, 'Kick-off', 'Group meet, travel and first stop.'),
        day(2, 'Explore town 1', 'Local exploration and street food.'),
        day(3, 'On the road', 'Scenic transfer to the next base.'),
        day(4, 'Explore town 2', 'Offbeat spots and viewpoints.'),
        day(5, 'Free day', 'Optional activities or chill.'),
        day(6, 'Wrap up', 'Return journey.'),
      ],
      thingsToCarry: 'Backpack (no suitcase)\nComfortable shoes\nPower bank\nReusable bottle',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Is this good for solo travellers?', answer: 'Perfect — most of our backpackers travel solo and make friends fast.' }],
    },
  },
  {
    id: 'family',
    name: 'Family Vacation',
    emoji: '👨‍👩‍👧‍👦',
    tagline: 'Comfortable fun for all ages',
    gradient: 'from-blue-500 to-indigo-600',
    seed: {
      viewType: 'FAMILY',
      categories: [{ value: 'Weekend Getaways' }],
      nights: '4',
      days: '5',
      highlights: hl(['Family-friendly stays', 'Relaxed pace', 'Kid-friendly activities', 'Comfortable transport']),
      inclusions: 'Private transport\nFamily rooms\nBreakfast & dinner\nSightseeing as per plan',
      exclusions: 'Lunch\nActivity/entry tickets\nPersonal expenses',
      itinerary: [
        day(1, 'Arrival & settle in', 'Reach, check-in and easy evening.'),
        day(2, 'Sightseeing day', 'Family-friendly attractions.'),
        day(3, 'Fun & activities', 'Parks, rides or nature spots.'),
        day(4, 'Leisure day', 'Relaxed exploring and shopping.'),
        day(5, 'Departure', 'Breakfast and drop.'),
      ],
      thingsToCarry: "Kids' essentials\nComfortable wear\nSunscreen\nPersonal medication",
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'Is the pace okay for elderly members?', answer: 'Yes — the plan is relaxed with comfortable transport and stays.' }],
    },
  },
  {
    id: 'hillstation',
    name: 'Hill Station',
    emoji: '⛰️',
    tagline: 'Cool weather & scenic valleys',
    gradient: 'from-lime-500 to-green-600',
    seed: {
      viewType: 'HILLS',
      categories: [{ value: 'Nature & Wildlife' }],
      nights: '3',
      days: '4',
      highlights: hl(['Scenic valley views', 'Cool pleasant weather', 'Local sightseeing', 'Cosy stays']),
      inclusions: 'Transport\nHill-view stay\nBreakfast\nSightseeing as per plan',
      exclusions: 'Lunch & dinner\nRopeway/entry tickets\nPersonal expenses',
      itinerary: [
        day(1, 'Arrival & mall road', 'Reach, check-in and evening local walk.'),
        day(2, 'Valley sightseeing', 'Viewpoints and scenic spots.'),
        day(3, 'Excursion day', 'Nearby hill excursion.'),
        day(4, 'Departure', 'Breakfast and return.'),
      ],
      thingsToCarry: 'Warm jacket\nComfortable shoes\nMoisturiser\nUmbrella',
      cancellationPolicy: STD_CANCELLATION,
      paymentTerms: STD_PAYMENT,
      termsConditions: STD_TERMS,
      faqs: [{ question: 'How cold does it get?', answer: 'Pleasant by day; carry warm layers for the evenings.' }],
    },
  },
];
