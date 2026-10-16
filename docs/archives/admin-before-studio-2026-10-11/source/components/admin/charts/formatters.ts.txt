export function chartId(...parts: string[]) {
  return parts.join("-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";
}

export function formatChartDateUtc(value: string | Date, locale = "fr-CA") {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(value)).replace(/\.$/, "");
}

export function formatChartValue(value: number, unit?: string, locale = "fr-CA") {
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}
