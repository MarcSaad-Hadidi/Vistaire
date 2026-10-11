import { Vector3 } from "three";

export const PRICING_SCREEN_WIDTH = 280;
export const PRICING_SCREEN_HEIGHT =
  (280 * 14.084951400756836) / 6.526553630828857;
export const PRICING_SCREEN_HEADER = 74;
export const PRICING_SCROLL_SPEED = 0.9;
export const PRICING_ENTRY_VIEWPORTS = 0.9;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function pricingScrollLayout(
  stageHeight,
  contentHeight,
  viewportHeight,
  screenScale,
  reducedMotion = false,
) {
  const entry = reducedMotion ? 0 : stageHeight * PRICING_ENTRY_VIEWPORTS;
  const lead = reducedMotion ? 0 : stageHeight * 0.2;
  const readingStart = entry + lead;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const scale = Math.max(0.1, screenScale);
  const reading = (maxScroll * scale) / PRICING_SCROLL_SPEED;
  const hold = stageHeight * 0.15;
  return {
    entry,
    lead,
    readingStart,
    maxScroll,
    scale,
    reading,
    hold,
    travel: readingStart + reading + hold,
    sectionHeight: stageHeight + readingStart + reading + hold,
  };
}

export function pricingScreenScroll(introTop, layout) {
  return clamp(
    ((-introTop - layout.readingStart) * PRICING_SCROLL_SPEED) / layout.scale,
    0,
    layout.maxScroll,
  );
}

export function pricingPagePosition(sectionTop, screenScroll, layout) {
  return (
    sectionTop +
    layout.readingStart +
    (clamp(screenScroll, 0, layout.maxScroll) * layout.scale) /
      PRICING_SCROLL_SPEED
  );
}

// The captured orthographic camera maps the real screen plane to an affine
// parallelogram. Project the actual mesh, rather than guessing its CSS position.
export function projectPricingScreen(screen, camera, width, height) {
  if (!screen.geometry.boundingBox) screen.geometry.computeBoundingBox();
  const box = screen.geometry.boundingBox;
  const z = (box.min.z + box.max.z) / 2;
  const project = (x, y) => {
    const p = new Vector3(x, y, z)
      .applyMatrix4(screen.matrixWorld)
      .project(camera);
    return [((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2];
  };
  const tl = project(box.min.x, box.max.y),
    tr = project(box.max.x, box.max.y),
    bl = project(box.min.x, box.min.y);
  const a = (tr[0] - tl[0]) / PRICING_SCREEN_WIDTH,
    b = (tr[1] - tl[1]) / PRICING_SCREEN_WIDTH;
  const c = (bl[0] - tl[0]) / PRICING_SCREEN_HEIGHT,
    d = (bl[1] - tl[1]) / PRICING_SCREEN_HEIGHT;
  return {
    matrix: [a, b, c, d, tl[0], tl[1]],
    scale: Math.hypot(c, d),
    width: PRICING_SCREEN_WIDTH,
    height: PRICING_SCREEN_HEIGHT,
  };
}
