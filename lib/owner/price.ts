export type DisplayPriceMode = "integer" | "decimal" | "auto";

export type ParsedPrice =
  | {
      ok: true;
      cents: number;
      displayPriceMode: DisplayPriceMode;
      originalInput: string;
    }
  | {
      ok: false;
      error: string;
    };

const PRICE_PATTERN = /^(\d+)([,.]\d{1,2})?$/;

export function inferDisplayPriceMode(input: string): DisplayPriceMode {
  return /[,.]/.test(input.trim()) ? "decimal" : "integer";
}

export function normalizeDisplayPriceMode(
  value: unknown,
  originalInput: string
): DisplayPriceMode {
  if (value === "integer" || value === "decimal" || value === "auto") {
    return value;
  }
  return inferDisplayPriceMode(originalInput);
}

export function parsePriceToCents(input: string | number): ParsedPrice {
  const originalInput =
    typeof input === "number" && Number.isFinite(input) ? String(input) : String(input ?? "");
  const normalized = originalInput.trim().replace(/\s+/g, "");

  if (!normalized) {
    return { ok: false, error: "Prix invalide." };
  }
  if (normalized.startsWith("-")) {
    return { ok: false, error: "Prix invalide : le prix doit etre superieur a 0." };
  }
  if (!PRICE_PATTERN.test(normalized)) {
    if (/^\d+[,.]\d{3,}$/.test(normalized)) {
      return { ok: false, error: "Prix invalide : maximum 2 decimales." };
    }
    return { ok: false, error: "Prix invalide." };
  }

  const match = normalized.match(PRICE_PATTERN);
  const whole = Number(match?.[1] ?? "");
  const decimalRaw = match?.[2]?.slice(1) ?? "";
  const decimal = Number((decimalRaw + "00").slice(0, 2));
  const cents = whole * 100 + decimal;

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return { ok: false, error: "Prix invalide : le prix doit etre superieur a 0." };
  }

  return {
    ok: true,
    cents,
    displayPriceMode: inferDisplayPriceMode(normalized),
    originalInput: originalInput.trim()
  };
}

export function formatPriceCentsForMenu(
  priceCents: number,
  currency = "CAD",
  options: { displayPriceMode?: DisplayPriceMode } = {}
): string {
  if (!Number.isFinite(priceCents) || priceCents <= 0) return "";

  const cents = Math.round(priceCents);
  const hasCents = cents % 100 !== 0;
  const mode = options.displayPriceMode ?? "auto";
  const showDecimals =
    mode === "decimal" || (mode === "auto" && hasCents) || (mode === "integer" && hasCents);

  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(cents / 100);
}
