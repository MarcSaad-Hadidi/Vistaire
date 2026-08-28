import type { PricingCollectionId } from "./pricingPage.ts";

export const MIN_TABLE_COUNT = 1;
export const INCLUDED_TABLE_COUNT = 20;

export const EXTRA_TABLE_PRICE_BY_COLLECTION = Object.freeze({
  acrylique: 40,
  sculpte: 45,
  carre: 55,
  signature: 55
}) satisfies Readonly<Record<PricingCollectionId, number>>;

export function normalizeTableCount(value: number): number {
  if (!Number.isFinite(value)) return MIN_TABLE_COUNT;

  return Math.max(MIN_TABLE_COUNT, Math.trunc(value));
}

export function calculateExtraTableCount(tableCount: number): number {
  return Math.max(0, normalizeTableCount(tableCount) - INCLUDED_TABLE_COUNT);
}

export function calculateEstimatedSetupPrice({
  collectionId,
  baseSetupAmount,
  tableCount
}: {
  collectionId: PricingCollectionId;
  baseSetupAmount: number;
  tableCount: number;
}): number {
  const extraTables = calculateExtraTableCount(tableCount);

  return baseSetupAmount + extraTables * EXTRA_TABLE_PRICE_BY_COLLECTION[collectionId];
}

function groupThousands(value: number, separator: string): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

export function formatSetupAmount(amount: number, locale: "fr" | "en"): string {
  return locale === "en"
    ? `$${groupThousands(amount, ",")} CAD`
    : `${groupThousands(amount, " ")} $ CAD`;
}
