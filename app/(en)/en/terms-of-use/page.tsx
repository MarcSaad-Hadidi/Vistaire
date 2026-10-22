import type { Metadata } from "next";
import Link from "next/link";
import { VistaireLegalPage } from "@/components/legal/VistaireLegalPage";

const canonicalPath = "/en/terms-of-use";

export const metadata: Metadata = {
  title: "Terms of use | Vistaire",
  description: "Terms governing use of the public Vistaire website.",
  alternates: {
    canonical: canonicalPath,
    languages: {
      "fr-CA": "/conditions-utilisation",
      "en-CA": canonicalPath
    }
  },
  robots: { index: false, follow: true }
};

export default function TermsOfUsePage() {
  return (
    <VistaireLegalPage
      intro="These terms govern use of the public Vistaire website. They do not replace the separate services agreement entered into with a restaurant client."
      languageHref="/conditions-utilisation"
      languageLabel="FR"
      locale="en"
      title="Terms of use"
      updatedLabel="Last updated: September 2, 2026"
    >
      <section>
        <h2>1. Acceptance and scope</h2>
        <p>
          By using this website, you agree to comply with these terms and applicable law. If you do not agree, you should stop using the website.
        </p>
        <p>
          Commercial offers, subscriptions, deliverables, payments, renewals and other terms of Vistaire services for restaurants are governed by the applicable quote, order form or services agreement, not by this page.
        </p>
      </section>

      <section>
        <h2>2. Permitted use</h2>
        <p>You may use the website to learn about Vistaire, view demonstrations and contact us.</p>
        <p>You must not:</p>
        <ul>
          <li>attempt to bypass access, security or abuse-prevention controls;</li>
          <li>disrupt the website or send abusive automated requests;</li>
          <li>substantially copy, extract or reuse the website, visuals, interfaces or content without authorization where the law does not permit it;</li>
          <li>use the website for fraudulent, unlawful or rights-infringing purposes.</li>
        </ul>
      </section>

      <section>
        <h2>3. Intellectual property</h2>
        <p>
          Unless stated otherwise, the Vistaire website, presentation, text, graphics, interfaces, demonstrations and other original content are protected by applicable intellectual-property rights. Third-party trademarks, images and content remain the property of their respective owners.
        </p>
      </section>

      <section>
        <h2>4. Demonstrations and information</h2>
        <p>
          Demonstrations, examples, informational pricing, editorial content and descriptions may change. We make reasonable efforts to keep the information accurate, but errors, omissions or temporary unavailability may occur.
        </p>
      </section>

      <section>
        <h2>5. Third-party services and links</h2>
        <p>
          Some functions may depend on third-party services or websites. Their availability, terms and privacy practices are controlled by their respective operators. A link to a third party is not a guarantee or endorsement of all of its content.
        </p>
      </section>

      <section>
        <h2>6. Availability and liability</h2>
        <p>
          Vistaire may modify, suspend or maintain the website to support its evolution, security or reliability. To the extent permitted by law, Vistaire is not liable for indirect losses arising solely from access to the public website or its temporary unavailability. Nothing in these terms excludes liability that cannot lawfully be excluded.
        </p>
      </section>

      <section>
        <h2>7. Privacy</h2>
        <p>
          Personal-information handling on the website is described in our <Link href="/en/privacy-policy">Privacy policy</Link>. Optional analytics features are controlled separately through your privacy settings.
        </p>
      </section>

      <section>
        <h2>8. Governing law and changes</h2>
        <p>
          These terms are governed by the applicable laws of Quebec and the federal laws of Canada applicable there, subject to mandatory rules that may otherwise protect a user. Vistaire may update these terms; the date at the top identifies the current version.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions about these terms: <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>.
        </p>
      </section>
    </VistaireLegalPage>
  );
}
