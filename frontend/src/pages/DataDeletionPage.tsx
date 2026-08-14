import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '@/components/legal/LegalLayout';

const UPDATED_AT = 'August 13, 2026';
const CONTACT_EMAIL = 'joinetra@gmail.com';

export function DataDeletionPage() {
  return (
    <LegalLayout title="Data Deletion Instructions" updatedAt={UPDATED_AT}>
      <p>
        This page explains how to request deletion of your personal data from Joinetra, including
        data connected through Facebook, WhatsApp, or Instagram integrations.
      </p>

      <LegalSection heading="If you're a travel agency using Joinetra">
        <p>
          You're in control of your own organization's data at any time from within the app —
          individual leads, bookings, and messages can be deleted directly from their respective
          pages. To delete your <em>entire</em> organization's account, including all leads,
          bookings, connected channels, and team members, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>{' '}
          from the email address associated with your admin account. We'll confirm your identity
          and permanently delete your organization's data within 30 days.
        </p>
      </LegalSection>

      <LegalSection heading="If you're a customer/lead of a travel agency using Joinetra">
        <p>
          If a travel agency has entered your contact details or messaged you through Joinetra
          (for example, over WhatsApp or Instagram), that agency controls your data — please
          contact them directly to request deletion. If you're not sure which agency that is, or
          can't reach them, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>{' '}
          with as much detail as you can (the agency's name, your phone number or email used in the
          conversation) and we'll help track it down.
        </p>
      </LegalSection>

      <LegalSection heading="What gets deleted">
        <p>
          A deletion request removes the underlying records (contact details, message history,
          booking records) from Joinetra's database. Some minimal information may be retained
          where required by law (for example, financial records for tax purposes) or to prevent
          fraud, for the shortest time necessary.
        </p>
      </LegalSection>

      <LegalSection heading="Facebook / Instagram / WhatsApp connections">
        <p>
          Disconnecting a WhatsApp or Instagram channel from Settings → Communication immediately
          revokes Joinetra's access to that account and deletes the stored connection credentials.
          This is separate from removing the Joinetra app from your Facebook account settings,
          which you can also do directly through Facebook's own{' '}
          <a
            href="https://www.facebook.com/settings?tab=business_tools"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Business Integrations
          </a>{' '}
          settings.
        </p>
      </LegalSection>

      <LegalSection heading="Contact us">
        <p>
          Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>{' '}
          for any data deletion request. See also our{' '}
          <Link to="/privacy" className="text-primary underline-offset-2 hover:underline">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link to="/terms" className="text-primary underline-offset-2 hover:underline">
            Terms of Service
          </Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
