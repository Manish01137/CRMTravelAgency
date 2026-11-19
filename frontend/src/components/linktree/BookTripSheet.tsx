import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, FileText, Loader2, MapPin, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { LinktreeModulePackage } from '@/types';

/** What the sheet shows about the trip. */
export type SheetTrip = Pick<LinktreeModulePackage, 'id' | 'name' | 'days' | 'nights' | 'priceAmount' | 'priceCurrency' | 'bannerImageUrl'>;

/** The visitor's details, remembered on this device so the next trip's form is pre-filled. */
const contactKey = (slug: string) => `lt-contact:${slug}`;
function loadContact(slug: string): { name: string; phone: string; email: string } | null {
  try {
    return JSON.parse(localStorage.getItem(contactKey(slug)) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * LinkTree "BOOK" or "PDF" → a dark bottom sheet (centred card on wider
 * screens): the trip, name / phone / email. BOOK sends an enquiry; PDF asks
 * for the same details before the brochure opens. Either way it becomes a
 * lead for that trip in the agency's Leads.
 */
export function BookTripSheet({
  slug,
  pkg,
  mode = 'book',
  agencyName,
  whatsappHref,
  onClose,
  endpoint,
  showTripLink = true,
}: {
  /** The agency's slug — also where this visitor's details are remembered. */
  slug: string;
  pkg: SheetTrip | null;
  /** Where the form posts (default: the LinkTree enquiry). */
  endpoint?: string;
  /** "Open the full trip page" — hidden when already on it. */
  showTripLink?: boolean;
  mode?: 'book' | 'pdf';
  agencyName: string;
  /** wa.me link for this trip, when the agency has a WhatsApp number. */
  whatsappHref: string | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Fresh form for each trip; Esc closes; the page behind doesn't scroll.
  useEffect(() => {
    if (!pkg) return;
    setError(null);
    setDone(false);
    const saved = loadContact(slug);
    if (saved) {
      setName((n) => n || saved.name);
      setPhone((p) => p || saved.phone);
      setEmail((e) => e || saved.email);
    }
    const t = setTimeout(() => nameRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [pkg, onClose, slug]);

  const digits = phone.replace(/\D/g, '');
  const phoneOk = digits.length >= 7 && digits.length <= 15;
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = !!name.trim() && phoneOk && emailOk && !sending;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!pkg || !canSend) return;
    setSending(true);
    setError(null);
    try {
      await api.post(endpoint ?? `/public/linktree/${slug}/enquiry`, { packageId: pkg.id, name: name.trim(), phone: phone.trim(), email: email.trim(), website: trap, intent: mode });
      try {
        localStorage.setItem(contactKey(slug), JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() }));
      } catch {
        /* private mode — they just type again next time */
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message.replace(/^Validation failed — [a-zA-Z.]+: /, '') : 'Could not send — please check your connection and try again');
    } finally {
      setSending(false);
    }
  }

  // Keep the last mode while the sheet slides away (mode resets when it closes).
  const lastMode = useRef(mode);
  if (pkg) lastMode.current = mode;
  const pdf = lastMode.current === 'pdf';
  const input =
    'h-14 w-full rounded-2xl border border-white/10 bg-[#2a2b31] px-5 text-[16px] text-white outline-none transition-colors placeholder:text-white/45 focus:border-white/40';

  return (
    <AnimatePresence>
      {pkg && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#060914]/60 backdrop-blur-md" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={pdf ? 'Get the trip brochure' : 'Book this trip'}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#151619] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 text-white shadow-[0_-20px_60px_rgba(0,0,0,.5)] sm:max-w-md sm:rounded-[28px] sm:pb-7"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold uppercase tracking-[0.22em] text-white/90">
                {done ? (pdf ? 'Brochure ready' : 'Enquiry sent') : pdf ? 'Get the brochure' : 'Book this trip'}
              </h2>
              <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10">
                <X className="size-5" />
              </button>
            </div>

            {/* The trip */}
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
              <span className="size-[72px] shrink-0 overflow-hidden rounded-xl bg-white/10">
                {pkg.bannerImageUrl ? (
                  <img src={pkg.bannerImageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-white/40">
                    <MapPin className="size-6" />
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[16px] font-semibold leading-snug">{pkg.name}</span>
                <span className="mt-1 block text-[13px] text-white/55">
                  {pkg.days} Days · {pkg.nights} Nights
                </span>
                <span className="mt-1 block">
                  <span className="text-[19px] font-bold text-[#5ee59a]">{formatCurrency(pkg.priceAmount, pkg.priceCurrency)}</span>
                  <span className="text-[13px] text-white/55"> / person</span>
                </span>
              </span>
            </div>

            {done ? (
              <div className="mt-6 text-center">
                <CheckCircle2 className="mx-auto size-12 text-[#5ee59a]" />
                <p className="mt-3 text-[17px] font-semibold">Thank you, {name.trim().split(' ')[0]}!</p>
                <p className="mt-1 text-[14px] text-white/60">
                  {pdf ? 'Your trip brochure is ready.' : `${agencyName} will call you shortly about this trip.`}
                </p>
                {pdf && (
                  <a
                    href={`/p/${pkg.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold uppercase tracking-[0.18em] text-[#111]"
                  >
                    <FileText className="size-5" /> Open brochure
                  </a>
                )}
                {whatsappHref && (
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl bg-[#25D366] text-[15px] font-bold tracking-wide text-white">
                    Chat on WhatsApp now
                  </a>
                )}
                <button type="button" onClick={onClose} className="mt-3 h-12 w-full rounded-2xl border border-white/15 text-[14px] font-semibold text-white/80 hover:bg-white/5">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={send} className="mt-5 space-y-3.5" noValidate>
                <input ref={nameRef} className={input} placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                <input className={input} placeholder="Phone number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
                <input className={input} placeholder="Email (optional)" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
                {/* Honeypot: hidden from people, filled by bots */}
                <input tabIndex={-1} aria-hidden autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" name="website" />
                {(error || (phone && !phoneOk) || !emailOk) && (
                  <p className="px-1 text-[13px] text-[#ff8a8a]">{error ?? (!phoneOk ? 'Enter a valid phone number' : 'Enter a valid email')}</p>
                )}
                <button
                  type="submit"
                  disabled={!canSend}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold uppercase tracking-[0.22em] text-[#111] transition-opacity disabled:opacity-60"
                >
                  {sending && <Loader2 className="size-4 animate-spin" />}
                  {pdf ? 'Get brochure' : 'Send enquiry'}
                </button>
                {showTripLink && (
                  <p className="pt-1 text-center text-[13.5px] text-white/50">
                    Prefer to read everything first?{' '}
                    <a href={`/p/${pkg.id}`} className="text-white/80 underline underline-offset-4 hover:text-white">
                      Open the full trip page
                    </a>
                  </p>
                )}
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
