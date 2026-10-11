export function resolveMedia(value) {
  const src = typeof value === "string" ? value : value?.src;
  if (!src) return undefined;
  if (src.startsWith("/images/pricing/vistaire-"))
    return `/assets/support-${src.split("vistaire-")[1].split(".")[0]}.webp`;
  if (src.startsWith("/images/demo-walkthrough/"))
    return `/assets/phone-poster-${src.split("/").at(-1).split(".")[0]}.webp`;
  if (src.startsWith("/videos/demo/"))
    return `/media/walkthrough-${src.split("/").at(-1).split(".")[0]}.mp4`;
  // These optimized files retain the exact original dishes and brand artwork.
  if (src.startsWith("/images/")) {
    const [path, query] = src.split("?");
    return `/assets/pages${path.replace(/\.(?:png|jpe?g|webp)$/i, ".webp")}${query ? `?${query}` : ""}`;
  }
  return src;
}
