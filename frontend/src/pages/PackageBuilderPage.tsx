import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller, type Control } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileText,
  GripVertical,
  HelpCircle,
  LayoutTemplate,
  ListChecks,
  MapPin,
  Package as PackageIcon,
  Plus,
  Save,
  Search as SearchIcon,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Hotel, PackageViewType, SightseeingActivity, TravelPackage } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageUpload } from '@/components/ui/image-upload';
import { formatCurrency } from '@/lib/format';
import { PACKAGE_TEMPLATES, type PackageTemplate } from '@/lib/packageTemplates';

/* ------------------------------- form shape -------------------------------- */

export interface Values {
  name: string;
  code: string;
  viewType: PackageViewType;
  categories: { value: string }[];
  slug: string;
  destination: string;
  nights: string;
  days: string;
  bookingTitle: string;
  priceAmount: string;
  originalPrice: string;
  priceCurrency: string;
  pricingOptions: { label: string; price: string }[];
  bannerImageUrl: string;
  whatsappBannerUrl: string;
  whatsappDescription: string;
  description: string;
  contactNumber: string;
  contactEmail: string;
  itinerary: {
    day: string;
    title: string;
    description: string;
    hotelId: string;
    stay: string;
    activities: string; // comma-separated in the form; array in the API
    meals: string;
    images: string[];
  }[];
  inclusions: string;
  exclusions: string;
  thingsToCarry: string;
  pickupPoints: string;
  cancellationPolicy: string;
  paymentTerms: string;
  termsConditions: string;
  faqs: { question: string; answer: string }[];
  highlights: { value: string }[];
  galleryImages: { value: string }[];
  isActive: boolean;
  showOnLinktree: boolean;
}

/** Public page design themes — each renders a distinct look on /p/:id. */
const THEME_OPTIONS: { value: PackageViewType; label: string }[] = [
  { value: 'CLASSIC', label: 'Classic — bright & friendly' },
  { value: 'MODERN', label: 'Modern — dark editorial' },
  { value: 'MINIMAL', label: 'Minimal — airy white' },
  { value: 'ADVENTURE', label: '🏔️ Adventure — rugged blaze' },
  { value: 'BEACH', label: '🏖️ Beach — sun & surf' },
  { value: 'PILGRIMAGE', label: '🛕 Pilgrimage — saffron heritage' },
  { value: 'ROMANCE', label: '💞 Romance — blush elegance' },
  { value: 'WILDLIFE', label: '🐯 Wildlife — deep jungle' },
  { value: 'WEEKEND', label: '🚗 Weekend — vibrant pop' },
  { value: 'LUXURY', label: '✨ Luxury — ivory & gold' },
  { value: 'BACKPACK', label: '🎒 Backpack — indie journal' },
  { value: 'FAMILY', label: '👨‍👩‍👧‍👦 Family — cheerful sky' },
  { value: 'HILLS', label: '⛰️ Hills — misty pine' },
];

const STEPS = [
  { key: 'basics', label: 'Basics', Icon: PackageIcon },
  { key: 'itinerary', label: 'Itinerary', Icon: MapPin },
  { key: 'logistics', label: 'Logistics', Icon: ListChecks },
  { key: 'policies', label: 'Policies', Icon: CheckCircle2 },
  { key: 'faqs', label: 'FAQs', Icon: HelpCircle },
  { key: 'extra', label: 'Extra', Icon: Sparkles },
  { key: 'review', label: 'Review', Icon: Star },
] as const;

