"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import {
  filterPublicAnalyticsEvent,
  shouldTrackPublicRoute
} from "@/lib/analytics/publicAnalyticsRoutes";

function filterBrowserAnalyticsEvent(event: BeforeSendEvent) {
  return filterPublicAnalyticsEvent(event, window.location.pathname);
}

export function VercelAnalytics({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  if (!enabled || !shouldTrackPublicRoute(pathname)) {
    return null;
  }

  return <Analytics beforeSend={filterBrowserAnalyticsEvent} />;
}
