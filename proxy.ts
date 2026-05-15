import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest
} from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const isProtectedRoute = createRouteMatcher([
  "/owner(.*)",
  "/api/analytics/summary(.*)",
  "/api/restaurants(.*)",
  "/api/owner(.*)",
  "/todos(.*)",
]);

const needsSupabaseSession = createRouteMatcher(["/todos(.*)"]);

const handleProtectedRoute = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  if (needsSupabaseSession(request)) {
    return updateSession(request);
  }

  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}, { signInUrl: "/sign-in" });

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isProtectedRoute(request)) {
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
