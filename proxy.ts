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
import {
  ADMIN_LOCALE_COOKIE,
  ADMIN_LOCALE_HEADER,
  ADMIN_THEME_COOKIE,
  ADMIN_THEME_HEADER,
  resolveAdminPreferences
} from "@/lib/admin/preferences";
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
  "/api/analytics/summary",
]);

const needsSupabaseSession = createRouteMatcher(["/todos(.*)"]);

function sanitizedRequestHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(DEV_OWNER_BYPASS_TRUSTED_HEADER);
  requestHeaders.delete(ADMIN_LOCALE_HEADER);
  requestHeaders.delete(ADMIN_THEME_HEADER);
  const isAdminPath = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  if (isAdminPath) {
    const preferences = resolveAdminPreferences(
      request.cookies.get(ADMIN_LOCALE_COOKIE)?.value,
      request.cookies.get(ADMIN_THEME_COOKIE)?.value
    );
    requestHeaders.set(ADMIN_LOCALE_HEADER, preferences.locale);
    requestHeaders.set(ADMIN_THEME_HEADER, preferences.theme);
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
  const requestHeaders = sanitizedRequestHeaders(request);

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

function homepageMarkdownResponse(method: string): Response {
  const markdown = buildHomepageMarkdown();

  return new Response(method === "HEAD" ? null : markdown, {
    headers: {
      "Content-Type": MARKDOWN_CONTENT_TYPE,
      Link: buildHomeAgentLinkHeader(),
      Vary: "Accept",
      "x-markdown-tokens": markdownTokenEstimate(markdown)
    }
  });
}

const handleProtectedRoute = clerkMiddleware(async (auth, request) => {
  const requestHeaders = sanitizedRequestHeaders(request);

  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  if (needsSupabaseSession(request)) {
    return updateSession(request, requestHeaders);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}, { signInUrl: "/sign-in" });

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname === "/" && acceptsMarkdown(request)) {
    if (request.method === "GET" || request.method === "HEAD") {
      return homepageMarkdownResponse(request.method);
    }
  }

  if (needsClerkAuthContext(request)) {
    const bypassResponse = devOwnerBypassResponse(request);
    if (bypassResponse) return bypassResponse;

    return handleProtectedRoute(request, event);
  }

  return NextResponse.next({
    request: {
      headers: sanitizedRequestHeaders(request),
    },
  });
}

export const config = {
  matcher: [
    {
      source: "/",
      has: [
        {
          type: "header",
          key: "accept",
          value: ".*[tT][eE][xX][tT]/[mM][aA][rR][kK][dD][oO][wW][nN].*"
        }
      ]
    },
    "/owner/:path*",
    "/todos/:path*",
    "/api/restaurants/:path*",
    "/api/owner/:path*",
    "/api/analytics/summary",
    "/admin/:path*"
  ],
};
