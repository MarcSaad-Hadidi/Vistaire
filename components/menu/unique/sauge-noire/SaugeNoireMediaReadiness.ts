export type SaugeNoireReadinessMedia = HTMLImageElement | HTMLVideoElement;

export type SaugeNoireReadinessOptions = {
  projectedScrollTop?: number;
  triggerLazy?: boolean;
};

export function mediaIsPrepared(element: SaugeNoireReadinessMedia): boolean {
  if (element instanceof HTMLImageElement) return element.complete;
  return element.readyState >= 1;
}

export function mediaIsRelevantForReadiness(
  element: SaugeNoireReadinessMedia,
  options: SaugeNoireReadinessOptions = {}
): boolean {
  if (element.getAttribute("loading") !== "lazy") return true;
  if (mediaIsPrepared(element)) return true;
  const rect = element.getBoundingClientRect();
  const surface = element.closest<HTMLElement>(
    '[data-sauge-reading-surface="true"]'
  );
  const currentScrollTop = surface?.scrollTop ?? 0;
  const projectedDelta =
    (options.projectedScrollTop ?? currentScrollTop) - currentScrollTop;
  const projectedTop = rect.top - projectedDelta;
  const projectedBottom = rect.bottom - projectedDelta;
  const surfaceRect = surface?.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportTop = surfaceRect?.top ?? 0;
  const viewportHeight =
    surfaceRect?.height ??
    (window.innerHeight || document.documentElement.clientHeight);
  const viewportBottom = surfaceRect ? surfaceRect.bottom : viewportHeight;
  return (
    projectedBottom > viewportTop &&
    rect.right > 0 &&
    projectedTop < viewportBottom &&
    rect.left < viewportWidth
  );
}

export function readinessMediaForSurface(
  surface: ParentNode,
  options: SaugeNoireReadinessOptions = {}
): SaugeNoireReadinessMedia[] {
  const media = Array.from(
    surface.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video")
  ).filter((element) => mediaIsRelevantForReadiness(element, options));
  if (options.triggerLazy) {
    for (const element of media) {
      if (mediaIsPrepared(element) || element.getAttribute("loading") !== "lazy") continue;
      if (element instanceof HTMLImageElement) {
        element.loading = "eager";
      } else {
        element.preload = "metadata";
        element.load();
      }
    }
  }
  return media;
}
