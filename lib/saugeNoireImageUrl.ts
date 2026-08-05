const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const ENCODED_CONTROL_CHARACTER_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

type SaugeNoireImageUrlOptions = Readonly<{
  baseOrigin?: string;
  allowedOrigins?: readonly string[];
}>;

function originOf(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.origin === "null" ? null : parsed.origin;
  } catch {
    return null;
  }
}

function configuredImageOrigins(): string[] {
  const configured = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Existing deployments use this allowlist for their static media CDN.
    process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS
  ];
  return configured
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => originOf(value.trim()))
    .filter((value): value is string => value !== null);
}

/**
 * Resolve an image source that came from a PageFlip DOM attribute.
 *
 * A leading slash is intentionally the only relative form accepted. Absolute
 * URLs must be HTTPS, credential-free, and point at the current origin or an
 * explicitly configured Vistaire media origin (for example a Supabase signed
 * URL). Returning null makes the caller remove the active `src` attribute.
 */
export function resolveSaugeNoireImageUrl(
  value: string | null | undefined,
  options: SaugeNoireImageUrlOptions = {}
): string | null {
  if (typeof value !== "string") return null;
  if (value !== value.trim()) return null;
  const trimmed = value;
  if (
    !trimmed ||
    CONTROL_CHARACTER_PATTERN.test(trimmed) ||
    ENCODED_CONTROL_CHARACTER_PATTERN.test(trimmed) ||
    /\s/.test(trimmed) ||
    trimmed.includes("\\") ||
    trimmed.startsWith("//")
  ) {
    return null;
  }

  const authority =
    trimmed.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/)?.[1] ?? "";
  if (authority.includes("@")) return null;

  const baseOrigin =
    originOf(
      options.baseOrigin ??
        (typeof window !== "undefined" ? window.location.origin : "https://vistaire.local")
    ) ?? "https://vistaire.local";
  const allowedOrigins = new Set<string>([
    baseOrigin,
    ...configuredImageOrigins(),
    ...(options.allowedOrigins ?? [])
      .map((origin) => originOf(origin.trim()))
      .filter((origin): origin is string => origin !== null)
  ]);

  let parsed: URL;
  try {
    parsed = new URL(trimmed, `${baseOrigin}/`);
  } catch {
    return null;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !allowedOrigins.has(parsed.origin)
  ) {
    return null;
  }

  return parsed.href;
}
