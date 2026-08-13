import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '@/components/legal/LegalLayout';

const UPDATED_AT = 'August 13, 2026';
const CONTACT_EMAIL = 'joinetra@gmail.com';

export function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" updatedAt={UPDATED_AT}>
      <p>
        Joinetra ("Joinetra", "we", "us") provides a multi-tenant CRM platform for travel agencies
        ("Customers", "agencies") to manage enquiries, bookings, and customer communication —
        including messages sent and received over WhatsApp, Instagram, and email. This Privacy
        Policy explains what data we collect, how we use it, and the choices available to you.
      </p>
      <p>
        If you're a traveler or lead who has messaged one of our Customer agencies, that agency is
        the one you're doing business with — Joinetra processes your data on their behalf, as
        described in the "Agencies and their customers" section below.
      </p>

      <LegalSection heading="1. Information we collect">
        <p>
          <strong>Account &amp; organization data.</strong> When an agency signs up, we collect the
          admin's name, email address, and a securely hashed password, plus the agency's
          organization name and any branding/profile details they choose to add (logo, contact
          info, host page content).
        </p>
        <p>
          <strong>Lead, booking &amp; customer data.</strong> Agencies enter or import data about
          their own customers — names, phone numbers, email addresses, travel preferences, booking
          and payment details — to run their business inside Joinetra.
        </p>
        <p>
          <strong>Messages.</strong> If an agency connects a WhatsApp Business number, Instagram
          account, or email inbox, Joinetra stores the messages sent and received through that
          connection so the agency's team can see and respond to them in one place (the Inbox).
        </p>
        <p>
          <strong>AI features.</strong> If an agency enables the AI Agent (reply suggestions, chat
          summaries, automated bot replies), message content is sent to the AI provider they've
          configured (currently Google Gemini) to generate a response. This is opt-in per agency.
        </p>
        <p>
          <strong>Usage &amp; log data.</strong> Standard technical data (IP address, browser type,
          timestamps, error logs) to keep the service secure and reliable.
        </p>
      </LegalSection>

      <LegalSection heading="2. How we use information">
        <ul className="list-disc space-y-2 pl-5">
          <li>To operate and provide the Joinetra platform to the agency that created the account.</li>
          <li>To deliver messages between an agency and its customers over the channels they've connected.</li>
          <li>To send account-related emails, such as sign-up verification codes.</li>
          <li>To power optional AI features an agency has explicitly turned on.</li>
          <li>To maintain security, detect abuse, and keep each organization's data isolated from every other organization on the platform.</li>
          <li>To improve the product based on aggregated, non-identifying usage patterns.</li>
        </ul>
        <p>We do not sell personal data, and we do not use customer data for third-party advertising.</p>
      </LegalSection>

      <LegalSection heading="3. Agencies and their customers">
        <p>
          Joinetra is built for multi-tenancy: each agency's data is stored in strict isolation from
          every other agency, enforced at the database level (row-level security), not just in the
          application. When an agency adds a lead, connects a WhatsApp number, or imports customer
          contacts, Joinetra acts as a <em>data processor</em> on that agency's behalf — the agency
          decides what data to collect from their customers and how it's used in their own business.
          If you're a traveler with a question about how your data is being used by a specific
          agency, please contact that agency directly.
        </p>
      </LegalSection>

      <LegalSection heading="4. Third-party services we rely on">
        <p>To provide the service, Joinetra uses the following subprocessors:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Supabase</strong> — hosted database and file storage.</li>
          <li><strong>Meta Platforms, Inc.</strong> — WhatsApp Business Platform and Instagram Graph API, used to send/receive messages on a connected agency's behalf. Messages sent through these channels are also subject to Meta's own policies.</li>
          <li><strong>Resend</strong> — transactional email delivery (sign-up verification codes, and any email channel an agency connects).</li>
          <li><strong>Google (Gemini API)</strong> — optional AI-generated reply suggestions and summaries, only when an agency enables this feature.</li>
          <li><strong>Hostinger</strong> — server hosting for the application itself.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Data retention and deletion">
        <p>
          We retain account, lead, booking, and message data for as long as an agency's account
          remains active, so they can keep running their business. An agency admin can delete
          individual records at any time from within the app. To request deletion of an entire
          organization's account and data, or to ask what data we hold about you, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your rights">
        <p>
          Depending on where you're located, you may have rights to access, correct, export, or
          delete your personal data, and to object to certain processing. To exercise any of these
          rights, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>{' '}
          — if your data was entered by a travel agency using Joinetra, we'll direct your request to
          that agency, since they control what's collected and why.
        </p>
      </LegalSection>

      <LegalSection heading="7. Cookies and sessions">
        <p>
          Joinetra uses a single essential cookie/token to keep you signed in. We don't use
          third-party advertising or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="8. Security">
        <p>
          Passwords are stored hashed, never in plain text. Channel credentials (WhatsApp/Instagram
          tokens, email provider keys) are encrypted at rest. Every organization's data is isolated
          from every other organization's using database-level row security, in addition to
          application-level checks.
        </p>
      </LegalSection>

      <LegalSection heading="9. Children's privacy">
        <p>Joinetra is intended for business use by travel agencies and is not directed at children.</p>
      </LegalSection>

      <LegalSection heading="10. Changes to this policy">
        <p>
          We may update this policy as the product evolves. Material changes will be reflected by
          updating the "Last updated" date above.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact us">
        <p>
          Questions about this policy? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>.
        </p>
        <p>
          See also our{' '}
          <Link to="/terms" className="text-primary underline-offset-2 hover:underline">
            Terms of Service
          </Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
