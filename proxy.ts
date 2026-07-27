import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest
} from "next/server";
import {
  DEV_OWNER_BYPASS_COOKIE,
  DEV_OWNER_BYPASS_QUERY,
  DEV_OWNER_BYPASS_TRUSTED_HEADER,
  shouldApplyDevOwnerBypass,
  shouldApplyDevOwnerBypassToken
} from "@/lib/auth/devOwnerBypass";
import {
  MARKDOWN_CONTENT_TYPE,
  buildHomeAgentLinkHeader,
  buildHomepageMarkdown,
  markdownTokenEstimate,
  shouldServeMarkdownForAcceptHeader
} from "@/lib/agent-discovery";
import { getLocaleFromPath, VISTAIRE_LOCALE_HEADER } from "@/lib/i18n";
import {
  isSaugeNoirePath,
  SAUGE_NOIRE_ROUTE_THEME,
  VISTAIRE_ROUTE_THEME_HEADER
} from "@/lib/vistaireRouteTheme";
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

function requestHeadersWithLocale(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(DEV_OWNER_BYPASS_TRUSTED_HEADER);
  requestHeaders.set(VISTAIRE_LOCALE_HEADER, getLocaleFromPath(request.nextUrl.pathname));
  if (isSaugeNoirePath(request.nextUrl.pathname)) {
    requestHeaders.set(VISTAIRE_ROUTE_THEME_HEADER, SAUGE_NOIRE_ROUTE_THEME);
  } else {
    requestHeaders.delete(VISTAIRE_ROUTE_THEME_HEADER);
  }
  return requestHeaders;
}

function isOwnerDevBypassRoute(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname === "/owner" ||
    request.nextUrl.pathname.startsWith("/owner/") ||
    request.nextUrl.pathname.startsWith("/api/restaurants") ||
    request.nextUrl.pathname.startsWith("/api/owner/")
  );
}

function devOwnerBypassResponse(request: NextRequest): NextResponse | null {
  const requestHeaders = requestHeadersWithLocale(request);

  if (!isOwnerDevBypassRoute(request)) return null;

  const token = request.nextUrl.searchParams.get(DEV_OWNER_BYPASS_QUERY);
  const hasCookieOrHeaderBypass = shouldApplyDevOwnerBypass(request.headers);
  const hasQueryBypass = shouldApplyDevOwnerBypassToken(request.headers, token);
  if (!hasCookieOrHeaderBypass && !hasQueryBypass) {
    return null;
  }

  requestHeaders.set(DEV_OWNER_BYPASS_TRUSTED_HEADER, "1");
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (hasQueryBypass && token) {
    response.cookies.set(DEV_OWNER_BYPASS_COOKIE, token, {
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:"
    });
  }

  return response;
}

function acceptsMarkdown(request: NextRequest): boolean {
  return shouldServeMarkdownForAcceptHeader(request.headers.get("accept"));
}

function homepageMarkdownResponse(): Response {
  const markdown = buildHomepageMarkdown();

  return new Response(markdown, {
    headers: {
      "Content-Type": MARKDOWN_CONTENT_TYPE,
      Link: buildHomeAgentLinkHeader(),
      Vary: "Accept",
      "x-markdown-tokens": markdownTokenEstimate(markdown)
    }
  });
}

function withHomepageAgentDiscoveryHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  if (request.nextUrl.pathname !== "/") return response;

  response.headers.set("Link", buildHomeAgentLinkHeader());
  response.headers.append("Vary", "Accept");
  return response;
}

const handleProtectedRoute = clerkMiddleware(async (auth, request) => {
  const requestHeaders = requestHeadersWithLocale(request);

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
  if (request.nextUrl.pathname === "/" && acceptsMarkdown(request)) {
    return homepageMarkdownResponse();
  }

  if (needsClerkAuthContext(request)) {
    const bypassResponse = devOwnerBypassResponse(request);
    if (bypassResponse) return bypassResponse;

    return handleProtectedRoute(request, event);
  }

  return withHomepageAgentDiscoveryHeaders(request, NextResponse.next({
    request: {
      headers: requestHeadersWithLocale(request),
    },
  }));
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|glb|usdz)).*)",
    "/(api|trpc)(.*)",
  ],
};
