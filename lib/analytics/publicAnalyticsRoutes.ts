import type { BeforeSendEvent } from "@vercel/analytics/next";

const EXCLUDED_ANALYTICS_ROUTE_ROOTS = [
  "/admin",
  "/owner",
  "/todos",
  "/sign-in"
] as const;

export function shouldTrackPublicRoute(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  return !EXCLUDED_ANALYTICS_ROUTE_ROOTS.some(
    (routeRoot) => pathname === routeRoot || pathname.startsWith(`${routeRoot}/`)
  );
}

export function shouldStopMicrosoftClarityBeforeNavigation(
  currentPathname: string | null,
  targetPathname: string | null
): boolean {
  return (
    shouldTrackPublicRoute(currentPathname) &&
    !shouldTrackPublicRoute(targetPathname)
  );
}

export function shouldReloadForMicrosoftClarityBoundary(
  initialPathname: string | null,
  currentPathname: string | null
): boolean {
  return (
    shouldTrackPublicRoute(initialPathname) !==
    shouldTrackPublicRoute(currentPathname)
  );
}

export function filterPublicAnalyticsEvent(
  event: BeforeSendEvent
): BeforeSendEvent | null {
  try {
    return shouldTrackPublicRoute(new URL(event.url).pathname) ? event : null;
  } catch {
    return null;
  }
}
