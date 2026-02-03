import { useConsent } from "@/context/ConsentContext";

export default function Privacy() {
  const { openPreferences } = useConsent();

  return (
    <main className="container mx-auto px-4 py-10 pt-24 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-muted-foreground">
        This Privacy Policy explains how GLASS-Connect collects, uses, and shares personal data.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">1. Data we collect</h2>
      <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
        <li>Account data (name, email, profile details) when you create or manage an account.</li>
        <li>Lab and team data you submit, including contact details and profile content.</li>
        <li>Requests and inquiries (lab requests, collaboration, investor, contact, and waitlist).</li>
        <li>Payment and billing details processed by our payment providers.</li>
        <li>
          Publicly available data for unclaimed lab listings, including lab name, location, and publicly listed contact
          details.
        </li>
        <li>
          Usage data for analytics when you consent (e.g., lab view events, session ID, and referrer).
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">2. How we use data</h2>
      <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
        <li>Provide and operate the GLASS-Connect platform.</li>
        <li>Respond to requests, collaboration inquiries, and support messages.</li>
        <li>Maintain lab listings, including verification and claim workflows.</li>
        <li>Process payments and manage subscriptions.</li>
        <li>Improve the product and understand usage patterns when analytics consent is provided.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-2">3. Legal bases (EU/EEA)</h2>
      <p className="text-muted-foreground">
        We process personal data based on your consent (for analytics and preferences), performance of a contract
        (account and service delivery), legitimate interests (security and service operations), and legal obligations
        (payments and tax).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">4. Cookies and local storage</h2>
      <p className="text-muted-foreground">
        We use cookies and local storage for functional features (preferences and draft saving) and for analytics only
        if you consent. You can manage or withdraw your preferences at any time.
      </p>
      <button
        type="button"
        onClick={openPreferences}
        className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
      >
        Manage cookie preferences
      </button>

      <h2 className="text-xl font-semibold mt-8 mb-2">5. Sharing and processors</h2>
      <p className="text-muted-foreground">
        We use trusted processors to operate the service, including Supabase (database and file storage), Stripe
        (payments), and Brevo or SMTP providers (email). Our primary database is hosted in Ireland (EU). Your data may be
        processed by these vendors under contractual safeguards.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">6. Data retention</h2>
      <p className="text-muted-foreground">
        We retain data only as long as needed for the purposes described above, including legal and operational
        requirements. You can request deletion at any time.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">7. Your rights</h2>
      <p className="text-muted-foreground">
        You can request access, correction, deletion, restriction, or portability of your data. You can also object to
        processing and withdraw consent for optional features.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">8. Contact</h2>
      <p className="text-muted-foreground">
        For privacy concerns, contact <a href="mailto:contact@glass-funding.com" className="text-primary underline">contact@glass-funding.com</a>.
      </p>

      <p className="mt-10 text-sm text-muted-foreground">Last updated: February 3, 2026</p>
    </main>
  );
}
