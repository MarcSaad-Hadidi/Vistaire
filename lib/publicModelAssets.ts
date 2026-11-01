import manifest from "./publicModelAssets.json" with { type: "json" };

export type PublicModelAsset = {
  id: string;
  kind: string;
  visibility: "public";
  format: "glb" | "usdz";
  bytes: number;
  sha256: string;
  version: string;
  legacyUrl: string;
  /** Set only after full-byte, HTTP and required-origin browser CORS verification. */
  publicUrl: string | null;
  variants?: { mobile?: string; ios?: string };
};

export const PUBLIC_MODEL_ASSETS = manifest.assets as readonly PublicModelAsset[];

const assetsByReference = new Map<string, PublicModelAsset>();
for (const asset of PUBLIC_MODEL_ASSETS) {
  assetsByReference.set(asset.id, asset);
  assetsByReference.set(asset.legacyUrl, asset);
  if (asset.publicUrl) assetsByReference.set(asset.publicUrl, asset);
}

export function getPublicModelAsset(reference: string): PublicModelAsset | undefined {
  return assetsByReference.get(reference);
}

/** Only inventoried public files are resolved; private and signed routes pass through. */
export function resolvePublicModelUrl(reference: string): string {
  const asset = getPublicModelAsset(reference);
  return asset ? asset.publicUrl || asset.legacyUrl : reference;
}

export function isPublicModelCdnUrl(url: string): boolean {
  return (
    url.startsWith("https://3d.vistaire.ca/marketing/immersive/") &&
    getPublicModelAsset(url)?.publicUrl === url
  );
}

export function publicModelBaseUrl(url: string): string {
  return url.startsWith("/")
    ? url.slice(0, url.lastIndexOf("/") + 1)
    : new URL(".", url).href;
}

/** Temporary redirects preserve published legacy URLs while remaining rollback-safe. */
export function getPublicModelRedirects() {
  return PUBLIC_MODEL_ASSETS.flatMap((asset) => asset.publicUrl ? [{
    source: asset.legacyUrl,
    destination: asset.publicUrl,
    permanent: false,
  }] : []);
}

/** Existing hull geometry is unchanged; source identity survives URL/hosting changes. */
export function indexPublicModelFramingHulls<T extends { source: { bytes: number; sha256: string } }>(
  byUrl: Record<string, T>,
): Record<string, T> {
  return Object.fromEntries(Object.values(byUrl).map((hull) => {
    const asset = PUBLIC_MODEL_ASSETS.find((candidate) =>
      candidate.sha256 === hull.source.sha256 && candidate.bytes === hull.source.bytes,
    );
    if (!asset) throw new Error("Unknown public model framing source.");
    return [asset.id, hull];
  }));
}
