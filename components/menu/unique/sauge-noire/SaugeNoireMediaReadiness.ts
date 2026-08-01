export type SaugeNoireReadinessMedia = HTMLImageElement | HTMLVideoElement;

export function mediaIsPrepared(element: SaugeNoireReadinessMedia): boolean {
  if (element instanceof HTMLImageElement) return element.complete;
  return element.readyState >= 1;
}

export function mediaIsRelevantForReadiness(
  element: SaugeNoireReadinessMedia
): boolean {
  if (element.getAttribute("loading") !== "lazy") return true;
  if (mediaIsPrepared(element)) return true;
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < viewportHeight &&
    rect.left < viewportWidth
  );
}

export function readinessMediaForSurface(
  surface: ParentNode
): SaugeNoireReadinessMedia[] {
  return Array.from(
    surface.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video")
  ).filter(mediaIsRelevantForReadiness);
}
