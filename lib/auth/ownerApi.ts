import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import {
  getVistaireOwnerAuthorization,
  type VistaireOwnerAuthorization
} from "@/lib/auth/owner";
import {
  owner3dAccessDeniedMessage,
  ownerCanAccess3dRestaurant
} from "@/lib/auth/owner3dAccess";

type OwnerApiAuthorization =
  | Extract<VistaireOwnerAuthorization, { ok: true }>
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireVistaireOwnerApi(): Promise<OwnerApiAuthorization> {
  const authorization = await getVistaireOwnerAuthorization();

  if (!authorization.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: authorization.error
        },
        { status: authorization.status }
      )
    };
  }

  return authorization;
}

function firstHeaderValue(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function originFromProtoAndHost(proto: string, host: string): string | null {
  const cleanProto = proto.replace(/:$/, "").toLowerCase();
  const cleanHost = host.trim();
  if (!cleanProto || !cleanHost || !/^https?$/.test(cleanProto)) return null;

  try {
    return new URL(`${cleanProto}://${cleanHost}`).origin;
  } catch {
    return null;
  }
}

function envAllowedOwnerOrigins(env: NodeJS.ProcessEnv): string[] {
  return (env.VISTAIRE_OWNER_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function allowedOwnerMutationOrigins(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env
): Set<string> {
  const allowed = new Set<string>([request.nextUrl.origin]);
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = firstHeaderValue(request.headers.get("host"));

  if (forwardedProto && forwardedHost) {
    const forwardedOrigin = originFromProtoAndHost(forwardedProto, forwardedHost);
    if (forwardedOrigin) allowed.add(forwardedOrigin);
  }

  if (host) {
    const hostOrigin = originFromProtoAndHost(request.nextUrl.protocol, host);
    if (hostOrigin) allowed.add(hostOrigin);
  }

  for (const origin of envAllowedOwnerOrigins(env)) {
    allowed.add(origin);
  }

  return allowed;
}

export function requireSameOriginOwnerMutation(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();

  if (!origin || !allowedOwnerMutationOrigins(request).has(origin)) {
    return NextResponse.json(
      { ok: false, error: "Owner mutation must come from the Vistaire owner app." },
      { status: 403 }
    );
  }

  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json(
      { ok: false, error: "Owner mutation must be same-origin." },
      { status: 403 }
    );
  }

  return null;
}

export function requireOwner3dRestaurantAccess(
  owner: Extract<VistaireOwnerAuthorization, { ok: true }>,
  restaurantSlug: string
): NextResponse | null {
  if (ownerCanAccess3dRestaurant(owner, restaurantSlug)) return null;

  return NextResponse.json(
    { ok: false, error: owner3dAccessDeniedMessage() },
    { status: 403 }
  );
}
