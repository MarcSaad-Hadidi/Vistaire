import type React from "react";
import { WebMcpProvider } from "@/components/agent/WebMcpProvider";
import { MicrosoftClarity } from "@/components/analytics/MicrosoftClarity";
import { JsonLd } from "@/components/JsonLd";
import { PrivacyConsentProvider } from "@/components/privacy/PrivacyConsentProvider";
import { PrivacyUtilityBar } from "@/components/privacy/PrivacyUtilityBar";
import type { Locale } from "@/lib/i18n";
import {
  buildOrganizationJsonLd,
  buildProfessionalServiceJsonLd,
  buildWebsiteJsonLd
} from "@/lib/seo";

type VistaireDocumentShellProps = {
  locale: Locale;
  children: React.ReactNode;
};

export function VistaireDocumentShell({
  locale,
  children
}: VistaireDocumentShellProps): React.JSX.Element {
  return (
    <>
      <a className="skip-link" href="#contenu">
        {locale === "en" ? "Skip to content" : "Aller au contenu"}
      </a>
      <JsonLd
        data={[
          buildOrganizationJsonLd(),
          buildProfessionalServiceJsonLd(),
          buildWebsiteJsonLd(undefined, locale)
        ]}
      />
      <WebMcpProvider />
      <PrivacyConsentProvider locale={locale}>
        <MicrosoftClarity>
          <div id="contenu">{children}</div>
        </MicrosoftClarity>
        <PrivacyUtilityBar locale={locale} />
      </PrivacyConsentProvider>
    </>
  );
}
