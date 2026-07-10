export type AvailabilityUpdateInput = {
  qrId: string;
  restaurantId: string;
  dishId: string;
  available: boolean;
};

export type AvailabilityUpdateResult =
  | {
      ok: true;
      dishId: string;
      dishSlug: string;
      available: boolean;
    }
  | { ok: false; status: 404 | 503 };

type AvailabilityDependencies = {
  requireAccess: () => Promise<
    | { ok: true; qrId: string | null; restaurantId: string }
    | { ok: false; reason?: string }
  >;
  updateAvailability: (
    input: AvailabilityUpdateInput
  ) => Promise<AvailabilityUpdateResult>;
};

const MAX_BODY_BYTES = 1_024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function isSameOriginMutation(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-origin" || fetchSite === "none";

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function parseAvailabilityInput(input: unknown):
  | { ok: true; available: boolean }
  | { ok: false } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false };
  }

  const candidate = input as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (keys.length !== 1 || keys[0] !== "available") return { ok: false };
  if (typeof candidate.available !== "boolean") return { ok: false };
  return { ok: true, available: candidate.available };
}

export async function handleAdminAvailabilityRequest(
  request: Request,
  params: Promise<{ dishId: string }>,
  dependencies: AvailabilityDependencies
): Promise<Response> {
  if (!isSameOriginMutation(request)) {
    return json({ ok: false, error: "Requête refusée." }, 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "Corps JSON requis." }, 415);
  }

  const access = await dependencies.requireAccess();
  if (!access.ok || !access.qrId) {
    return json({ ok: false, error: "Accès admin requis." }, 401);
  }

  const { dishId } = await params;
  if (!UUID_PATTERN.test(dishId)) {
    return json({ ok: false, error: "Plat invalide." }, 400);
  }

  const body = await readBoundedJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.reason === "too-large"
      ? json({ ok: false, error: "Corps trop volumineux." }, 413)
      : json({ ok: false, error: "Corps JSON invalide." }, 400);
  }

  const parsed = parseAvailabilityInput(body.value);
  if (!parsed.ok) {
    return json({ ok: false, error: "Disponibilité invalide." }, 400);
  }

  const updated = await dependencies.updateAvailability({
    qrId: access.qrId,
    restaurantId: access.restaurantId,
    dishId,
    available: parsed.available
  });
  if (!updated.ok) {
    return json(
      {
        ok: false,
        error:
          updated.status === 404
            ? "Plat introuvable."
            : "La disponibilité n’a pas pu être mise à jour."
      },
      updated.status
    );
  }

  return json(
    {
      ok: true,
      dishId: updated.dishId,
      dishSlug: updated.dishSlug,
      available: updated.available
    },
    200
  );
}
import { readBoundedJsonBody } from "./requestBody.ts";
