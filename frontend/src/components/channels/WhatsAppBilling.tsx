import { AlertTriangle, CreditCard, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Each agency pays Meta directly for its own WhatsApp messages — the card is
 * added on Meta's site (an app can't take card details for Meta), and Meta
 * charges it automatically from then on.
 */
export const META_BILLING_URL = 'https://business.facebook.com/billing_hub/';

/** Same text the server stores on a message that failed for lack of a payment method. */
export const isWhatsAppPaymentError = (text: string | null | undefined) => !!text?.startsWith('WhatsApp needs a payment method');

const openBilling = () => window.open(META_BILLING_URL, '_blank', 'noopener,noreferrer');

/** Settings → Channels, on the connected WhatsApp card. */
export function WhatsAppBillingSection({ billingIssue }: { billingIssue?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3', billingIssue ? 'border-red-200 bg-red-50' : 'border-border bg-muted/40')}>
      <p className={cn('flex items-center gap-1.5 text-sm font-semibold', billingIssue ? 'text-red-800' : 'text-foreground')}>
        {billingIssue ? <AlertTriangle className="size-4" /> : <CreditCard className="size-4" />}
        {billingIssue ? 'Add a payment method to keep sending templates' : 'Payment method'}
      </p>
      <p className={cn('mt-1 text-xs', billingIssue ? 'text-red-700' : 'text-muted-foreground')}>
        {billingIssue
          ? 'A WhatsApp message failed because your Meta account has no payment method. Add a card on Meta — it takes about 2 minutes, then template messages work again.'
          : 'Meta charges your own card for template messages (follow-ups after 24 hours, offers). Replies within 24 hours of a customer’s message are free.'}
      </p>
      <ol className={cn('mt-2 list-decimal space-y-0.5 pl-4 text-xs', billingIssue ? 'text-red-700' : 'text-muted-foreground')}>
        <li>Open Meta Billing &amp; payments and choose your business</li>
        <li>Payment methods → Add payment method → add a credit or debit card</li>
        <li>Open the WhatsApp Business accounts tab and link that card to your WhatsApp account</li>
      </ol>
      <Button size="sm" variant={billingIssue ? 'destructive' : 'outline'} className="mt-3" onClick={openBilling}>
        <CreditCard className="size-4" /> Add payment method <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
}

/** Inbox banner while WhatsApp templates are failing for lack of a payment method. */
export function WhatsAppBillingBanner() {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
      <span className="flex items-center gap-1.5">
        <AlertTriangle className="size-3.5 shrink-0" />
        WhatsApp needs a payment method on your Meta account to send template messages.
      </span>
      <button type="button" onClick={openBilling} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
        Add payment method <ExternalLink className="size-3" />
      </button>
    </div>
  );
}

/** Under a failed message bubble. */
export function AddPaymentMethodLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openBilling} className={cn('mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2', className)}>
      Add payment method <ExternalLink className="size-3" />
    </button>
  );
}
