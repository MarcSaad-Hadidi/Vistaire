import { useEffect, useRef } from "react";

const clamp = (value, minimum, maximum) =>
  Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(value) ? value : minimum),
  );
const HORIZONTAL_THRESHOLD = 12;
const HORIZONTAL_RATIO = 1.5;
const LONG_HOLD_MS = 450;

/**
 * Pointer state independent of React. Production mouse/pen uses this controller;
 * the native-touch adapter below observes touchscreen gestures separately.
 * getOptions always reads the current callbacks; emitted values are also kept
 * locally so two moves before a React render never read stale zoom/rotation.
 */
export function createModelGestureController(getOptions) {
  const pointers = new Map();
  const captures = new Map();
  const releasedCaptures = new Set();
  let mode = "idle";
  let pinch = null;
  let verticalIntent = 0;
  let values = { angle: 0.5, pitch: 0, zoom: 1 };

  function syncValues() {
    const options = getOptions();
    values = {
      angle: clamp(options.angle ?? 0.5, 0, 1),
      pitch: clamp(options.pitch ?? 0, -0.7, 0.7),
      zoom: clamp(options.zoom ?? 1, 0.6, 4),
    };
  }
  function emit(key, next, low, high) {
    const value = clamp(next, low, high);
    if (Math.abs(value - values[key]) < 0.000001) return;
    values[key] = value;
    const callback =
      getOptions()[{ angle: "onAngle", pitch: "onPitch", zoom: "onZoom" }[key]];
    callback?.(value);
  }
  function capture(pointer) {
    if (captures.has(pointer.id) || !pointer.target?.setPointerCapture) return;
    try {
      releasedCaptures.delete(pointer.id);
      pointer.target.setPointerCapture(pointer.id);
      captures.set(pointer.id, pointer.target);
    } catch {
      // The pointer may already have been cancelled by the native scroller.
    }
  }
  function release(id) {
    const target = captures.get(id);
    if (!target) return;
    captures.delete(id);
    releasedCaptures.add(id);
    try {
      if (target.hasPointerCapture?.(id) !== false) {
        target.releasePointerCapture?.(id);
      }
    } catch {
      // Releasing an already-ended pointer is harmless.
    }
  }
  function reset() {
    pointers.clear();
    pinch = null;
    mode = "idle";
    verticalIntent = 0;
    for (const id of [...captures.keys()]) release(id);
    releasedCaptures.clear();
  }
  function touchPointers() {
    return [...pointers.values()].filter((pointer) => pointer.type === "touch");
  }
  function yieldToNative() {
    pinch = null;
    mode = "native";
    verticalIntent = 0;
    for (const id of [...captures.keys()]) release(id);
  }
  function beginPinch() {
    const touches = touchPointers();
    if (touches.length < 2) return;
    const [first, second] = touches;
    pinch = {
      ids: [first.id, second.id],
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      zoom: values.zoom,
    };
    mode = "pinch";
    capture(first);
    capture(second);
  }
  function preventClaimedDefault(event) {
    if (event.cancelable) event.preventDefault();
  }
  function onPointerDown(event) {
    const type = event.pointerType === "touch" ? "touch" : "mouse";
    if (type === "mouse" && event.button !== 0) return;
    if (pointers.has(event.pointerId)) return;
    releasedCaptures.delete(event.pointerId);
    if (type === "mouse" && pointers.size) return;
    if (type === "touch" && mode === "mouse") reset();
    if (!pointers.size) syncValues();
    const target = event.currentTarget;
    const pointer = {
      id: event.pointerId,
      type,
      target,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      angle: values.angle,
      pitch: values.pitch,
      width: Math.max(1, target?.clientWidth || 400),
      height: Math.max(1, target?.clientHeight || 400),
    };
    pointers.set(pointer.id, pointer);
    if (type === "mouse") {
      mode = "mouse";
      capture(pointer);
    } else if (touchPointers().length >= 2) {
      if (getOptions().zoomEnabled === false) {
        yieldToNative();
        return;
      }
      if (mode !== "pinch") beginPinch();
      preventClaimedDefault(event);
    } else {
      mode = "touch-pending";
    }
  }
  function onPointerMove(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const stepX = event.clientX - pointer.x;
    const stepY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (mode === "pinch") {
      if (getOptions().zoomEnabled === false) {
        yieldToNative();
        return;
      }
      const first = pointers.get(pinch.ids[0]);
      const second = pointers.get(pinch.ids[1]);
      if (!first || !second) return;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      emit("zoom", (pinch.zoom * distance) / pinch.distance, 0.6, 4);
      preventClaimedDefault(event);
      return;
    }
    if (pointer.type === "mouse") {
      if (!(event.buttons & 1)) {
        reset();
        return;
      }
      emit(
        "angle",
        pointer.angle + (pointer.x - pointer.startX) / pointer.width,
        0,
        1,
      );
      emit(
        "pitch",
        pointer.pitch + ((pointer.y - pointer.startY) / pointer.height) * 1.4,
        -0.7,
        0.7,
      );
      preventClaimedDefault(event);
      return;
    }
    if (mode === "native") return;
    const dx = pointer.x - pointer.startX;
    const dy = pointer.y - pointer.startY;
    if (mode === "touch-pending") {
      if (event.timeStamp - pointer.startTime >= LONG_HOLD_MS) {
        mode = "native";
        return;
      }
      if (
        Math.abs(dx) >= HORIZONTAL_THRESHOLD &&
        Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO
      ) {
        mode = "touch-rotate";
        capture(pointer);
      } else if (Math.abs(dy) >= HORIZONTAL_THRESHOLD) {
        mode = "native";
        return;
      } else {
        return;
      }
    } else if (mode === "touch-rotate") {
      // Relinquish an already-horizontal rotation when the finger changes to
      // a deliberate vertical scroll. Up/down reversals never re-arm rotation.
      if (Math.abs(stepY) > Math.abs(stepX) * HORIZONTAL_RATIO) {
        verticalIntent += Math.abs(stepY);
      } else if (Math.abs(stepX) >= Math.abs(stepY)) {
        verticalIntent = 0;
      }
      if (verticalIntent >= HORIZONTAL_THRESHOLD) {
        mode = "native";
        release(pointer.id);
        return;
      }
    }
    emit("angle", pointer.angle + dx / pointer.width, 0, 1);
    preventClaimedDefault(event);
  }
  function onPointerUp(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(pointer.id);
    release(pointer.id);
    if (mode === "pinch") {
      if (touchPointers().length >= 2) {
        // A third finger can replace one of the pair without a zoom jump.
        if (pinch.ids.includes(pointer.id)) beginPinch();
      } else {
        pinch = null;
        mode = pointers.size ? "native" : "idle";
        for (const id of [...captures.keys()]) release(id);
      }
    } else if (!pointers.size) {
      mode = "idle";
      verticalIntent = 0;
    }
  }
  function onPointerCancel(event) {
    if (pointers.has(event.pointerId)) reset();
  }
  function onLostPointerCapture(event) {
    if (releasedCaptures.delete(event.pointerId)) return;
    if (pointers.has(event.pointerId)) reset();
  }
  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
    },
    reset,
    getState: () => ({
      mode,
      pointerCount: pointers.size,
      captureCount: captures.size,
      ...values,
    }),
  };
}