export function toValues(pkg: TravelPackage | null): Values {
  return {
    name: pkg?.name ?? '',
    code: pkg?.code ?? '',
    viewType: pkg?.viewType ?? 'CLASSIC',
    categories: (pkg?.categories ?? []).map((value) => ({ value })),
    slug: pkg?.slug ?? '',
    destination: pkg?.destination ?? '',
    nights: String(pkg?.nights ?? 1),
    days: String(pkg?.days ?? 2),
    bookingTitle: pkg?.bookingTitle ?? '',
    priceAmount: pkg?.priceAmount != null ? String(pkg.priceAmount) : '',
    originalPrice: pkg?.originalPrice != null ? String(pkg.originalPrice) : '',
    priceCurrency: pkg?.priceCurrency ?? 'INR',
    pricingOptions: (pkg?.pricingOptions ?? []).map((p) => ({ label: p.label, price: String(p.price) })),
    bannerImageUrl: pkg?.bannerImageUrl ?? '',
    whatsappBannerUrl: pkg?.whatsappBannerUrl ?? '',
    whatsappDescription: pkg?.whatsappDescription ?? '',
    description: pkg?.description ?? '',
    contactNumber: pkg?.contactNumber ?? '',
    contactEmail: pkg?.contactEmail ?? '',
    itinerary: (pkg?.itinerary ?? []).map((d) => ({
      day: String(d.day),
      title: d.title,
      description: d.description ?? '',
      hotelId: d.hotelId ?? '',
      stay: d.stay ?? '',
      activities: (d.activities ?? []).join(', '),
      meals: d.meals ?? '',
      images: d.images ?? [],
    })),
    inclusions: pkg?.inclusions ?? '',
    exclusions: pkg?.exclusions ?? '',
    thingsToCarry: pkg?.thingsToCarry ?? '',
    pickupPoints: pkg?.pickupPoints ?? '',
    cancellationPolicy: pkg?.cancellationPolicy ?? '',
    paymentTerms: pkg?.paymentTerms ?? '',
    termsConditions: pkg?.termsConditions ?? '',
    faqs: pkg?.faqs ?? [],
    highlights: (pkg?.highlights ?? []).map((value) => ({ value })),
    galleryImages: (pkg?.galleryImages ?? []).map((value) => ({ value })),
    isActive: pkg?.isActive ?? false,
    showOnLinktree: pkg?.showOnLinktree ?? true,
  };
}

function toPayload(v: Values): Record<string, unknown> {
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  return {
    name: v.name.trim(),
    code: v.code.trim() || null,
    viewType: v.viewType,
    categories: v.categories.map((c) => c.value.trim()).filter(Boolean),
    slug: v.slug.trim() || null,
    destination: v.destination.trim(),
    nights: Number(v.nights) || 0,
    days: Number(v.days) || 1,
    bookingTitle: v.bookingTitle.trim() || null,
    priceAmount: Number(v.priceAmount) || 0,
    originalPrice: num(v.originalPrice),
    priceCurrency: (v.priceCurrency || 'INR').toUpperCase(),
    pricingOptions: v.pricingOptions
      .filter((p) => p.label.trim() && p.price.trim() !== '')
      .map((p) => ({ label: p.label.trim(), price: Number(p.price) || 0 })),
    bannerImageUrl: v.bannerImageUrl.trim() || null,
    whatsappBannerUrl: v.whatsappBannerUrl.trim() || null,
    whatsappDescription: v.whatsappDescription.trim() || null,
    description: v.description.trim() || null,
    contactNumber: v.contactNumber.trim() || null,
    contactEmail: v.contactEmail.trim() || null,
    itinerary: v.itinerary
      .filter((d) => d.title.trim())
      .map((d, i) => ({
        day: Number(d.day) || i + 1,
        title: d.title.trim(),
        description: d.description.trim() || undefined,
        hotelId: d.hotelId || undefined,
        stay: d.stay.trim() || undefined,
        activities: d.activities
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        meals: d.meals.trim() || undefined,
        images: d.images.filter((u) => /^https?:\/\//.test(u)),
      })),
    inclusions: v.inclusions.trim() || null,
    exclusions: v.exclusions.trim() || null,
    thingsToCarry: v.thingsToCarry.trim() || null,
    pickupPoints: v.pickupPoints.trim() || null,
    cancellationPolicy: v.cancellationPolicy.trim() || null,
    paymentTerms: v.paymentTerms.trim() || null,
    termsConditions: v.termsConditions.trim() || null,
    faqs: v.faqs.filter((f) => f.question.trim() && f.answer.trim()).map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })),
    highlights: v.highlights.map((h) => h.value.trim()).filter(Boolean),
    galleryImages: v.galleryImages.map((g) => g.value.trim()).filter((u) => /^https?:\/\//.test(u)),
    isActive: v.isActive,
    showOnLinktree: v.showOnLinktree,
  };
}

/* ------------------------------ small pieces ------------------------------- */

function SectionLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function CategoryChips({ control }: { control: Control<Values> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'categories' });
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !fields.some((f) => f.value.toLowerCase() === v.toLowerCase())) append({ value: v });
    setDraft('');
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {fields.length === 0 && <span className="text-sm text-muted-foreground">No categories yet.</span>}
        {fields.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {f.value}
            <button type="button" aria-label={`Remove ${f.value}`} onClick={() => remove(i)}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. Honeymoon, Adventure…"
          className="sm:max-w-xs"
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus /> Add category
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- step content ------------------------------ */

function BasicsStep({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const { register, control, formState: { errors } } = form;
  const pricing = useFieldArray({ control, name: 'pricingOptions' });

  return (
    <div className="space-y-8">
      <div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Package name" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" placeholder="BALI_V1_2026" {...register('name', { required: 'Name is required' })} />
          </Field>
          <Field label="Package code" htmlFor="code" hint="Auto-generated if left blank.">
            <Input id="code" placeholder="Optional" {...register('code')} />
          </Field>
        </div>

        <Field
          label="Package view type"
          className="mt-4"
          hint="Controls which public page layout this package renders."
        >
          <Controller
            control={control}
            name="viewType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-surface/60 p-5">
        <SectionLabel hint="Create your own categories and assign multiple to this package.">Package categories</SectionLabel>
        <CategoryChips control={control} />
      </div>

      <Field label="Public URL slug" htmlFor="slug" hint="Auto-generated from the name. Lowercase letters, numbers, hyphens." error={errors.slug?.message}>
        <Input id="slug" placeholder="auto-generated-from-name" {...register('slug')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Duration" required>
          <div className="flex gap-2">
            <Input type="number" min={0} aria-label="Number" className="w-24" {...register('nights')} />
            <span className="flex items-center rounded-md border border-input bg-card px-3 text-sm text-muted-foreground">Nights</span>
            <Input type="number" min={1} aria-label="Days" className="w-24" {...register('days')} />
            <span className="flex items-center rounded-md border border-input bg-card px-3 text-sm text-muted-foreground">Days</span>
          </div>
        </Field>
        <Field label="Booking title" htmlFor="bookingTitle" hint="Public booking page header.">
          <Input id="bookingTitle" {...register('bookingTitle')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Destination" htmlFor="destination" error={errors.destination?.message} required>
          <Input id="destination" placeholder="Bali, Indonesia" {...register('destination', { required: 'Destination is required' })} />
        </Field>
        <Field label="Price" htmlFor="priceAmount" error={errors.priceAmount?.message} required>
          <Input id="priceAmount" type="number" min={0} placeholder="13999" {...register('priceAmount', { required: true })} />
        </Field>
        <Field label="Original price" htmlFor="originalPrice" hint="Shown struck-through as a discount.">
          <Input id="originalPrice" type="number" min={0} placeholder="16000" {...register('originalPrice')} />
        </Field>
      </div>

      <Field label="Currency" htmlFor="priceCurrency" className="sm:max-w-[120px]">
        <Input id="priceCurrency" maxLength={3} className="uppercase" {...register('priceCurrency')} />
      </Field>

      <div>
        <SectionLabel hint="Add any number of labelled prices — e.g. Single / Double / Triple sharing, Child With Bed, Extra Bed.">
          Pricing options
        </SectionLabel>
        <div className="space-y-2">
          {pricing.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <Input placeholder="Label (e.g. Double sharing)" className="flex-1" {...register(`pricingOptions.${i}.label`)} />
              <Input type="number" min={0} placeholder="Price" className="w-32" {...register(`pricingOptions.${i}.price`)} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove price" onClick={() => pricing.remove(i)}>
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-2 w-full border-dashed"
          onClick={() => pricing.append({ label: '', price: '' })}
        >
          <Plus /> Add price
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Banner image">
          <Controller
            control={control}
            name="bannerImageUrl"
            render={({ field }) => <ImageUpload value={field.value} onChange={(url) => field.onChange(url ?? '')} />}
          />
        </Field>
        <Field label="WhatsApp banner image" hint="Used when shared on WhatsApp. Leave empty to reuse the banner.">
          <Controller
            control={control}
            name="whatsappBannerUrl"
            render={({ field }) => <ImageUpload value={field.value} onChange={(url) => field.onChange(url ?? '')} />}
          />
        </Field>
      </div>

      <Field label="WhatsApp description" htmlFor="waDesc" hint="Caption sent when this package is shared on WhatsApp. Plain text only.">
        <Textarea id="waDesc" rows={3} placeholder="Short pitch for WhatsApp…" {...register('whatsappDescription')} />
      </Field>

      <Field label="Description" htmlFor="description" hint="Full package description shown on the public page.">
        <Textarea id="description" rows={6} placeholder="Write package description…" {...register('description')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact number" htmlFor="contactNumber">
          <Input id="contactNumber" placeholder="+91-XXXX-XXXX" {...register('contactNumber')} />
        </Field>
        <Field label="Contact email" htmlFor="contactEmail" error={errors.contactEmail?.message}>
          <Input id="contactEmail" type="email" placeholder="hello@example.com" {...register('contactEmail')} />
        </Field>
      </div>
    </div>
  );
}

const NO_HOTEL = 'none';

/** Searchable "Select Activity" combobox that pulls an activity from the library. */
function ActivityCombobox({
  activities,
  onPick,
}: {
  activities: SightseeingActivity[];
  onPick: (a: SightseeingActivity) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  if (activities.length === 0) return null;
  const needle = q.trim().toLowerCase();
  const filtered = activities
    .filter((a) => !needle || a.name.toLowerCase().includes(needle))
    .slice(0, 8);

  return (
    <div className="relative">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Select activity — search your library…"
          className="pl-9"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-pop">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={() => {
                onPick(a);
                setQ('');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {a.imageUrl ? (
                <img src={a.imageUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                  <MapPin className="size-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{a.name}</span>
                {a.notes && <span className="block truncate text-xs text-muted-foreground">{a.notes}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItineraryStep({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const { register, control, setValue, getValues } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'itinerary' });
  const hotelsQuery = useQuery({ queryKey: ['hotels'], queryFn: () => api.get<Hotel[]>('/hotels') });
  const hotels = (hotelsQuery.data ?? []).filter((h) => h.isActive);
  const activitiesQuery = useQuery({ queryKey: ['sightseeing'], queryFn: () => api.get<SightseeingActivity[]>('/sightseeing') });
  const library = (activitiesQuery.data ?? []).filter((a) => a.isActive);

  /**
   * Pull a library activity into a day — copies name → title, description and
   * photo into THIS package's day (editing the day never touches the library).
   */
  const addActivity = (i: number, a: SightseeingActivity) => {
    if (!(getValues(`itinerary.${i}.title`) || '').trim()) {
      setValue(`itinerary.${i}.title`, a.name, { shouldDirty: true });
    }
    if (a.notes) {
      const cur = (getValues(`itinerary.${i}.description`) || '').trim();
      const next = cur && !cur.includes(a.notes) ? `${cur}\n${a.notes}` : cur || a.notes;
      setValue(`itinerary.${i}.description`, next, { shouldDirty: true });
    }
    if (a.imageUrl) {
      const imgs = getValues(`itinerary.${i}.images`) ?? [];
      if (imgs.length < 4 && !imgs.includes(a.imageUrl)) {
        setValue(`itinerary.${i}.images`, [...imgs, a.imageUrl], { shouldDirty: true });
      }
    }
  };

  return (
    <div className="space-y-4">
      <SectionLabel hint="Build the day-by-day plan — the stay, activities and photos on each day become its own page in the brochure PDF.">
        Itinerary
      </SectionLabel>
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No days yet — add the first one below.</p>
      )}
      {fields.map((f, i) => (
        <Card key={f.id} className="p-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 font-display text-sm font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              {/* Pick a saved activity to auto-fill this day's title, description & photo */}
              <ActivityCombobox activities={library} onPick={(a) => addActivity(i, a)} />
              <Input placeholder={`Day ${i + 1} title — e.g. Arrival & beach sunset`} {...register(`itinerary.${i}.title`)} />
              <Textarea rows={2} placeholder="Pickup time, transfers, plan for the day…" {...register(`itinerary.${i}.description`)} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Controller
                  control={control}
                  name={`itinerary.${i}.hotelId`}
                  render={({ field }) => (
                    <Select
                      value={field.value || NO_HOTEL}
                      onValueChange={(v) => {
                        field.onChange(v === NO_HOTEL ? '' : v);
                        const hotel = hotels.find((h) => h.id === v);
                        if (hotel) setValue(`itinerary.${i}.stay`, `${hotel.name}, ${hotel.city}`);
                      }}
                    >
                      <SelectTrigger aria-label="Stay at hotel">
                        <SelectValue placeholder="Stay: pick a hotel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_HOTEL}>No hotel / custom stay</SelectItem>
                        {hotels.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.name} — {h.city} ({'★'.repeat(h.starRating)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Input placeholder="Stay — e.g. Riverside camp, Rishikesh" {...register(`itinerary.${i}.stay`)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Activities — rafting, bonfire, trek… (comma separated)" {...register(`itinerary.${i}.activities`)} />
                <Input placeholder="Meals — e.g. Breakfast, Dinner" {...register(`itinerary.${i}.meals`)} />
              </div>
              {/* Day photos → the collage on this day's brochure page */}
              <Controller
                control={control}
                name={`itinerary.${i}.images`}
                render={({ field }) => {
                  const imgs: string[] = field.value ?? [];
                  return (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {imgs.map((url, j) => (
                        <ImageUpload
                          key={`${url}-${j}`}
                          tile
                          value={url}
                          onChange={(next) =>
                            field.onChange(next ? imgs.map((u, k) => (k === j ? next : u)) : imgs.filter((_, k) => k !== j))
                          }
                        />
                      ))}
                      {imgs.length < 4 && (
                        <ImageUpload tile value={null} onChange={(url) => url && field.onChange([...imgs, url])} />
                      )}
                    </div>
                  );
                }}
              />
              <input type="hidden" {...register(`itinerary.${i}.day`)} value={i + 1} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <GripVertical className="size-4 text-muted-foreground/40" />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove day ${i + 1}`} onClick={() => remove(i)}>
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() =>
          append({ day: String(fields.length + 1), title: '', description: '', hotelId: '', stay: '', activities: '', meals: '', images: [] })
        }
      >
        <Plus /> Add day
      </Button>
    </div>
  );
}

function LogisticsStep({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const { register } = form;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inclusions" htmlFor="inclusions" hint="One per line.">
          <Textarea id="inclusions" rows={5} placeholder={'Return flights\nHotel 4★\nDaily breakfast'} {...register('inclusions')} />
        </Field>
        <Field label="Exclusions" htmlFor="exclusions" hint="One per line.">
          <Textarea id="exclusions" rows={5} placeholder={'Visa fees\nLunch & dinner\nPersonal expenses'} {...register('exclusions')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pickup / drop points" htmlFor="pickupPoints" hint="Where the trip starts and ends.">
          <Textarea id="pickupPoints" rows={4} placeholder={'Pickup: Airport T2\nDrop: Hotel lobby'} {...register('pickupPoints')} />
        </Field>
        <Field label="Things to carry" htmlFor="thingsToCarry" hint="One per line.">
          <Textarea id="thingsToCarry" rows={4} placeholder={'Passport\nSunscreen\nComfortable shoes'} {...register('thingsToCarry')} />
        </Field>
      </div>
    </div>
  );
}

function PoliciesStep({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const { register } = form;
  return (
    <div className="space-y-6">
      <Field label="Cancellation policy" htmlFor="cancellationPolicy">
        <Textarea id="cancellationPolicy" rows={4} placeholder={'Free cancellation up to 15 days before departure…'} {...register('cancellationPolicy')} />
      </Field>
      <Field label="Payment terms" htmlFor="paymentTerms">
        <Textarea id="paymentTerms" rows={4} placeholder={'25% advance to confirm, balance 7 days before travel…'} {...register('paymentTerms')} />
      </Field>
      <Field label="Terms & conditions" htmlFor="termsConditions">
        <Textarea id="termsConditions" rows={5} placeholder="Any additional terms travellers should know…" {...register('termsConditions')} />
      </Field>
    </div>
  );
}

function FaqsStep({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const { register, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'faqs' });
  return (
    <div className="space-y-4">
      <SectionLabel hint="Answer common questions to reduce back-and-forth.">Frequently asked questions</SectionLabel>
      {fields.length === 0 && <p className="text-sm text-muted-foreground">No FAQs yet.</p>}
      {fields.map((f, i) => (
        <Card key={f.id} className="p-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <HelpCircle className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <Input placeholder="Question — e.g. Are flights included?" {...register(`faqs.${i}.question`)} />
              <Textarea rows={2} placeholder="Answer…" {...register(`faqs.${i}.answer`)} />
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove FAQ ${i + 1}`} onClick={() => remove(i)}>
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        </Card>
      ))}
      <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => append({ question: '', answer: '' })}>
        <Plus /> Add FAQ
      </Button>
    </div>
  );
}

function ExtraStep({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const { register, control } = form;
  const highlights = useFieldArray({ control, name: 'highlights' });
  const gallery = useFieldArray({ control, name: 'galleryImages' });
  return (
    <div className="space-y-8">
      <div>
        <SectionLabel hint="Punchy one-liners shown as bullet highlights.">Highlights</SectionLabel>
        <div className="space-y-2">
          {highlights.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <Input placeholder="e.g. Private sunset dinner on the beach" className="flex-1" {...register(`highlights.${i}.value`)} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove highlight" onClick={() => highlights.remove(i)}>
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" className="mt-2 w-full border-dashed" onClick={() => highlights.append({ value: '' })}>
          <Plus /> Add highlight
        </Button>
      </div>

      <div>
        <SectionLabel hint="Paste image URLs — thumbnails preview below.">Gallery images</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gallery.fields.map((f, i) => (
            <div key={f.id} className="relative">
              <Controller
                control={control}
                name={`galleryImages.${i}.value`}
                render={({ field }) => (
                  <ImageUpload tile value={field.value} onChange={(url) => field.onChange(url ?? '')} />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove image"
                className="absolute right-1 top-1 bg-white/90 shadow-sm"
                onClick={() => gallery.remove(i)}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => gallery.append({ value: '' })}
            className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          >
            <Plus className="size-5" />
            <span className="text-xs font-semibold">Add image</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const v = form.watch();
  const price = Number(v.priceAmount) || 0;
  const original = Number(v.originalPrice) || 0;
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Name', value: v.name || '—' },
    { label: 'Destination', value: v.destination || '—' },
    { label: 'Duration', value: `${v.nights || 0}N / ${v.days || 0}D` },
    {
      label: 'Price',
      value: (
        <span>
          {formatCurrency(price, v.priceCurrency || 'INR')}
          {original > price && <span className="ml-2 text-muted-foreground line-through">{formatCurrency(original, v.priceCurrency || 'INR')}</span>}
        </span>
      ),
    },
    { label: 'Categories', value: v.categories.filter((c) => c.value).map((c) => c.value).join(', ') || '—' },
    { label: 'Itinerary days', value: String(v.itinerary.filter((d) => d.title.trim()).length) },
    { label: 'FAQs', value: String(v.faqs.filter((f) => f.question.trim()).length) },
    { label: 'Highlights', value: String(v.highlights.filter((h) => h.value.trim()).length) },
    { label: 'Public slug', value: v.slug || 'auto-generated' },
  ];
  return (
    <div className="space-y-6">
      <SectionLabel hint="Double-check everything, then publish or save as draft.">Review</SectionLabel>
      <Card className="divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm text-muted-foreground">{r.label}</span>
            <span className="text-right text-sm font-medium text-foreground">{r.value}</span>
          </div>
        ))}
      </Card>

      <Controller
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface/60 p-4">
            <div>
              <p className="font-semibold text-foreground">Publish this package</p>
              <p className="text-sm text-muted-foreground">
                Published packages appear on your host page and can be attached to bookings.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={field.value}
              onClick={() => field.onChange(!field.value)}
              className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', field.value ? 'bg-primary' : 'bg-muted')}
            >
              <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', field.value ? 'left-6' : 'left-1')} />
            </button>
          </div>
        )}
      />

      <Controller
        control={form.control}
        name="showOnLinktree"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface/60 p-4">
            <div>
              <p className="font-semibold text-foreground">Show on LinkTree</p>
              <p className="text-sm text-muted-foreground">
                ON = this package's card appears automatically on your public LinkTree page.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={field.value}
              onClick={() => field.onChange(!field.value)}
              className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', field.value ? 'bg-emerald-500' : 'bg-muted')}
            >
              <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', field.value ? 'left-6' : 'left-1')} />
            </button>
          </div>
        )}
      />
    </div>
  );
}

/* ------------------------------ AI generation ------------------------------ */

interface AiResult {
  description: string;
  highlights: string[];
  inclusions: string;
  exclusions: string;
  itinerary: { day: number; title: string; description: string }[];
  faqs: { question: string; answer: string }[];
}

function AiGenerateDialog({
  form,
  open,
  onOpenChange,
}: {
  form: ReturnType<typeof useForm<Values>>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const mutation = useMutation({
    mutationFn: () => {
      const v = form.getValues();
      return api.post<AiResult>('/ai/generate-package', {
        prompt: prompt.trim() || undefined,
        name: v.name || undefined,
        destination: v.destination || undefined,
        nights: v.nights ? Number(v.nights) : undefined,
        days: v.days ? Number(v.days) : undefined,
        priceAmount: v.priceAmount ? Number(v.priceAmount) : undefined,
        currency: v.priceCurrency || undefined,
      });
    },
    onSuccess: (ai) => {
      const cur = form.getValues();
      form.reset({
        ...cur,
        description: ai.description || cur.description,
        inclusions: ai.inclusions || cur.inclusions,
        exclusions: ai.exclusions || cur.exclusions,
        itinerary: ai.itinerary?.length
          ? ai.itinerary.map((d) => ({
              day: String(d.day),
              title: d.title,
              description: d.description ?? '',
              hotelId: '',
              stay: '',
              activities: '',
              meals: '',
              images: [],
            }))
          : cur.itinerary,
        highlights: ai.highlights?.length ? ai.highlights.map((value) => ({ value })) : cur.highlights,
        faqs: ai.faqs?.length ? ai.faqs : cur.faqs,
      });
      toast.success('AI drafted the package — review and tweak across the steps');
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'AI_NOT_CONFIGURED') {
        toast.error("AI isn't set up yet — add a Gemini API key on the server to enable it.");
      } else {
        toast.error(err instanceof ApiError ? err.message : 'AI generation failed, please try again');
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Auto-generate with AI
          </DialogTitle>
          <DialogDescription>
            Gemini drafts the description, day-by-day itinerary, inclusions, highlights and FAQs from
            your basics. You can edit everything afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Anything specific? (optional)" htmlFor="aiPrompt">
            <Textarea
              id="aiPrompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. luxury honeymoon, vegetarian meals, focus on adventure activities…"
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Uses your current <b>Name</b>, <b>Destination</b>, <b>Duration</b> and <b>Price</b> as context.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : <Sparkles />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiBanner({ enabled, onOpen }: { enabled: boolean; onOpen: () => void }) {
  if (!enabled) {
    return (
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="font-display text-sm font-bold text-foreground">AI drafting · setup needed</p>
            <p className="text-xs text-muted-foreground">Add a Gemini API key on the server to auto-write packages.</p>
          </div>
        </div>
        <Button type="button" variant="outline" disabled>
          <Sparkles /> Auto-generate
        </Button>
      </div>
    );
  }
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-primary to-violet-600 p-4 text-white shadow-pop sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="font-display text-sm font-bold">Let AI draft this package</p>
          <p className="text-xs text-white/75">Gemini writes the description, itinerary, inclusions, highlights & FAQs from your basics.</p>
        </div>
      </div>
      <Button type="button" className="bg-white text-primary hover:bg-white/90" onClick={onOpen}>
        <Sparkles /> Auto-generate
      </Button>
    </div>
  );
}

/* ----------------------------------- page ---------------------------------- */

export function PackageBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  // Template chosen from the Basics-step dropdown (optional).
  const [templateId, setTemplateId] = useState('');

  const pkgQuery = useQuery({
    queryKey: ['package', id],
    queryFn: () => api.get<TravelPackage>(`/packages/${id}`),
    enabled: isEdit,
  });
  const aiStatusQuery = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get<{ enabled: boolean }>('/ai/status'),
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm<Values>({ defaultValues: toValues(null) });
  const { reset, handleSubmit } = form;

  /** Seed the builder from a premium template, keeping anything already typed. */
  const applyTemplate = (tpl: PackageTemplate) => {
    const cur = form.getValues();
    reset({
      ...toValues(null),
      ...tpl.seed,
      // preserve the identity fields the agent may have already entered
      name: cur.name,
      code: cur.code,
      destination: cur.destination,
      bookingTitle: cur.bookingTitle,
      priceAmount: cur.priceAmount,
      originalPrice: cur.originalPrice,
      priceCurrency: cur.priceCurrency,
      bannerImageUrl: cur.bannerImageUrl,
    });
    setStep(0);
    toast.success(`${tpl.name} template applied — customise the details`);
  };

  // Populate once the package loads (edit mode).
  const [hydrated, setHydrated] = useState(false);
  if (isEdit && pkgQuery.data && !hydrated) {
    reset(toValues(pkgQuery.data));
    setHydrated(true);
  }

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEdit ? api.patch<TravelPackage>(`/packages/${id}`, payload) : api.post<TravelPackage>('/packages', payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['package', saved.id] });
      toast.success(isEdit ? 'Package saved' : 'Package created');
      navigate('/packages');
    },
    onError: (err: unknown) => {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Could not save package';
      toast.error(msg);
    },
  });

  const onSave = handleSubmit((v) => mutation.mutate(toPayload(v)), () => {
    toast.error('Please fill the required fields on the Basics step');
    setStep(0);
  });

  if (isEdit && pkgQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  const isPublished = form.watch('isActive');

  return (
    <form onSubmit={onSave}>
      {/* Sticky sub-header */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label="Back to packages" onClick={() => navigate('/packages')}>
              <ChevronLeft />
            </Button>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <PackageIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-foreground">
                {form.watch('name') || 'New package'}
              </p>
              <span className={cn('text-[11px] font-semibold uppercase tracking-wide', isPublished ? 'text-emerald-600' : 'text-amber-600')}>
                {isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(`/packages/${id}/brochure`, '_blank')}
              >
                <FileText /> <span className="hidden sm:inline">Brochure</span>
              </Button>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner /> : <Save />}
              Save package
            </Button>
          </div>
        </div>
      </div>

      {/* Step tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
              i === step ? 'bg-foreground text-background' : 'border border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px]', i === step ? 'bg-white/20' : 'bg-muted')}>
              {i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Optional: start from a premium template — a simple dropdown on Basics */}
      {step === 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutTemplate className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Start from a template</p>
              <p className="text-xs text-muted-foreground">Pre-fills the structure &amp; look. Optional.</p>
            </div>
          </div>
          <div className="sm:ml-auto sm:w-64">
            <Select
              value={templateId}
              onValueChange={(id) => {
                setTemplateId(id);
                const tpl = PACKAGE_TEMPLATES.find((t) => t.id === id);
                if (tpl) applyTemplate(tpl);
              }}
            >
              <SelectTrigger aria-label="Choose a template">
                <SelectValue placeholder="Choose a template…" />
              </SelectTrigger>
              <SelectContent>
                {PACKAGE_TEMPLATES.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.emoji} {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* AI drafting banner (Basics step) */}
      {step === 0 && <AiBanner enabled={!!aiStatusQuery.data?.enabled} onOpen={() => setAiOpen(true)} />}

      {/* Step body */}
      <Card className="p-5 sm:p-7">
        {step === 0 && <BasicsStep form={form} />}
        {step === 1 && <ItineraryStep form={form} />}
        {step === 2 && <LogisticsStep form={form} />}
        {step === 3 && <PoliciesStep form={form} />}
        {step === 4 && <FaqsStep form={form} />}
        {step === 5 && <ExtraStep form={form} />}
        {step === 6 && <ReviewStep form={form} />}
      </Card>

      {/* Footer nav */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Next: {STEPS[step + 1].label} <ArrowRight />
          </Button>
        ) : (
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : <Save />}
            {isEdit ? 'Save package' : 'Create package'}
          </Button>
        )}
      </div>

      <AiGenerateDialog form={form} open={aiOpen} onOpenChange={setAiOpen} />
    </form>
  );
}
