import { createPricingHandScene, pricingHandProgress } from "./PricingHandScene.js";
import { pricingStageAtScroll, pricingExitOffset } from "./PricingPhonePresenter.js";
import { createPricingRoomBackdrop } from "./PricingRoomBackdrop.js";
import { pricingLightTheme, subscribePricingTheme } from "./PricingTheme.js";

// This lower-section presentation borrows Scene's renderer and phone assets.
// It never owns a canvas, RAF, page listener, or the main camera's pose.
export function createPricingSceneAdapter({
  renderer, phoneRoot, scene, camera, environment, world, stateRef, invalidate,
}) {
  let hand, room, screenViewport;
  let handVisible = false, roomOnly = false, dirty = false, failed = false;
  let roomFailed = false, prepared = false;
  let bufferWidth = 0, bufferHeight = 0;
  let light = pricingLightTheme();
  const unsubscribe = subscribePricingTheme(next => {
    if (next === light) return;
    light = next;
    if (!room) return;
    dirty = true;
    hand?.reset();
    invalidate();
  });
  const rectangle = state => state.pricingStage && state.pricingViewport &&
    Number.isFinite(state.pricingSectionTop) && Number.isFinite(state.pageScrollY)
    ? pricingStageAtScroll(state.pricingSectionTop, state.pageScrollY, state.pricingViewport)
    : null;
  const resized = () => bufferWidth !== renderer.domElement.width ||
    bufferHeight !== renderer.domElement.height;
  function recordBackdrop(snapshot) {
    if (!snapshot) return;
    Object.assign(renderer.domElement.dataset, {
      pricingBackdrop: "ready",
      pricingBackdropGeneration: String(snapshot.generation),
      pricingBackdropWidth: String(snapshot.width),
      pricingBackdropHeight: String(snapshot.height),
      pricingBackdropTheme: snapshot.theme,
      pricingBackdropPose: snapshot.pose,
    });
  }
  function prepare() {
    if (hand) return;
    room = createPricingRoomBackdrop({ renderer, scene, camera });
    hand = createPricingHandScene({
      renderer, phoneRoot, environment, invalidate,
      renderBackground: (width, height) => recordBackdrop(room.draw(width, height, light)),
    });
  }
  function paintRoom(size) {
    if (!roomFailed) {
      try {
        renderer.info.reset();
        recordBackdrop(room.draw(size.width, size.height, light));
      } catch {
        roomFailed = true;
        renderer.domElement.dataset.pricingBackdrop = "unavailable";
      }
    }
    roomOnly = true;
    handVisible = false;
  }
  function fallback(state, size) {
    failed = true;
    if (handVisible || !roomOnly) paintRoom(size);
    handVisible = false;
    screenViewport = null;
    state.pricingHandUnavailable = true;
    delete state.pricingStage.dataset.handReady;
    state.syncPricingScroll?.(state.pageScrollY, state.pricingSectionTop);
  }
  function hideScreen(state) {
    delete state.pricingStage.dataset.handReady;
    state.presentPricingScreen?.(null, 0, false);
  }
  const screenHit = (x, y) => !screenViewport || !hand?.ready ||
    hand.screenIsVisible(x, y - screenViewport.top, screenViewport.width, screenViewport.height);
  stateRef.current.pricingScreenHit = screenHit;
  return {
    needsPreparation() {
      return !prepared || resized();
    },
    needsFrame(state) {
      const rect = rectangle(state);
      return Boolean(rect && ((rect.bottom > 0 && rect.top < rect.height) ||
        handVisible || (room && state.sceneOccluded && (dirty || resized()))));
    },
    draw(state, size, ready) {
      const rect = rectangle(state);
      if (!ready || !size || !rect) return false;
      if (rect.bottom > 0 && rect.top < size.height * 2) {
        prepare();
        hand.preload();
        room.warm();
      }
      if (!state.sceneOccluded) {
        prepared = false;
        renderer.domElement.dataset.pricingActive = "false";
        if (handVisible || roomOnly) {
          hideScreen(state);
          world.dataset.pricingActive = "false";
          hand.reset();
          room.release();
          renderer.domElement.dataset.pricingBackdrop = "released";
          handVisible = roomOnly = false;
          screenViewport = null;
        }
        return false;
      }
      // A direct FAQ anchor still needs the existing restaurant behind it.
      // Preparing here allocates no texture or hand download until requested.
      prepare();
      prepared = true;
      world.dataset.pricingActive = "true";
      if (dirty || resized()) {
        hand.reset();
        roomOnly = false;
      }
      dirty = false;
      bufferWidth = renderer.domElement.width;
      bufferHeight = renderer.domElement.height;
      const visible = rect.bottom > 0 && rect.top < size.height;
      renderer.domElement.dataset.pricingActive = String(visible);
      if (visible) {
        if (roomOnly) hand.reset();
        const ratio = pricingHandProgress(state.pricingSectionTop - state.pageScrollY,
          rect.height, state.reducedMotion);
        const top = pricingExitOffset(rect.top, rect.height);
        screenViewport = { ...rect, top };
        let rendered = false;
        if (!failed && !hand.unavailable) {
          try {
            rendered = hand.render(state.pricingOffer, ratio, rect.width, rect.height,
              { top, canvasHeight: size.height });
          } catch {
            failed = true;
            roomOnly = false;
          }
        }
        if (rendered) {
          handVisible = true;
          roomOnly = false;
        } else if (!handVisible && !roomOnly) {
          paintRoom(size);
        }
        if (failed || hand.unavailable || roomFailed) {
          fallback(state, size);
        } else if (handVisible && hand.ready) {
          try {
            const projection = hand.screenProjection(rect.width, rect.height);
            if (!projection || !projection.matrix.every(Number.isFinite)) throw new Error("Pricing screen unavailable");
            state.presentPricingScreen?.(projection, top, true, ratio);
            state.pricingStage.dataset.handReady = "true";
          } catch {
            fallback(state, size);
          }
        } else {
          hideScreen(state);
        }
        renderer.domElement.dataset.pricingHandProgress = String(ratio);
        renderer.domElement.dataset.pricingHand = failed || hand.unavailable
          ? "fallback" : "fair-photo-shared-3d-phone";
        return true;
      }
      screenViewport = null;
      hideScreen(state);
      if (handVisible || !roomOnly) {
        paintRoom(size);
      }
      handVisible = false;
      return false;
    },
    dispose() {
      unsubscribe();
      hand?.dispose();
      room?.dispose();
      if (stateRef.current.pricingScreenHit === screenHit) delete stateRef.current.pricingScreenHit;
      if (stateRef.current.pricingStage) delete stateRef.current.pricingStage.dataset.handReady;
      world.dataset.pricingActive = "false";
      renderer.domElement.dataset.pricingActive = "false";
      renderer.domElement.dataset.pricingBackdrop = "released";
    },
  };
}