export function useModelGesture(options) {
  return useNativeModelGesture({ ...options, zoomEnabled: true });
}

// One-finger motion never cancels native scrolling or captures a touch pointer.
// Only a two-finger dish pinch is custom; QR listeners are entirely passive.
export function createNativeModelGestureController(getOptions) {
  const mouse = createModelGestureController(getOptions);
  let contact = null;
  let pinch = null;
  let yielded = false;
  function yieldToScroll() {
    contact = null;
    pinch = null;
    yielded = true;
  }
  function touchstart(event) {
    // A single global touch proves that a new contact has begun. Its previous
    // final touchend may have targeted another element (second finger outside).
    if (event.touches.length === 1) {
      contact = null;
      pinch = null;
      yielded = false;
    }
    if (yielded) return;
    if (contact && contact.view.scrollY !== contact.scrollY) {
      yieldToScroll();
      return;
    }
    if (event.touches.length === 2 && getOptions().zoomEnabled === true) {
      const [a, b] = event.touches;
      pinch = {
        ids: [a.identifier, b.identifier],
        distance: Math.max(
          1,
          Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        ),
        zoom: getOptions().zoom || 1,
      };
      contact = null;
      return;
    }
    if (event.touches.length !== 1 || contact) {
      yieldToScroll();
      return;
    }
    const finger = event.touches[0];
    const view = event.currentTarget.ownerDocument.defaultView;
    contact = {
      id: finger.identifier,
      x: finger.clientX,
      y: finger.clientY,
      lastX: finger.clientX,
      lastY: finger.clientY,
      windowX: 0,
      windowY: 0,
      angle: getOptions().angle || 0,
      time: event.timeStamp,
      width: Math.max(1, event.currentTarget.clientWidth),
      view,
      scrollY: view.scrollY,
      rotating: false,
    };
  }
  function touchmove(event) {
    if (pinch && !yielded) {
      const [a, b] = pinch.ids.map((id) =>
        [...event.touches].find((t) => t.identifier === id),
      );
      if (!a || !b || event.touches.length !== 2) {
        yieldToScroll();
        return;
      }
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      getOptions().onZoom?.(
        clamp((pinch.zoom * distance) / pinch.distance, 0.6, 4),
      );
      return;
    }
    if (!contact || yielded) return;
    if (
      event.touches.length !== 1 ||
      contact.view.scrollY !== contact.scrollY
    ) {
      yieldToScroll();
      return;
    }
    const finger = [...event.touches].find((t) => t.identifier === contact.id);
    if (!finger) {
      yieldToScroll();
      return;
    }
    const dx = finger.clientX - contact.x;
    const dy = finger.clientY - contact.y;
    if (!contact.rotating) {
      if (event.timeStamp - contact.time >= LONG_HOLD_MS) {
        yieldToScroll();
        return;
      }
      if (
        Math.abs(dx) >= HORIZONTAL_THRESHOLD &&
        Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO
      ) {
        contact.rotating = true;
      } else if (Math.abs(dy) >= HORIZONTAL_THRESHOLD) {
        yieldToScroll();
        return;
      } else return;
    } else {
      contact.windowX += finger.clientX - contact.lastX;
      contact.windowY += finger.clientY - contact.lastY;
      if (Math.hypot(contact.windowX, contact.windowY) >= 8) {
        if (
          Math.abs(contact.windowX) <=
          Math.abs(contact.windowY) * HORIZONTAL_RATIO
        ) {
          yieldToScroll();
          return;
        }
        contact.windowX = 0;
        contact.windowY = 0;
      }
    }
    contact.lastX = finger.clientX;
    contact.lastY = finger.clientY;
    const angle = contact.angle + dx / contact.width;
    getOptions().onAngle?.(
      getOptions().zoomEnabled ? clamp(angle, 0, 1) : angle,
    );
  }
  function touchend(event) {
    if (event.touches.length) yieldToScroll();
    else {
      contact = null;
      pinch = null;
      yielded = false;
    }
  }
  return {
    touchHandlers: { touchstart, touchmove, touchend, touchcancel: touchend },
    pointerHandlers: Object.fromEntries(
      Object.entries(mouse.handlers).map(([name, handler]) => [
        name,
        (event) => {
          if (event.pointerType !== "touch") handler(event);
        },
      ]),
    ),
    reset() {
      contact = null;
      pinch = null;
      yielded = false;
      mouse.reset();
    },
  };
}

