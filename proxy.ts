import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest
} from "next/server";
import {
  DEV_OWNER_BYPASS_QUERY,
  DEV_OWNER_BYPASS_TRUSTED_HEADER,
  shouldApplyDevOwnerBypass,
  shouldApplyDevOwnerBypassToken
} from "@/lib/auth/devOwnerBypass";
import { updateSession } from "@/utils/supabase/middleware";

const isProtectedRoute = createRouteMatcher([
  "/owner(.*)",
  "/todos(.*)",
]);

const needsClerkAuthContext = createRouteMatcher([
  "/owner(.*)",
  "/todos(.*)",
  "/api/restaurants(.*)",
  "/api/owner(.*)",
  "/api/analytics/summary(.*)",
]);

const needsSupabaseSession = createRouteMatcher(["/todos(.*)"]);

function isOwnerDevBypassRoute(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname === "/owner" ||
    request.nextUrl.pathname.startsWith("/owner/") ||
    request.nextUrl.pathname.startsWith("/api/restaurants") ||
    request.nextUrl.pathname.startsWith("/api/owner/")
  );
}

function devOwnerBypassResponse(request: NextRequest): NextResponse | null {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(DEV_OWNER_BYPASS_TRUSTED_HEADER);

  if (!isOwnerDevBypassRoute(request)) return null;

  const token = request.nextUrl.searchParams.get(DEV_OWNER_BYPASS_QUERY);
  if (
    !shouldApplyDevOwnerBypass(request.headers) &&
    !shouldApplyDevOwnerBypassToken(request.headers, token)
  ) {
    return null;
  }

  requestHeaders.set(DEV_OWNER_BYPASS_TRUSTED_HEADER, "1");
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

const handleProtectedRoute = clerkMiddleware(async (auth, request) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(DEV_OWNER_BYPASS_TRUSTED_HEADER);

  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  if (needsSupabaseSession(request)) {
    return updateSession(request);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}, { signInUrl: "/sign-in" });

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (needsClerkAuthContext(request)) {
    const bypassResponse = devOwnerBypassResponse(request);
    if (bypassResponse) return bypassResponse;

    return handleProtectedRoute(request, event);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|glb|usdz)).*)",
    "/(api|trpc)(.*)",
  ],
};
