import { fairHandEase, pricingScreenScroll } from "./PricingPhoneLayout.js";

// Scroll samples use measured geometry and write only changed values. Reading
// CSSOM/scrollTop after cinematic style writes can force page layout each frame.
// The reader moves by compositor transform: scrollTop on this clipped, scaled
// screen repainted every offer image each frame on iPhone (about 2fps).
export function createPricingPhonePresenter(screen, viewport, layer, aside) {
  let lastScroll = 0;
  const body = viewport.firstElementChild;
  let lastTransform = "";
  let lastVisible, lastReady;
  let lastCopyAlpha, lastCopyActive, lastCopyVisible;
  return {
    copy(visible, entryProgress = 1, exitOffset = 0, height = 740) {
      if (!aside) return;
      const alpha = visible
        ? fairHandEase(entryProgress) *
          Math.max(0, 1 - exitOffset / (height * 0.25))
        : 0;
      if (alpha !== lastCopyAlpha) {
        aside.style.opacity = String(alpha);
        lastCopyAlpha = alpha;
      }
      const active = alpha > 0.5;
      if (active !== lastCopyActive) {
        aside.inert = !active;
        aside.setAttribute("aria-hidden", String(!active));
        lastCopyActive = active;
      }
      const painted = alpha > 0;
      if (painted !== lastCopyVisible) {
        aside.style.visibility = painted ? "visible" : "hidden";
        lastCopyVisible = painted;
      }
    },
    scroll(pageY, sectionTop, layout, force = false) {
      const next = pricingScreenScroll(sectionTop - pageY, layout);
      if (!force && Math.abs(lastScroll - next) <= 0.25) return false;
      body.style.transform = `translate3d(0, ${-next}px, 0)`;
      lastScroll = next;
      return true;
    },
    project(projection, stageTop = 0) {
      const matrix = [...projection.matrix];
      matrix[5] += stageTop;
      const transform = `matrix(${matrix.join(",")})`;
      if (lastTransform === transform) return false;
      screen.style.transform = transform;
      lastTransform = transform;
      return true;
    },
    show(visible, handReady = true) {
      if (!layer) return;
      if (lastVisible !== visible) {
        lastVisible = visible;
        layer.style.visibility = visible ? "visible" : "hidden";
        layer.inert = !visible;
        layer.setAttribute("aria-hidden", String(!visible));
      }
      if (lastReady !== handReady) {
        lastReady = handReady;
        layer.dataset.handReady = String(handReady);
        layer.parentElement.style.zIndex = handReady ? "1" : "4";
      }
    },
  };
}

// The phone stage sticks inside its own measured intro, before the FAQ.
export function pricingStageAtScroll(sectionTop, pageY, viewport) {
  const introTop = sectionTop - pageY;
  const top = Math.min(
    Math.max(0, introTop),
    introTop + viewport.introHeight - viewport.height,
  );
  return {
    top,
    bottom: top + viewport.height,
    width: viewport.width,
    height: viewport.height,
  };
}

// Lower the held phone as the FAQ enters, keeping the captured wrist's cut
// edge below the frame. HTML, GL view and pointers share this same offset.
export function pricingExitOffset(stageTop, height = 740) {
  const distance = Math.max(0, -stageTop);
  const ramp = Math.max(1, height * 0.05);
  const decay = Math.exp(-distance / ramp);
  // Integral of (1 - exp(-t))²: zero initial velocity/acceleration, then
  // approach native speed without overshoot. All presentation layers share it.
  return distance - 1.5 * ramp + 2 * ramp * decay - 0.5 * ramp * decay * decay;
}

