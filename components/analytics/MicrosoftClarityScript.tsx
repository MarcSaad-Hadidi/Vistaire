"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import {
  shouldLoadMicrosoftClarity,
  shouldReloadForMicrosoftClarityBoundary
} from "@/lib/analytics/microsoftClarityRoutes";

declare global {
  interface Window {
    __vistaireClarityBlocked?: boolean;
    __vistaireClarityPathname?: string;
    clarity?: (...args: unknown[]) => void;
  }
}

type MicrosoftClarityScriptProps = {
  children: ReactNode;
  projectId: string;
};

export function MicrosoftClarityScript({
  children,
  projectId
}: MicrosoftClarityScriptProps) {
  const pathname = usePathname();
  const { analyticsAllowed, hydrated } = usePrivacyConsent();
  const [initialPathname] = useState(pathname);
  const shouldLoad = shouldLoadMicrosoftClarity(pathname);
  const shouldReload = shouldReloadForMicrosoftClarityBoundary(
    initialPathname,
    pathname
  );

  useLayoutEffect(() => {
    window.__vistaireClarityPathname = pathname;

    if (!shouldReload) {
      return;
    }

    if (!shouldLoad) {
      window.__vistaireClarityBlocked = true;
      window.clarity?.("stop");
    }
    window.location.reload();
  }, [pathname, shouldLoad, shouldReload]);

  useEffect(() => {
    if (!hydrated || !window.clarity) return;

    if (analyticsAllowed && shouldLoad) {
      window.clarity("consentv2", {
        ad_Storage: "denied",
        analytics_Storage: "granted"
      });
      return;
    }

    window.clarity("consentv2", {
      ad_Storage: "denied",
      analytics_Storage: "denied"
    });
    window.clarity("consent", false);
  }, [analyticsAllowed, hydrated, shouldLoad]);

  if (shouldReload) {
    return null;
  }

  if (!shouldLoad) {
    return children;
  }

  if (!analyticsAllowed) {
    return children;
  }

  return (
    <>
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`
          if (!window.__vistaireClarityBlocked) {
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${projectId}");
            window.clarity("consentv2", {
              ad_Storage: "denied",
              analytics_Storage: "granted"
            });
          }
        `}
      </Script>
      {children}
    </>
  );
}
