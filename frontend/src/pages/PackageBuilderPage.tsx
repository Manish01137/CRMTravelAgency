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
  GripVertical,
  HelpCircle,
  ListChecks,
  MapPin,
  Package as PackageIcon,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TravelPackage } from '@/types';
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
import { ImageUpload } from '@/components/ui/image-upload';
import { formatCurrency } from '@/lib/format';

/* ------------------------------- form shape -------------------------------- */

interface Values {
  name: string;
  code: string;
  viewType: 'CLASSIC' | 'MODERN' | 'MINIMAL';
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
  itinerary: { day: string; title: string; description: string }[];
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
}

const STEPS = [
  { key: 'basics', label: 'Basics', Icon: PackageIcon },
  { key: 'itinerary', label: 'Itinerary', Icon: MapPin },
  { key: 'logistics', label: 'Logistics', Icon: ListChecks },
  { key: 'policies', label: 'Policies', Icon: CheckCircle2 },
  { key: 'faqs', label: 'FAQs', Icon: HelpCircle },
  { key: 'extra', label: 'Extra', Icon: Sparkles },
  { key: 'review', label: 'Review', Icon: Star },
] as const;

function toValues(pkg: TravelPackage | null): Values {
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
    itinerary: (pkg?.itinerary ?? []).map((d) => ({ day: String(d.day), title: d.title, description: d.description ?? '' })),
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
      .map((d, i) => ({ day: Number(d.day) || i + 1, title: d.title.trim(), description: d.description.trim() || undefined })),
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
                  <SelectItem value="CLASSIC">Classic</SelectItem>
                  <SelectItem value="MODERN">Modern</SelectItem>
                  <SelectItem value="MINIMAL">Minimal</SelectItem>
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

function ItineraryStep({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const { register, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'itinerary' });
  return (
    <div className="space-y-4">
      <SectionLabel hint="Build the day-by-day plan travellers will see.">Itinerary</SectionLabel>
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
              <Input placeholder={`Day ${i + 1} title — e.g. Arrival & beach sunset`} {...register(`itinerary.${i}.title`)} />
              <Textarea rows={2} placeholder="Pickup time, hotel, activities…" {...register(`itinerary.${i}.description`)} />
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
      <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => append({ day: String(fields.length + 1), title: '', description: '' })}>
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

  const pkgQuery = useQuery({
    queryKey: ['package', id],
    queryFn: () => api.get<TravelPackage>(`/packages/${id}`),
    enabled: isEdit,
  });

  const form = useForm<Values>({ defaultValues: toValues(null) });
  const { reset, handleSubmit } = form;

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
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner /> : <Save />}
            Save package
          </Button>
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
    </form>
  );
}
