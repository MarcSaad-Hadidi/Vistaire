export function normalizeModelAssetBytes(value: unknown): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : 0;
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
}

export function formatModelAssetBytes(bytes: number): string {
  const normalized = normalizeModelAssetBytes(bytes);
  if (!normalized) return "Poids inconnu";
  if (normalized < 1024) return `${normalized} B`;
  if (normalized < 1024 * 1024) return `${Math.round(normalized / 1024)} KB`;
  return `${(normalized / (1024 * 1024)).toFixed(1)} MB`;
}
