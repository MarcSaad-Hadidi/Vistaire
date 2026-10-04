"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import {
  filterPublicAnalyticsEvent,
  shouldTrackPublicRoute
} from "@/lib/analytics/publicAnalyticsRoutes";

export function VercelAnalytics({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  if (!enabled || !shouldTrackPublicRoute(pathname)) {
    return null;
  }

  return <Analytics beforeSend={filterPublicAnalyticsEvent} />;
}
