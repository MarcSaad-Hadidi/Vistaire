/**
 * A mobile browser can resize even svh/lvh while revealing its toolbars. The
 * accumulated heights of a long sticky journey must not move under a contact.
 * Freeze touch-mobile reference sizes per width/orientation. Narrow desktop
 * windows must still respond to height-only resizing.
 */
export function bindJourneyViewport(view = window) {
  const root = view.document.documentElement;
  const probes = ["100svh", "100lvh"].map((height) => {
    const probe = view.document.createElement("div");
    probe.style.cssText = `position:fixed;top:0;left:0;width:0;height:${height};visibility:hidden;pointer-events:none;contain:strict`;
    view.document.body.append(probe);
    return probe;
  });
  let width = 0;
  let portrait;
  let stageHeight = 0;
  let sceneHeight = 0;
  const measure = () => {
    const nextWidth = root.clientWidth;
    const nextPortrait = view.matchMedia("(orientation: portrait)").matches;
    const mobile = nextWidth < 768;
    const touch = view.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (
      stageHeight &&
      mobile &&
      touch &&
      width === nextWidth &&
      portrait === nextPortrait
    )
      return;
    // Desktop viewport-unit probes can lag the only resize event. Its live
    // layout height has no mobile-toolbar split and is already authoritative.
    const nextStage =
      (touch && probes[0].getBoundingClientRect().height) || view.innerHeight;
    const nextScene =
      (touch && probes[1].getBoundingClientRect().height) || view.innerHeight;
    width = nextWidth;
    portrait = nextPortrait;
    if (nextStage !== stageHeight) {
      stageHeight = nextStage;
      root.style.setProperty("--vistaire-journey-vh", `${stageHeight / 100}px`);
    }
    if (nextScene !== sceneHeight) {
      sceneHeight = nextScene;
      root.style.setProperty("--vistaire-scene-vh", `${sceneHeight / 100}px`);
    }
    root.classList.toggle("journey-compact", mobile && stageHeight <= 740);
  };
  measure();
  view.addEventListener("resize", measure, { passive: true });
  return () => {
    view.removeEventListener("resize", measure);
    probes.forEach((probe) => probe.remove());
    root.style.removeProperty("--vistaire-journey-vh");
    root.style.removeProperty("--vistaire-scene-vh");
    root.classList.remove("journey-compact");
  };
}
