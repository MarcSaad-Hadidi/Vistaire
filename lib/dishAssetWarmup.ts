const preparedOrigins = new Set<string>();

export function prepareDemoAssetOrigin(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const origin = new URL("/models/demo/", window.location.href).origin;
  if (origin === window.location.origin || preparedOrigins.has(origin)) return;

  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = origin;
  link.crossOrigin = "anonymous";
  link.setAttribute("data-vistaire-asset-origin", "demo-models");
  preparedOrigins.add(origin);
  document.head.appendChild(link);
}
