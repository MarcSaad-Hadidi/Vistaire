import type { Metadata } from "next";
import Link from "next/link";
import { VistaireLegalPage } from "@/components/legal/VistaireLegalPage";

const canonicalPath = "/en/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy policy | Vistaire",
  description:
    "Vistaire privacy policy covering personal information, cookies, analytics, service providers and privacy rights.",
  alternates: {
    canonical: canonicalPath,
    languages: {
      "fr-CA": "/politique-de-confidentialite",
      "en-CA": canonicalPath
    }
  },
  robots: { index: false, follow: true }
};

export default function PrivacyPolicyPage() {
  return (
    <VistaireLegalPage
      intro="This policy explains how Vistaire handles personal information when you use its website, forms and optional analytics features."
      languageHref="/politique-de-confidentialite"
      languageLabel="FR"
      locale="en"
      title="Privacy policy"
      updatedLabel="Last updated: September 2, 2026"
    >
      <section>
        <h2>1. Scope and responsibility</h2>
        <p>
          This policy applies to the website and online services operated under the Vistaire brand. Vistaire primarily serves restaurant operators and people who view its clients’ digital menus.
        </p>
        <p>
          <strong>Privacy Officer — Vistaire</strong><br />
          Montreal, Quebec, Canada<br />
          <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
        </p>
      </section>

      <section>
        <h2>2. Information we may process</h2>
        <h3>Contact and booking requests</h3>
        <p>
          When you use the contact form, we receive information such as your name, email address, restaurant name and the message you choose to send. We use this information to respond to your request and continue the business relationship you initiate.
        </p>
        <h3>Technical and security information</h3>
        <p>
          Technical information required to operate and secure the service may be processed, including request headers, IP addresses or technical logs. The Vistaire contact form uses information derived from the IP address transiently to reduce abuse and excessive submissions.
        </p>
        <h3>Optional analytics</h3>
        <p>
          If you accept the Analytics category, Vistaire may create a pseudonymous session identifier in session storage and measure events such as menu and dish opens, viewed categories, searches, filters, calls to action, viewport dimensions and the user-agent. This helps us understand how the website and digital menus are used.
        </p>
      </section>

      <section>
        <h2>3. Cookies, local storage and Microsoft Clarity</h2>
        <p>
          Optional analytics tools are <strong>disabled by default</strong> and are activated only after your explicit choice. Your privacy preference is stored locally in your browser so the site can remember and respect that choice.
        </p>
        <p>
          With your permission, Vistaire uses <strong>Microsoft Clarity</strong> to understand interactions such as clicks, scrolling and navigation paths, including through heatmaps and session recordings. Clarity may then use cookies such as <code>_clck</code> and <code>_clsk</code>. Without your permission, Vistaire does not load the Clarity script.
        </p>
        <p>
          You may change or withdraw your choice at any time through “Privacy settings” at the bottom of public pages. Withdrawal disables optional analytics, clears Vistaire’s internal analytics session identifier and signals withdrawal to Clarity.
        </p>
      </section>

      <section>
        <h2>4. Purposes</h2>
        <ul>
          <li>respond to inquiries and schedule discussions with restaurant operators;</li>
          <li>operate, secure and diagnose the website and digital menus;</li>
          <li>measure usage and improve the experience when analytics has been accepted;</li>
          <li>meet applicable legal obligations and protect the rights, security and integrity of Vistaire and its users.</li>
        </ul>
      </section>

      <section>
        <h2>5. Service providers and disclosures</h2>
        <p>
          Vistaire uses <strong>Brevo</strong> to transmit requests submitted through the contact form. Information you enter in the form may therefore be disclosed to Brevo for that purpose.
        </p>
        <p>
          When you accept analytics, usage data may be disclosed to <strong>Microsoft Clarity</strong>. Depending on the feature used, Vistaire may also rely on technical hosting, database or authentication providers, including Vercel, Supabase and Clerk, only to the extent needed to operate the relevant service.
        </p>
        <p>We do not sell personal information collected through the website.</p>
      </section>

      <section>
        <h2>6. Processing outside Quebec</h2>
        <p>
          Some technology providers may process information outside Quebec or Canada depending on their infrastructure and the services used. Where a disclosure outside Quebec is contemplated, Vistaire applies the applicable legal requirements and assesses required safeguards before the disclosure when such an assessment is required.
        </p>
      </section>

      <section>
        <h2>7. Retention and security</h2>
        <p>
          Vistaire retains information only for the period reasonably necessary for the purposes described, security needs, relationship management and applicable legal obligations. Retention periods may vary depending on the information and provider involved.
        </p>
        <p>
          Reasonable administrative, technical and organizational measures are used to reduce unauthorized access, loss, use or disclosure. No Internet-connected system can be guaranteed to be absolutely secure.
        </p>
      </section>

      <section>
        <h2>8. Your rights and choices</h2>
        <p>
          Subject to applicable rules, you may request access to or correction of your personal information, ask questions about its handling, withdraw consent where processing relies on consent, or submit a complaint to the Privacy Officer.
        </p>
        <p>
          To exercise a right or ask a question, email <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>. You may also contact Quebec’s Commission d’accès à l’information where permitted by law.
        </p>
      </section>

      <section>
        <h2>9. Changes</h2>
        <p>
          We may update this policy when Vistaire’s practices, providers or obligations change. The date at the top of this page identifies the current version.
        </p>
        <p>
          See also our <Link href="/en/terms-of-use">Terms of use</Link>.
        </p>
      </section>
    </VistaireLegalPage>
  );
}
