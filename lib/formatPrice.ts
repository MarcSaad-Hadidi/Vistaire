/** Formats an amount using the restaurant currency (ISO 4217). */
export function formatPrice(
  amount: number,
  currency: string,
  locale?: string
): string {
  const resolvedLocale =
    locale ?? (currency === "CAD" ? "fr-CA" : "fr-FR");
  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}