export const createSupportGestureController =
  createNativeModelGestureController;

function useNativeModelGesture(options) {
  const latest = useRef(options);
  useEffect(() => { latest.current = options; }, [options]);
  const elementRef = useRef(null);
  const controllerRef = useRef(null);
  useEffect(() => {
    const controller = createNativeModelGestureController(() => latest.current);
    controllerRef.current = controller;
    const element = elementRef.current;
    const handlers = Object.entries(controller.touchHandlers);
    handlers.forEach(([name, handler]) =>
      element.addEventListener(name, handler, { passive: true }),
    );
    return () => {
      handlers.forEach(([name, handler]) =>
        element.removeEventListener(name, handler),
      );
      controller.reset();
      controllerRef.current = null;
    };
  }, []);
  return {
    ref: elementRef,
    onPointerDown: event => controllerRef.current?.pointerHandlers.onPointerDown(event),
    onPointerMove: event => controllerRef.current?.pointerHandlers.onPointerMove(event),
    onPointerUp: event => controllerRef.current?.pointerHandlers.onPointerUp(event),
    onPointerCancel: event => controllerRef.current?.pointerHandlers.onPointerCancel(event),
    onLostPointerCapture: event => controllerRef.current?.pointerHandlers.onLostPointerCapture(event),
  };
}

export function useSupportGesture(options) {
  return useNativeModelGesture({ ...options, zoomEnabled: false });
}
