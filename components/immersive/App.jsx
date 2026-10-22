"use client";

import Link from "next/link";
import { preload } from "react-dom";
import { resolvePublicModelUrl } from "../../lib/publicModelAssets.ts";
import { createEntryScrollAssist } from "./EntryScrollAssist.js";
import { useLinkIntent } from "./useLinkIntent.js";
import { bindPublicMenuViewport } from "@/lib/publicMenuViewport";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  MoveHorizontal,
  RotateCw,
  ScanLine,
  X,
} from "lucide-react";
import {
  chapters,
  collections as sourceCollections,
  dishes as sourceDishes,
  experiences as sourceExperiences,
  site,
} from "./content.js";
import Pricing from "./Pricing.jsx";
import { CINEMATIC_TIMING, SCROLL_PACE, normalizeScrollPace, scaledCinematicTiming, openingProgressAtScroll, remapJourneyScroll, chapterNavigationTarget, cinematicEase, cinematicCopyWeights, readingTiming, readingPresentation, measureChapterTransitions, transitionAtScroll, transitionSceneFrame } from "./SceneDirector.js";
import { useModelGesture, useSupportGesture } from "./useModelGesture.js";
import { ARAction, ARHelp, DishDetailLink } from "./ARActions.jsx";
import { classifyArBrowser, readLiveArClientSnapshot } from "../../lib/ar/arExperience.ts";
import { LandingLocaleProvider, useLandingLocale } from "./locale.jsx";
import { PublicControls } from "../vistaire-preview/PublicControls";
import { PublicFooterNavigation } from "../vistaire-preview/PublicFooterNavigation";
import { getVistaireSocialProfiles } from "@/lib/seo";
import { getSeoMarketingImage } from "@/lib/seoMarketingImages";
const Scene = lazy(() => import("./Scene.jsx"));
const PerformanceCapturePanel = lazy(() => import("./PerformanceCapturePanel.jsx"));
// Restaurant-specific menus keep their original production interface.
// Vistaire presentation pages are part of this same styled frontend.
// Distances use the frozen journey viewport, not elapsed time or scroll velocity.
// Keep the finished phone pose visible for another 1.5 viewports.
const OPENING_MOTION_VH = CINEMATIC_TIMING.openingMotionScreens * 100;
const OPENING_PHONE_HOLD_VH = CINEMATIC_TIMING.phoneHoldScreens * 100;
// Cards and menu videos share explicit reading holds and paced detail changes.
const { centers: SOCIAL_HOLD_CENTERS } = readingTiming();
const clamp = (n) => Math.max(0, Math.min(1, n));

function Action({
  children,
  onClick,
  href,
  className = "",
  dark = false,
  ...props
}) {
  const Comp = href ? "a" : "button";
  return (
    <Comp
      href={href}
      onClick={onClick}
      className={`action ${dark ? "action-dark" : ""} ${className}`}
      {...props}
    >
      {children}
    </Comp>
  );
}
function AdaptiveScrollGuide({ visible }) {
  const { t } = useLandingLocale();
  return (
    <div className="scroll-guide" data-scroll-guide aria-hidden={!visible}>
      <ChevronDown size={22} aria-hidden="true" />
      <span>{t("Faites défiler pour découvrir")}</span>
    </div>
  );
}
function Chapter({ id, height, children, className = "", chapterRef, as: Element = "section" }) {
  // Native fragment navigation also lands after the cinematic entry fade.
  const anchorOffset = chapterNavigationTarget({ id, top: 0 }, 100);
  return (
    <Element
      id={id}
      ref={chapterRef}
      className={`chapter ${className}`}
      style={{
        "--chapter-height": height,
        scrollMarginTop: anchorOffset ? `calc(-${anchorOffset} * var(--scroll-distance-scale, 1) * var(--journey-vh))` : undefined,
      }}
      aria-labelledby={`${id}-title`}
    >
      <div className="stage">{children}</div>
    </Element>
  );
}
function FocusFrame({ children, className = "", ...props }) {
  return (
    <div className={`scene-focus ${className}`} {...props}>
      {children}
    </div>
  );
}
function Heading({ children }) {
  return <div className="chapter-heading">{children}</div>;
}
function RotationSlider({ value, onChange }) {
  const { t, locale } = useLandingLocale();
  const pointer = useRef(null);
  const gestures = useSupportGesture({
    angle: value,
    onAngle: (next) => onChange(clamp(next)),
  });
  return (
    <div
      className="rotation-range"
      role="slider"
      tabIndex={0}
      aria-label={t("Rotation du plat 3D")}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={value}
      aria-valuetext={`${Math.round(value * 360)} ${locale === "en" ? "degrees" : "degrés"}`}
      style={{ "--rotation": `${value * 100}%` }}
      {...gestures}
      onPointerDown={(event) => {
        pointer.current = { x: event.clientX, y: event.clientY, moved: false };
        gestures.onPointerDown(event);
      }}
      onPointerMove={(event) => {
        const start = pointer.current;
        if (
          start &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 4
        )
          start.moved = true;
        gestures.onPointerMove(event);
      }}
      onPointerCancel={(event) => {
        if (pointer.current) pointer.current.moved = true;
        gestures.onPointerCancel(event);
      }}
      onClick={(event) => {
        if (!event.detail || pointer.current?.moved) return;
        const box = event.currentTarget.getBoundingClientRect();
        onChange(clamp((event.clientX - box.left) / box.width));
      }}
      onKeyDown={(event) => {
        const delta = {
          ArrowLeft: -0.025,
          ArrowDown: -0.025,
          ArrowRight: 0.025,
          ArrowUp: 0.025,
          PageDown: -0.1,
          PageUp: 0.1,
        }[event.key];
        if (delta != null || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          onChange(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 1
                : clamp(value + delta),
          );
        }
      }}
    />
  );
}
function DemoVideo({ id, index }) {
  const { t } = useLandingLocale();
  const [decoded, setDecoded] = useState(false);
  const videoRef = useRef(null);
  const pendingFrame = useRef(null);
  const showPoster = () => {
    const video = videoRef.current;
    if (pendingFrame.current != null)
      video?.cancelVideoFrameCallback?.(pendingFrame.current);
    pendingFrame.current = null;
    setDecoded(false);
  };
  const showDecodedFrame = (event) => {
    const video = event.currentTarget;
    if (video.requestVideoFrameCallback) {
      if (pendingFrame.current != null)
        video.cancelVideoFrameCallback(pendingFrame.current);
      pendingFrame.current = video.requestVideoFrameCallback(() => {
        pendingFrame.current = null;
        if (!video.paused && video.readyState >= 2) setDecoded(true);
      });
    } else if (video.readyState >= 2) setDecoded(true);
  };
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (pendingFrame.current != null)
        video.cancelVideoFrameCallback?.(pendingFrame.current);
    };
  }, []);
  return (
    <>
      <img
        className="walkthrough-poster"
        src={`/immersive-assets/phone-poster-${id}.webp`}
        alt={t("Aperçu du menu")}
        loading="lazy"
        decoding="async"
      />
      <video
        ref={videoRef}
        className={decoded ? "has-decoded-frame" : ""}
        src={`/videos/demo/${id}.mp4`}
        data-demo="true"
        data-play-when={`social-content-${index}`}
        muted
        loop
        playsInline
        preload="none"
        onPlaying={showDecodedFrame}
        onTimeUpdate={(event) => {
          if (
            !decoded &&
            !event.currentTarget.paused &&
            pendingFrame.current == null
          )
            showDecodedFrame(event);
        }}
        onPause={showPoster}
        onWaiting={showPoster}
        onStalled={showPoster}
        onEmptied={showPoster}
        onError={showPoster}
      />
    </>
  );
}
function Modal({ label, children, close }) {
  const { t } = useLandingLocale();
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("button")?.focus();
    const key = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = [
          ...ref.current.querySelectorAll(
            "a[href],button,input,select,video[controls]",
          ),
        ].filter((x) => !x.disabled);
        const first = els[0],
          last = els.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current ||
            !ref.current.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", key);
      previous?.focus({ preventScroll: true });
    };
  }, [close]);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [label]);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="modal"
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close-modal"
          onClick={close}
          aria-label={t("Fermer")}
        >
          <X />
        </button>
        {children}
      </div>
    </div>
  );
}
const SCROLL_KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "End", "Home"]);
// The visitor inputs that scroll the journey: wheel, touch drags and scroll
// keys outside form fields.
function isHeldScroll(event) {
  if (event.type === "keydown")
    return SCROLL_KEYS.has(event.key) && !event.target.closest?.("input, textarea, select, [contenteditable]");
  return event.type === "wheel" || event.type === "touchmove";
}

export function App({ locale = "fr" }) {
  // The opening is first painted as a still of its own 3D frame (the poster in
  // .world). Once the page has loaded, the models download and the scene sets
  // up on the first idle moment, so it is usually ready before the visitor
  // scrolls; an earlier input starts it at once. It crossfades over the poster.
  const [sceneStarted, setSceneStarted] = useState(false);
  useEffect(() => {
    let timer;
    let idle;
    let fetched = false;
    const inputs = ["pointerdown", "touchstart", "wheel", "keydown", "scroll"];
    const prefetch = () => {
      if (fetched) return;
      fetched = true;
      const fetchHint = { as: "fetch", crossOrigin: "anonymous" };
      // The scene's own fetches reuse these (same URL and CORS mode).
      for (const id of ["immersive.restaurant.visible.textures-512", "immersive.phone", "immersive.support.acrylique"])
        preload(resolvePublicModelUrl(id), fetchHint);
      // The Draco decoder the room needs, fetched by three's FileLoader.
      for (const file of ["draco_wasm_wrapper.js", "draco_decoder.wasm"])
        preload(`/immersive-assets/draco/${file}`, fetchHint);
      // The opening lobster depends on the viewport (Scene.jsx modelUrl).
      preload(resolvePublicModelUrl(innerWidth < 768 ? "immersive.dish.homard.scene-mobile" : "immersive.dish.homard.scene"), fetchHint);
    };
    const start = (event) => {
      stop();
      // The journey waits at the opening while the scene loads (the scroll
      // hold in LandingContent): the starting wheel or key does not scroll.
      if (event && isHeldScroll(event)) event.preventDefault();
      prefetch();
      setSceneStarted(true);
    };
    const stop = () => {
      clearTimeout(timer);
      if (idle) cancelIdleCallback(idle);
      inputs.forEach((type) => removeEventListener(type, start));
      removeEventListener("load", schedule);
    };
    // The models download right after load (network only). The scene's
    // main-thread setup waits for input or a quiet spell, so it never lands
    // in the page's first seconds.
    const schedule = () => {
      prefetch();
      timer = setTimeout(() => {
        if (typeof requestIdleCallback === "function") idle = requestIdleCallback(() => start(), { timeout: 2000 });
        else start();
      }, 6000);
    };
    // A restored or anchored scroll position is already past the opening.
    if (scrollY > 0) start();
    else {
      inputs.forEach((type) => addEventListener(type, start, { passive: type !== "wheel" }));
      if (document.readyState === "complete") schedule();
      else addEventListener("load", schedule);
    }
    return stop;
  }, []);
  return (
    <LandingLocaleProvider locale={locale}>
      <LandingContent sceneStarted={sceneStarted} />
    </LandingLocaleProvider>
  );
}

function LandingContent({ sceneStarted }) {
  const { locale, t, href: link } = useLandingLocale();
  const collections = sourceCollections.map((item) => ({
    ...item,
    description: t(item.description),
    usage: t(item.usage),
  }));
  const dishes = sourceDishes.map((item) => ({
    ...item,
    description: t(item.description),
    category: t(item.category),
    allergens: item.allergens ? t(item.allergens) : null,
  }));
  const experiences = sourceExperiences.map((item) => ({
    ...item,
    description: t(item.description),
    tag: t(item.tag),
  }));
  const initialDish = "homard";
  const stateRef = useRef({
    section: "hero",
    progress: 0,
    flip: false,
    collection: "acrylique",
    drag: 0.5,
    dish: initialDish,
    pointer: { x: 0, y: 0 },
  });
  const sectionRefs = useRef({});
  const openingRef = useRef(null);
  const scrollTargets = useRef({});
  const [scrollPace, setScrollPace] = useState(null);
  const [performanceCapture, setPerformanceCapture] = useState(false);
  const [chapter, setChapter] = useState("hero");
  const [chapterBeats, setChapterBeats] = useState({
    features: 0,
    "social-content": 0,
  });
  const beat = chapterBeats[chapter] || 0;
  const [menu, setMenu] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const guideDismissed = useRef(false);
  const dismissGuideOnInteraction = (event) => {
    if (!guideDismissed.current && event.target.closest(
      'a, button, input, select, textarea, [role="slider"], [role="tab"], [contenteditable="true"]',
    )) {
      guideDismissed.current = true;
      setGuideVisible(false);
    }
  };
  const [ready, setReady] = useState(false);
  const [posterGone, setPosterGone] = useState(false);
  const [gpuError, setGpuError] = useState(false);
  // Once the 3D starts, scrolling waits on the poster until the whole opening
  // shot (room included) is ready: shots reached early showed the phone and
  // stand without their room. 20 s releases a load that never finishes; the
  // poster still covers the canvas until it is ready.
  const holdingScroll = sceneStarted && !ready && !gpuError;
  useEffect(() => {
    if (!holdingScroll) return;
    // Visitor inputs are held, not the page: overflow hidden would drop the
    // desktop scrollbar and shift the layout, and the journey's own scrolls
    // (anchors, chapter links) must still land.
    const hold = (event) => { if (isHeldScroll(event)) event.preventDefault(); };
    const types = ["wheel", "touchmove", "keydown"];
    const release = () => types.forEach((type) => removeEventListener(type, hold));
    types.forEach((type) => addEventListener(type, hold, { passive: false }));
    const timer = setTimeout(release, 20_000);
    return () => { clearTimeout(timer); release(); };
  }, [holdingScroll]);
  // Another page fetches as a link is reached and shows the loading screen the
  // moment it is clicked (useLinkIntent); 8 s releases a navigation that never came.
  const [leaving, setLeaving] = useState(false);
  const leave = useCallback(() => setLeaving(true), []);
  useLinkIntent(leave, ready);
  useEffect(() => {
    if (!leaving) return;
    const release = setTimeout(() => setLeaving(false), 8000);
    return () => clearTimeout(release);
  }, [leaving]);
  const [modal, setModal] = useState(null);
  const [collection, setCollection] = useState("acrylique");
  const [phoneDemo, setPhoneDemo] = useState("maison-elyse");
  const [phoneVideoError, setPhoneVideoError] = useState(null);
  const [supportAngles, setSupportAngles] = useState({
    acrylique: 0,
    sculpte: 0,
    carre: 0,
    signature: 0,
  });
  const [flip, setFlip] = useState(false);
  const [drag, setDrag] = useState(0.5);
  const [dishZoom, setDishZoom] = useState(1);
  const [fittedDishZoom, setFittedDishZoom] = useState({ requested: 1, zoom: 1, max: 4 });
  const maxDishZoom = fittedDishZoom.max;
  const gestureCommits = useRef({});
  useEffect(() => () => Object.values(gestureCommits.current).forEach(clearTimeout), []);
  // A drag moves the scene directly; React re-renders the page once it settles.
  // Re-rendering on every touchmove stalled each frame of the model rotation.
  const liveScene = (key, value, commit) => {
    stateRef.current[key] = value;
    stateRef.current.invalidateScene?.();
    clearTimeout(gestureCommits.current[key]);
    gestureCommits.current[key] = setTimeout(() => commit(value), 150);
  };
  const dishGestures = useModelGesture({
    get angle() { return stateRef.current.drag ?? drag; },
    get zoom() { return stateRef.current.dishZoom ?? dishZoom; },
    maxZoom: maxDishZoom,
    onAngle: value => liveScene("drag", value, setDrag),
    onZoom: value => liveScene("dishZoom", Math.max(0.6, Math.min(maxDishZoom, value)), setDishZoom),
  });
  const [dish, setDish] = useState(initialDish);
  const [arStatus, setARStatus] = useState("idle");
  const [arScale, setARScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [arSupported, setARSupported] = useState(false);
  const [iosArUnsupported, setIosArUnsupported] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsAndroid(/Android/i.test(navigator.userAgent));
      // Only Safari opens Quick Look; other iOS browsers (Brave…) download the USDZ.
      const browser = classifyArBrowser(readLiveArClientSnapshot());
      setARSupported(browser === "ios-safari");
      setIosArUnsupported(browser === "ios-other");
      const requested = new URLSearchParams(location.search).get("dish");
      if (sourceDishes.some(item => item.id === requested)) setDish(requested);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const [modelError, setModelError] = useState(null);
  const [modelLoading, setModelLoading] = useState(null);
  const [retryModel, setRetryModel] = useState(0);
  const menuRef = useRef(null);
  const veilRef = useRef(null);
  const headerRef = useRef(null);
  const supportAngle = supportAngles[collection];
  const turnSupport = (angle) =>
    setSupportAngles((angles) => ({ ...angles, [collection]: angle }));
  const supportGestures = useSupportGesture({
    get angle() {
      const angle = stateRef.current.supportAngle ?? supportAngle;
      return (((angle % 360) + 360) % 360) / 360;
    },
    pitch: 0,
    zoom: 1,
    zoomEnabled: false,
    onAngle: (angle) => liveScene("supportAngle", angle * 360, turnSupport),
  });
  const dishSwitchRef = useRef(null);
  useEffect(() => {
    const rail = dishSwitchRef.current;
    const button = rail?.querySelector('[aria-pressed="true"]');
    if (button)
      rail.scrollTo({
        left: button.offsetLeft - (rail.clientWidth - button.clientWidth) / 2,
        behavior: reduce ? "instant" : "smooth",
      });
  }, [dish, reduce]);
  const featureBeat = chapterBeats.features;
  const socialBeat = chapterBeats["social-content"];
  const selected = collections.find((x) => x.id === collection);
  const close = useCallback(() => setModal(null), []);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let ticking = false;
    let queuedFrame = 0;
    let lastPublishedScrollY;
    let lastSection = "";
    let lastChapterBeats = {};
    let measurements = [];
    let measuredWidth = 0;
    let transitions = [];
    let sceneFrames = {};
    let timing = stateRef.current.cinematicTiming || CINEMATIC_TIMING;
    let pendingPace = null;
    let arrivalAnchor = null;
    let arrivalEvent = null;
    const world = document.querySelector(".world");
    let opening = null;
    let stopped = false;
    let needsMeasure = false;
    let activeTouches = 0;
    let entryAssist;
    const arrivalY = scrollY;
    guideDismissed.current = Boolean(location.hash) || arrivalY > 16;
    let lastGuideVisible = false;
    const visualProperties = new WeakMap();
    const writeVisualProperty = (element, name, value) => {
      let previous = visualProperties.get(element);
      if (!previous) {
        previous = {};
        visualProperties.set(element, previous);
      }
      const text = String(value);
      if (previous[name] === text) return;
      previous[name] = text;
      element.style.setProperty(name, text);
    };
    const measure = () => {
      const previousOpening = opening;
      const previousMeasurements = measurements;
      const previousWidth = measuredWidth;
      const journey = openingRef.current;
      const journeyBounds = journey.getBoundingClientRect();
      const top = journeyBounds.top + scrollY;
      // The stage may grow to 100dvh to cover collapsing browser chrome.
      // Scroll budgets use the frozen svh reference, never its visual height.
      const frozenVh = Number.parseFloat(document.documentElement.style?.getPropertyValue?.("--vistaire-journey-vh"));
      const stageHeight = frozenVh > 0
        ? frozenVh * 100
        : Number.parseFloat(getComputedStyle(journey.firstElementChild).height);
      const travel = journeyBounds.height - stageHeight;
      const motionTravel = Math.max(
        1,
        stageHeight * timing.openingMotionScreens,
      );
      const sceneHeight = world.clientHeight;
      opening = {
        top,
        travel,
        motionTravel,
        aiHoldTravel: stageHeight * timing.aiHoldScreens,
        height: journeyBounds.height,
        stageHeight,
        sceneHeight,
      };
      measurements = chapters
        .map(([id]) => {
          const el = sectionRefs.current[id];
          if (!el) return null;
          const stage = el.firstElementChild,
            focus = el.querySelector(".scene-focus");
          const bounds = el.getBoundingClientRect(),
            stageBounds = stage.getBoundingClientRect();
          let sceneFrame = null;
          if (focus) {
            const r = focus.getBoundingClientRect();
            sceneFrame = {
              x: (r.left + r.width / 2) / innerWidth,
              y: (r.top - stageBounds.top + r.height / 2) / sceneHeight,
              width: r.width / innerWidth,
              height: r.height / sceneHeight,
            };
          }
          const openingAnchor = { hero: 0, ai: 0.5, wearable: 1 }[id];
          const sectionTop =
            openingAnchor == null
              ? bounds.top + scrollY
              : top + motionTravel * openingAnchor;
          scrollTargets.current[id] = id === "open-weight" && stateRef.current.pricingNavigationTarget
            ? stateRef.current.pricingNavigationTarget()
            : chapterNavigationTarget({ id, top: sectionTop }, stageHeight, timing);
          return {
            id,
            top: sectionTop,
            travel: Math.max(
              1,
              // Keep fractional CSS geometry in the chapter scroll budget.
              id === "open-weight"
                ? el.offsetHeight - sceneHeight
                : bounds.height - stageHeight,
            ),
            sceneFrame,
          };
        })
        .filter(Boolean);
      // Framing changes only with measured geometry, not on every scroll tick.
      sceneFrames = Object.fromEntries(measurements.map(m => [m.id, m.sceneFrame]));
      transitions = measureChapterTransitions(measurements, opening, timing);
      // A toolbar-only change can resize the 3D room and visual stages without
      // moving any authored stop. Reframe it, but do not cancel a running trip.
      const moved = previousOpening && (
        Math.abs(previousOpening.top - opening.top) > 0.5 ||
        Math.abs(previousOpening.stageHeight - opening.stageHeight) > 0.5 ||
        (previousWidth > 0 && Math.abs(previousWidth - innerWidth) > 0.5) ||
        previousMeasurements.length !== measurements.length ||
        measurements.some((m, i) => m.id !== "open-weight" && (
          !previousMeasurements[i] ||
          Math.abs(m.top - previousMeasurements[i].top) > 0.5 ||
          Math.abs(m.travel - previousMeasurements[i].travel) > 0.5
        ))
      );
      measuredWidth = innerWidth;
      if (moved) entryAssist?.cancel("layout-geometry-changed");
      const pricingEntry = measurements.find(m => m.id === "open-weight");
      const pricingTransition = transitionAtScroll(transitions, pricingEntry.top);
      stateRef.current.pricingSceneEntry = {
        section: "open-weight", progress: 0, openingProgress: null,
        scrollDistance: Math.max(0, (pricingEntry.top - opening.top) / opening.stageHeight),
        transition: pricingTransition, sceneFrames,
        sceneFrame: pricingTransition ? transitionSceneFrame(pricingTransition, sceneFrames) : null,
      };
      for (const { from, to, start, end } of transitions) {
        const el = sectionRefs.current[from.id];
        el.dataset.exitTo = to.id;
        el.dataset.exitStart = String(start);
        el.dataset.exitEnd = String(end);
      }
      entryAssist?.syncTouchLock();
    };
    const update = (now, insideSceneFrame = false) => {
      ticking = false;
      if (stopped || !openingRef.current) return;
      if (needsMeasure) {
        needsMeasure = false;
        measure();
      }
      if (pendingPace != null) {
        const pace = pendingPace;
        pendingPace = null;
        const nextTiming = scaledCinematicTiming(1 / pace);
        if (timing.sceneScreens !== nextTiming.sceneScreens) {
          const y = scrollY;
          const before = { measurements, opening, transitions, viewportHeight: innerHeight };
          timing = nextTiming;
          const journey = openingRef.current;
          writeVisualProperty(journey.parentElement, "--scroll-distance-scale", 1 / pace);
          writeVisualProperty(journey, "--opening-motion-vh", timing.openingMotionScreens * 100);
          writeVisualProperty(journey, "--opening-phone-hold-vh", timing.phoneHoldScreens * 100);
          writeVisualProperty(journey, "--opening-release-vh", timing.openingReleaseScreens * 100);
          measure();
          scrollTo({
            top: remapJourneyScroll(y, before, { measurements, opening, transitions, viewportHeight: innerHeight }),
            behavior: "instant",
          });
        }
        stateRef.current.cinematicTiming = timing;
      }
      if (arrivalAnchor != null) {
        // A newer input can arrive after hashchange but before this frame.
        if (arrivalEvent && !entryAssist.isNavigationCurrent(arrivalEvent)) {
          arrivalAnchor = null;
          arrivalEvent = null;
        } else if (arrivalAnchor !== "open-weight" || stateRef.current.pricingNavigationTarget) {
          if (Object.hasOwn(scrollTargets.current, arrivalAnchor))
            scrollTo({ top: arrivalAnchor === "open-weight" ? stateRef.current.pricingNavigationTarget() : scrollTargets.current[arrivalAnchor], behavior: "instant" });
          arrivalAnchor = null;
          arrivalEvent = null;
        }
      }
      const y = scrollY;
      const openingPosition = openingProgressAtScroll(opening, y);
      // Once native scrolling or an interactive control is understood, leave
      // the visitor alone with respect to discovery hints.
      const discoveryDistance = Math.max(64, Math.min(120, opening.sceneHeight * 0.1));
      if (Math.abs(y - arrivalY) >= discoveryDistance) guideDismissed.current = true;
      const showGuide = !guideDismissed.current && openingPosition < 0.14;
      if (showGuide !== lastGuideVisible) {
        lastGuideVisible = showGuide;
        setGuideVisible(showGuide);
      }
      let current = measurements[0];
      for (const m of measurements) {
        if (y >= m.top - 1) current = m;
        else break;
      }
      if (!current) return;
      const openingProgress =
        y < opening.top + opening.height
          ? openingPosition
          : null;
      const transition = transitionAtScroll(transitions, y);
      const firstLeg = cinematicCopyWeights(openingPosition / 0.5);
      const secondLeg = cinematicCopyWeights((openingPosition - 0.5) / 0.5);
      const openingExit = cinematicCopyWeights((y - transitions[0].start) / (transitions[0].end - transitions[0].start));
      const openingOpacities = [
        firstLeg.outgoing,
        firstLeg.incoming * secondLeg.outgoing,
        secondLeg.incoming * openingExit.outgoing,
      ];
      // Flush the final state even if this contact left the opening entirely.
      // Native scrolling cancels PointerEvents before physical touch end.
      if (!activeTouches)
        ["hero", "ai", "wearable"].forEach((id, i) => {
          const panel = sectionRefs.current[id];
          const inert = openingOpacities[i] < 0.5;
          const hidden = String(openingOpacities[i] < 0.01);
          if (panel.inert !== inert) panel.inert = inert;
          if (panel.getAttribute("aria-hidden") !== hidden) panel.setAttribute("aria-hidden", hidden);
        });
      let sceneFrame = current.sceneFrame;
      if (openingProgress != null) {
        const p = openingProgress;
        current = measurements.find(m => m.id === (p < 0.25 ? "hero" : p < 0.75 ? "ai" : "wearable"));
        const from = measurements[p < 0.5 ? 0 : 1].sceneFrame;
        const to = measurements[p < 0.5 ? 1 : 2].sceneFrame;
        const weight = cinematicEase((p - (p < 0.5 ? 0 : 0.5)) / 0.5);
        sceneFrame = Object.fromEntries(Object.keys(from).map(key => [key, from[key] + (to[key] - from[key]) * weight]));
      }
      ["hero", "ai", "wearable"].forEach((id, i) => {
        const panel = sectionRefs.current[id];
        writeVisualProperty(panel, "--opening-opacity", openingOpacities[i]);
        writeVisualProperty(panel, "--opening-shift", `${(1 - openingOpacities[i]) * (i === 0 ? -28 : 28)}px`);
      });
      writeVisualProperty(openingRef.current.firstElementChild, "position",
        openingOpacities.some(alpha => alpha > 0) ? "fixed" : "sticky");
      // Objects, fitted camera, focus, room and copy share the same measured
      // window, including the incoming chapter's head after its DOM boundary.
      if (transition)
        sceneFrame = transitionSceneFrame(transition, sceneFrames);
      // Pin visible copy natively: a JS translation cannot keep up with
      // asynchronous scrolling. Hidden stages retain their offscreen layout.
      for (const m of measurements.slice(3)) {
        if (m.id === "open-weight") continue;
        const incoming = transitions.find(t => t.to.id === m.id);
        const outgoing = transitions.find(t => t.from.id === m.id);
        const weights = window => window
          ? cinematicCopyWeights((y - window.start) / (window.end - window.start))
          : { incoming: 1, outgoing: 1 };
        const entrance = weights(incoming).incoming;
        const alpha = entrance * weights(outgoing).outgoing;
        const el = sectionRefs.current[m.id];
        writeVisualProperty(el, "--copy-opacity", alpha);
        writeVisualProperty(el, "--copy-shift", `${(1 - entrance) * 24}px`);
        if (m.id === "testimonies")
          writeVisualProperty(world, "--identities-opacity", alpha);
        if (m.id !== "footer") {
          writeVisualProperty(el.firstElementChild, "position", alpha > 0 ? "fixed" : "sticky");
          // Transparent stages overlap visually, so only the
          // dominant chapter may receive pointer or keyboard interactions.
          if (!activeTouches && el.inert !== (alpha < 0.5)) el.inert = alpha < 0.5;
        }
      }
      world.dataset.transition = transition ? `${transition.from}:${transition.to}` : "";
      world.dataset.transitionProgress = String(transition?.progress ?? "");
      const progress =
        openingProgress == null
          ? clamp((y - current.top) / current.travel)
          : openingProgress;
      stateRef.current.section = current.id;
      const pricing = measurements.find((m) => m.id === "open-weight");
      stateRef.current.pageScrollY = y;
      stateRef.current.pricingSectionTop = pricing.top;
      // The source's transparent FAQ/footer retain the completed restaurant
      // backdrop. Only reversing above offers resumes the cinematic scene.
      stateRef.current.sceneOccluded = y >= pricing.top;
      stateRef.current.scrollDistance = Math.max(
        0,
        (y - opening.top) / opening.stageHeight,
      );
      stateRef.current.progress = progress;
      // Preserve each chapter's endpoint while it is offscreen. Returning
      // from below prepares the final card/open lid before the first pixel
      // becomes visible, independent of scroll direction or contact lifetime.
      stateRef.current.chapterProgress = Object.fromEntries(
        measurements.slice(3).map((m) => [m.id, clamp((y - m.top) / m.travel)]),
      );
      stateRef.current.openingProgress = openingProgress;
      stateRef.current.sceneFrame = sceneFrame;
      stateRef.current.sceneFrames = sceneFrames;
      stateRef.current.transition = transition;
      const social = readingPresentation(stateRef.current.chapterProgress["social-content"]);
      const feature = readingPresentation(stateRef.current.chapterProgress.features);
      writeVisualProperty(
        sectionRefs.current["social-content"],
        "--rail-progress",
        stateRef.current.reducedMotion ? social.index : social.position,
      );
      writeVisualProperty(sectionRefs.current.features, "--detail-opacity",
        feature.opacity);
      const preparedBeats = {
        features: feature.index,
        "social-content": social.index,
      };
      if (current.id !== lastSection) {
        lastSection = current.id;
        setChapter(current.id);
        document.documentElement.dataset.chapter = current.id;
      }
      if (
        Object.keys(preparedBeats).some(
          (id) => preparedBeats[id] !== lastChapterBeats[id],
        )
      ) {
        lastChapterBeats = preparedBeats;
        setChapterBeats(preparedBeats);
      }
      // Keep the raw native position, including elastic overscroll, separate
      // from the clamped cinematic distance so an unchanged bounce stays idle.
      stateRef.current.syncPricingScroll?.(y, pricing.top);
      lastPublishedScrollY = y;
      if (!insideSceneFrame) {
        // Publish all copy, background and timeline state before the renderer
        // consumes it, without an extra requestAnimationFrame of latency.
        if (Number.isFinite(now) && stateRef.current.renderSceneFrame)
          stateRef.current.renderSceneFrame(now);
        else stateRef.current.invalidateScene?.();
      }
    };
    const queue = () => {
      if (!ticking && !stopped) {
        ticking = true;
        queuedFrame = requestAnimationFrame(update);
      }
    };
    const beforeSceneFrame = (now) => {
      // Native scroll can change before its scroll event is delivered (including
      // scrollTo in another RAF). An already pending scene must sample that
      // position too, without waiting for another frame or starting a loop.
      if (stopped || (!ticking && scrollY === lastPublishedScrollY)) return;
      cancelAnimationFrame(queuedFrame);
      update(now, true);
    };
    stateRef.current.beforeSceneFrame = beforeSceneFrame;
    const requestPace = (value) => {
      entryAssist?.cancel("pace-change");
      const currentPace = pendingPace ?? CINEMATIC_TIMING.sceneScreens / timing.sceneScreens;
      pendingPace = normalizeScrollPace(typeof value === "function" ? value(currentPace) : value);
      // The touch thumb and buttons respond immediately, even if rendering is
      // busy. Only the latest geometry change waits for the existing queue.
      setScrollPace(pendingPace);
      const url = new URL(location.href);
      url.searchParams.set("scrollPace", pendingPace.toFixed(2));
      history.replaceState(history.state, "", url);
      queue();
    };
    const paceState = stateRef.current;
    paceState.setScrollPace = requestPace;
    const layoutChanged = () => {
      // Defer to measure(): only a real change to authored stops cancels assist.
      needsMeasure = true;
      queue();
    };
    const observer = new ResizeObserver(layoutChanged);
    observer.observe(document.querySelector(".world"));
    Object.values(sectionRefs.current).forEach((el) => {
      observer.observe(el);
      observer.observe(el.firstElementChild);
      const focus = el.querySelector(".scene-focus");
      if (focus) observer.observe(focus);
    });
    document.fonts.ready.then(() => {
      if (!stopped) layoutChanged();
    });
    measure();
    entryAssist = createEntryScrollAssist({
      getGeometry: () => ({ opening, transitions, pricing: stateRef.current.pricingReadingStops?.() }),
      isBlocked: () => {
        const state = stateRef.current;
        return stopped || !state.sceneReady || state.menuOpen || state.modalOpen || state.arActive || state.reducedMotion;
      },
    });
    paceState.cancelEntryAssist = entryAssist.cancel;
    paceState.syncEntryTouchLock = entryAssist.syncTouchLock;
    paceState.setEntryTouchSuppressed = entryAssist.setTouchSuppressed;
    const parameters = new URLSearchParams(location.search);
    if (parameters.get("performanceCapture") === "1") {
      queueMicrotask(() => { if (!stopped) setPerformanceCapture(true); });
    }
    const initialPace = parameters.get("scrollPace");
    if (initialPace != null) {
      pendingPace = normalizeScrollPace(initialPace);
      setScrollPace(pendingPace);
    }
    // Overlayed opening panels share one DOM position; their deep links need
    // the same measured scroll destination as the navigation controls.
    arrivalAnchor = location.hash.slice(1);
    const pointer = (e) => {
      stateRef.current.pointer = {
        x: (e.clientX / innerWidth) * 2 - 1,
        y: (e.clientY / innerHeight) * 2 - 1,
      };
    };
    const contactChanged = (event) => {
      activeTouches = event.touches.length;
      if (!activeTouches) queue();
    };
    if (initialPace == null) update();
    else queue();
    const navigateHash = (event) => {
      if (!entryAssist.isNavigationCurrent(event)) return;
      entryAssist.cancel("hash-navigation");
      arrivalAnchor = location.hash.slice(1);
      arrivalEvent = event;
      queue();
    };
    addEventListener("hashchange", navigateHash);
    addEventListener("scroll", queue, { passive: true });
    // ResizeObserver tracks real stage/focus sizes, without measuring the
    // whole page again for toolbar-only resize notifications.
    addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("touchstart", contactChanged, { passive: true });
    document.addEventListener("touchend", contactChanged, { passive: true });
    document.addEventListener("touchcancel", contactChanged, { passive: true });
    return () => {
      removeEventListener("scroll", queue);
      removeEventListener("hashchange", navigateHash);
      stopped = true;
      entryAssist.dispose();
      if (paceState.cancelEntryAssist === entryAssist.cancel) delete paceState.cancelEntryAssist;
      if (paceState.syncEntryTouchLock === entryAssist.syncTouchLock) delete paceState.syncEntryTouchLock;
      if (paceState.setEntryTouchSuppressed === entryAssist.setTouchSuppressed) delete paceState.setEntryTouchSuppressed;
      delete paceState.setScrollPace;
      if (paceState.beforeSceneFrame === beforeSceneFrame) delete paceState.beforeSceneFrame;
      cancelAnimationFrame(queuedFrame);
      observer.disconnect();
      removeEventListener("pointermove", pointer);
      document.removeEventListener("touchstart", contactChanged);
      document.removeEventListener("touchend", contactChanged);
      document.removeEventListener("touchcancel", contactChanged);
    };
  }, []);
  useEffect(() => {
    Object.assign(stateRef.current, {
      collection,
      phoneDemo,
      supportAngle,
      flip,
      drag,
      dishZoom,
      dish,
      reducedMotion: reduce,
      modalOpen: Boolean(modal),
      menuOpen: menu,
      arActive: arStatus !== "idle",
      sceneReady: ready && !gpuError,
      retryModel,
    });
    if (menu || modal || reduce || arStatus !== "idle" || !ready || gpuError) stateRef.current.cancelEntryAssist?.("blocked-ui-state");
    stateRef.current.setEntryTouchSuppressed?.(Boolean(menu || modal || arStatus !== "idle"));
    stateRef.current.syncEntryTouchLock?.();
    stateRef.current.invalidateScene?.();
  }, [
    collection,
    phoneDemo,
    supportAngle,
    flip,
    drag,
    dishZoom,
    dish,
    reduce,
    modal,
    menu,
    arStatus,
    ready,
    gpuError,
    retryModel,
  ]);
  useEffect(() => {
    if (!menu) return;
    const unbindViewport = bindPublicMenuViewport(headerRef.current, menuRef.current);
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const buttons = () => [
      ...headerRef.current.querySelectorAll("button,a[href]"),
      ...menuRef.current.querySelectorAll("button,a[href]"),
    ].filter((control) => control.getClientRects().length > 0);
    const focusFrame = requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector("button,a[href]");
      if (first && !menuRef.current.inert && document.activeElement === previous
        && getComputedStyle(first).visibility === "visible") first.focus({ preventScroll: true });
    });
    const key = (e) => {
      if (e.key === "Escape") setMenu(false);
      if (e.key === "Tab") {
        const controls = buttons(),
          first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    addEventListener("keydown", key);
    return () => {
      unbindViewport();
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = overflow;
      removeEventListener("keydown", key);
      previous?.focus({ preventScroll: true });
    };
  }, [menu]);
  useEffect(() => {
    for (const video of document.querySelectorAll("video[data-play-when]")) {
      const when = video.dataset.playWhen;
      if (video.dataset.demo === "true") {
        video.defaultPlaybackRate = 1;
        video.playbackRate = 1;
      }
      // Buffer the three menu videos from the chapter before them: starting a
      // preload="none" MP4 inside an option change dropped frames mid-trip.
      if (when.startsWith("social-content") && (chapter === "testimonies" || chapter === "social-content")
        && video.dataset.primed !== "true" && !reduce) {
        video.dataset.primed = "true";
        video.preload = "auto";
        video.load();
      }
      const play =
        when === chapter ||
        (when === `social-content-${beat}` && chapter === "social-content");
      if (play && !gpuError && !reduce && !modal && !menu) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [chapter, beat, reduce, modal, menu, gpuError]);
  const goto = useCallback(
    (id) => {
      stateRef.current.cancelEntryAssist?.("chapter-navigation");
      setMenu(false);
      const top = id === "open-weight" && stateRef.current.pricingNavigationTarget
          ? stateRef.current.pricingNavigationTarget()
          : ["hero", "ai", "wearable"].includes(id)
          ? scrollTargets.current[id] ?? 0
          : chapterNavigationTarget({ id, top: (sectionRefs.current[id]?.getBoundingClientRect().top ?? 0) + scrollY }, openingRef.current?.firstElementChild.getBoundingClientRect().height ?? innerHeight, stateRef.current.cinematicTiming);
      const jump = () => {
        scrollTo({ top, behavior: "instant" });
        history.replaceState(null, "", `#${id}`);
      };
      // A smooth scroll replayed every chapter's 3D transition on the way.
      // Fade out, jump, and fade in on the destination instead.
      const veil = veilRef.current;
      if (reduce || !veil?.animate) return jump();
      veil.getAnimations().forEach((animation) => animation.cancel());
      veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-in", fill: "forwards" })
        .finished.then(() => {
          jump();
          // Two frames let the scene draw the destination before it is revealed.
          requestAnimationFrame(() => requestAnimationFrame(() =>
            veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "ease-out", fill: "forwards" })));
        }, () => {});
    },
    [reduce],
  );
  const currentDish = dishes.find((x) => x.id === dish);
  const launchAR = (item) => {
    if (isAndroid && navigator.xr && stateRef.current.startAR && !gpuError) {
      setModal(null);
      setARScale(1);
      stateRef.current.startAR().catch((error) => {
        setARStatus("idle");
        setModal({
          type: "ar",
          id: item.id,
          error:
            error.name === "NotAllowedError"
              ? t(
                  "L’accès à la caméra a été refusé. Autorisez-le pour essayer la réalité augmentée.",
                )
              : t(
                  "La réalité augmentée n’est pas disponible dans ce navigateur. Essayez Chrome sur un Android compatible.",
                ),
        });
      });
    } else setModal({
      type: "ar",
      id: item.id,
      error: iosArUnsupported
        ? t("La réalité augmentée n’est pas disponible dans ce navigateur. Sur iPhone, ouvrez cette page dans Safari.")
        : undefined,
    });
  };
  const onSceneError = useCallback(() => {
    stateRef.current.pricingHandUnavailable = true;
    stateRef.current.syncPricingScroll?.();
    setGpuError(true);
    setModelLoading(null);
    setModelError(null);
    setPhoneVideoError(null);
    setMenu(false);
    setModal(null);
    setReady(false);
  }, []);
  const onSceneReady = useCallback(() => setReady(true), []);
  const showSceneError = useCallback(dialog => {
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  useEffect(() => {
    if (!ready || !new URLSearchParams(location.search).has("dish")) return;
    const el = sectionRefs.current.grip;
    stateRef.current.cancelEntryAssist?.("dish-query-navigation");
    if (el) scrollTo({ top: chapterNavigationTarget({ id: "grip", top: el.getBoundingClientRect().top + scrollY }, openingRef.current.firstElementChild.getBoundingClientRect().height, stateRef.current.cinematicTiming), behavior: "instant" });
  }, [ready]);
  const ref = useCallback(
    (id) => (el) => {
      sectionRefs.current[id] = el;
    },
    [],
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(site);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setModal({ type: "share" });
    }
  };
  return (
    <>
      <a
        className="skip-link"
        href="#ai"
        onClick={(e) => {
          e.preventDefault();
          goto("ai");
        }}
      >
        {t("Aller au contenu")}
      </a>
      <div className="world">
        <div id="pricing-screen-host" />
        <Suspense fallback={null}>
          {!gpuError && sceneStarted && (
            <Scene
              stateRef={stateRef}
              onReady={onSceneReady}
              onError={onSceneError}
              onAssetError={setModelError}
              onAssetLoading={setModelLoading}
              onPhoneVideoError={setPhoneVideoError}
              onARStatus={setARStatus}
              onZoomFit={fit => {
                setFittedDishZoom(fit);
                setDishZoom(zoom => Math.min(zoom, fit.max));
              }}
            />
          )}
        </Suspense>
        {/* After the scene layer, so the still covers the loading canvas. */}
        {!posterGone && (
          <picture className={`opening-poster${ready ? " is-faded" : ""}`}
            onTransitionEnd={() => ready && setPosterGone(true)}>
            <source media="(orientation: landscape)" srcSet="/immersive-assets/opening-poster-landscape.webp" />
            <img src="/immersive-assets/opening-poster-portrait.webp" alt="" fetchPriority="high" />
          </picture>
        )}
      </div>
      <div id="pricing-actions-host" />
      {performanceCapture && (
        <Suspense fallback={null}>
          <PerformanceCapturePanel stateRef={stateRef} locale={locale} onClose={() => setPerformanceCapture(false)} />
        </Suspense>
      )}
      {scrollPace != null && (
        <details open className="pace-preview" aria-label={locale === "en" ? "Journey pace preview" : "Aperçu du rythme du parcours"}>
          <summary>
            <span>{locale === "en" ? "Pace" : "Rythme"} <output htmlFor="scroll-pace">{scrollPace.toFixed(2)}×</output></span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="pace-preview-heading">
            <label className="sr-only" htmlFor="scroll-pace">{locale === "en" ? "Pace" : "Rythme"}</label>
            <button type="button" className="pace-step" disabled={scrollPace <= SCROLL_PACE.min}
              aria-label={locale === "en" ? "Slow down scrolling" : "Ralentir le défilement"}
              onClick={() => stateRef.current.setScrollPace?.(pace => pace - SCROLL_PACE.step)}>−</button>
            <input id="scroll-pace" type="range" min={SCROLL_PACE.min} max={SCROLL_PACE.max} step={SCROLL_PACE.step} value={scrollPace}
              aria-describedby="scroll-pace-help"
              aria-valuetext={`${scrollPace.toFixed(2)}×`}
              onChange={event => stateRef.current.setScrollPace?.(event.target.value)} />
            <button type="button" className="pace-step" disabled={scrollPace >= SCROLL_PACE.max}
              aria-label={locale === "en" ? "Speed up scrolling" : "Accélérer le défilement"}
              onClick={() => stateRef.current.setScrollPace?.(pace => pace + SCROLL_PACE.step)}>+</button>
          </div>
          <div className="pace-preview-labels">
            <span>{locale === "en" ? "Slower" : "Plus lent"}</span>
            <button type="button" onClick={() => stateRef.current.setScrollPace?.(SCROLL_PACE.default)}>
              {locale === "en" ? "Reset" : "Réinitialiser"}
            </button>
            <span>{locale === "en" ? "Faster" : "Plus rapide"}</span>
          </div>
          <p id="scroll-pace-help">{locale === "en" ? "Higher pace shortens the journey’s scroll distance." : "Un rythme plus élevé raccourcit la distance à faire défiler."}</p>
        </details>
      )}
      {gpuError && (
        <dialog className="scene-error" role="alertdialog" aria-labelledby="scene-error-title"
          ref={showSceneError} onCancel={event => event.preventDefault()}>
          <div className="loading-word">Vistaire</div>
          <p id="scene-error-title">{t("L’expérience 3D est indisponible.")}</p>
          <Action onClick={() => location.reload()}>{t("Réessayer")}</Action>
          <Link prefetch={false} className="text-link" href={link("/demo")}>
            {t("Explorer la carte")} <ArrowUpRight size={17} />
          </Link>
        </dialog>
      )}
      {holdingScroll && !leaving && (
        <div className="poster-cue" role="status">
          <div className="loading-line" />
          <span>{t("Préparons votre table.")}</span>
        </div>
      )}
      {leaving && !gpuError && (
        <div className="preloader" role="status">
          <div className="loading-word">Vistaire</div>
          <div className="loading-line" />
          <span>{t("Préparons votre table.")}</span>
        </div>
      )}
      <div ref={veilRef} className="navigation-veil" aria-hidden="true" />
      <header ref={headerRef} id="landing-navigation" data-public-navigation-open="true" className={`site-header ${chapter === "hero" ? "at-hero" : ""}`}
        onPointerDownCapture={dismissGuideOnInteraction} onFocusCapture={dismissGuideOnInteraction}>
        <button
          className="brand"
          onClick={() => goto("hero")}
          aria-label={t("Vistaire, retour à l’introduction")}
        >
          VISTAIRE
        </button>
        <nav aria-label={t("Navigation principale")} className="desktop-nav">
          {[
            ["hero", "Intro"],
            ["features", t("L’expérience")],
            ["product", "Collections"],
            ["open-weight", t("Tarifs")],
            ["footer", "Contact"],
          ].map(([id, name]) => (
            <button
              key={id}
              className={chapter === id ? "active" : ""}
              onClick={() => goto(id)}
            >
              {name}
            </button>
          ))}
        </nav>
        <button className="header-3d" onClick={() => goto("grip")}>
          <span className="small-dot" />
          {t("Explorer en 3D")} <ArrowUpRight size={14} />
        </button>
        <PublicControls
          locale={locale}
          languages={[
            { href: "/", label: "FR", active: locale === "fr" },
            { href: "/en", label: "EN", active: locale === "en" },
          ]}
          onNavigate={() => setMenu(false)}
        />
        <button
          className="menu-toggle"
          aria-expanded={menu}
          aria-controls="mobile-menu"
          onClick={() => setMenu(!menu)}
        >
          <span className="small-dot" />
          {menu ? t("Fermer") : "Menu"}
        </button>
      </header>
      <aside
        ref={menuRef}
        className={`mobile-menu ${menu ? "is-open" : ""}`}
        id="mobile-menu"
        inert={!menu ? true : undefined}
        aria-label={t("Menu mobile")}
      >
        <nav>
          {[
            ["hero", "Introduction"],
            ["features", t("L’expérience")],
            ["product", "Collections"],
            ["open-weight", t("Tarifs")],
            ["footer", "Contact"],
          ].map(([id, name], i) => (
            <button key={id} onClick={() => goto(id)}>
              <small>0{i + 1}</small>
              {name}
              <ArrowUpRight />
            </button>
          ))}
        </nav>
        <nav className="menu-page-links" aria-label={t("Les pages Vistaire")}>
          <Link prefetch={false} href={link("/demo")}>
            {t("Les cartes")}
          </Link>
          <Link prefetch={false} href={link("/a-propos")}>
            {t("À propos")}
          </Link>
          <Link prefetch={false} href={link("/tarifs-menu-digital-restaurant")}>
            {t("L’offre complète")}
          </Link>
          <Link prefetch={false} href={link("/apercu-restaurateur")}>
            {t("Le Dashboard")}
          </Link>
          <Link prefetch={false} href={link("/contact")}>
            {t("Nous contacter")}
          </Link>
          <Link prefetch={false} href={link("/prendre-rendez-vous")}>
            {t("Prendre rendez-vous")}
          </Link>
          <Link prefetch={false} href={link("/menu-digital-restaurant")}>
            {t("Découvrir Vistaire")}
          </Link>
          <Link prefetch={false} href={link("/menu-qr-code-restaurant")}>
            {locale === "en" ? "QR code menu" : "Menu QR code"}
          </Link>
          <Link prefetch={false} href={link("/menu-3d-ar-restaurant")}>
            {locale === "en" ? "3D & AR menu" : "Menu 3D et AR"}
          </Link>
          <Link prefetch={false} href={link("/menu-pdf-vs-menu-digital")}>
            {locale === "en" ? "PDF vs digital menu" : "PDF ou menu digital"}
          </Link>
        </nav>
        <div>
          <span>{t("Une carte qui vous ressemble.")}</span>
          <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-shade"
          aria-label={t("Fermer le menu")}
          onClick={() => setMenu(false)}
        />
      )}
      <main id="content" onPointerDownCapture={dismissGuideOnInteraction} onFocusCapture={dismissGuideOnInteraction}>
        <div
          className="opening-journey"
          ref={openingRef}
          style={{
            "--opening-motion-vh": OPENING_MOTION_VH,
            "--opening-phone-hold-vh": OPENING_PHONE_HOLD_VH,
            "--opening-release-vh": CINEMATIC_TIMING.openingReleaseScreens * 100,
          }}
        >
          <div className="opening-stage">
            <Chapter
              id="hero"
              height={100}
              chapterRef={ref("hero")}
              className="hero"
            >
              <span className="hero-kicker">
                {t("Pensé pour vos plats. Créé pour vos tables.")}
              </span>
              <h1 id="hero-title" className="hero-word">
                VISTAIRE
              </h1>
              <p className="hero-copy">
                {t(
                  "Donnez envie avant la première bouchée. Une carte mobile, visuelle et fidèle à votre restaurant.",
                )}
              </p>
              <div className="hero-glass">
                <h2>
                  {t("Votre cuisine.")} <br />
                  {t("Votre univers.")} <br />
                  {t("Une autre")} <br />
                  {t("dimension.")}
                </h2>
                <p>
                  {t(
                    "Du QR code à une carte qui se vit. Sans application à télécharger.",
                  )}
                </p>
                <Link prefetch={false} className="text-link" href={link("/demo")}>
                  {t("Explorer la carte")}
                  <ArrowUpRight size={17} />
                </Link>
              </div>
              <FocusFrame aria-hidden="true" />

            </Chapter>
            <Chapter
              id="ai"
              height={290}
              chapterRef={ref("ai")}
              className="experience"
            >
              <h2 id="ai-title" className="side-heading">
                {t("Ce n’est pas")}
                {" "}<br />
                {t("juste un")}
                {" "}<br />
                <em>QR code.</em>
              </h2>
              <div className="side-copy">
                <span className="eyebrow">
                  {t("01 · Du scan à la découverte")}
                </span>
                <p>
                  {t(
                    "Un simple geste ouvre tout l’univers de votre restaurant. Vos plats, vos prix, vos histoires. Une vraie carte, pensée pour le mobile.",
                  )}
                </p>
                <Action href={link("/demo")}>
                  {t("Essayez l’expérience")}
                  <ArrowUpRight size={15} />
                </Action>
              </div>
              <FocusFrame aria-hidden="true" />
              <div className="chapter-bottom">
                <span>{t("Scan. Découvrez. Choisissez.")}</span>
                <span>{t("Sans compte. Sans application.")}</span>
              </div>

            </Chapter>
            <Chapter
              id="wearable"
              height={270}
              chapterRef={ref("wearable")}
              className="wearable"
            >
              <Heading>
                <span className="eyebrow">{t("02 · Au creux de la main")}</span>
                <h2 id="wearable-title">
                  {t("Votre carte.")}
                  {" "}<br />
                  <em>{t("À portée de main.")}</em>
                </h2>
                <p>
                  {t(
                    "Un menu qui s’ouvre instantanément. Une expérience fidèle à votre restaurant.",
                  )}
                </p>
              </Heading>
              <FocusFrame aria-hidden="true" />
              <div
                className="menu-demo-picker"
                role="group"
                aria-label={t("Choisir une expérience mobile")}
              >
                {experiences.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setPhoneDemo(x.id)}
                    aria-pressed={phoneDemo === x.id}
                  >
                    <span>{x.name}</span>
                    <small>{x.tag}</small>
                  </button>
                ))}
              </div>
              {phoneVideoError === phoneDemo && (
                <div className="model-error phone-video-error" role="status">
                  <span>{t("La démonstration vidéo est indisponible.")}</span>
                  <button onClick={() => stateRef.current.retryPhoneVideo?.()}>{t("Réessayer")}</button>
                </div>
              )}

            </Chapter>
          </div>
        </div>
        <Chapter
          id="features"
          height={CINEMATIC_TIMING.readingChapterHeightVh}
          chapterRef={ref("features")}
          className="features"
        >
          <h2 id="features-title" className="sr-only">
            {t("Chaque détail compte")}
          </h2>
          <div className="feature-top">
            <span className="feature-number">0{featureBeat + 1}</span>
            <span className="eyebrow">{t("Chaque détail compte")}</span>
          </div>
          <div className="feature-card">
            {[
              {
                eyebrow: t("Une carte claire"),
                title: t("De l’envie à la première bouchée."),
                description: t(
                  "Des catégories lisibles, une navigation intuitive et une expérience rapide. Le menu s’ouvre dans le navigateur du client.",
                ),
              },
              {
                eyebrow: t("Des plats qui se racontent"),
                title: t("Vos signatures, sous tous les angles."),
                description: t(
                  "La 3D apporte un vrai plus aux plats qui le méritent. Explorez leur présentation avant de les découvrir à table.",
                ),
              },
              {
                eyebrow: t("Le bon choix, simplement"),
                title: t("Les bonnes informations. Au bon endroit."),
                description: t(
                  "Prix, descriptions, langues et allergènes : votre carte aide chacun à choisir avec confiance.",
                ),
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="feature-panel"
                data-feature-active={index === featureBeat}
                aria-hidden={index !== featureBeat ? true : undefined}
                inert={index !== featureBeat ? true : undefined}
              >
                <span className="eyebrow">{feature.eyebrow}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <Action
                  href={index === 1 ? undefined : link("/demo")}
                  onClick={index === 1 ? () => goto("grip") : undefined}
                >
                  {index === 1
                    ? t("Manipuler le plat")
                    : t("Découvrir la carte")}
                  <ArrowUpRight size={15} />
                </Action>
              </div>
            ))}
          </div>
          <FocusFrame aria-hidden="true" />
          <div className="feature-dots">
            {[0, 1, 2].map((n) => (
              <span key={n} className={n === featureBeat ? "selected" : ""} />
            ))}
          </div>

        </Chapter>
        <Chapter
          id="encryption"
          height={CINEMATIC_TIMING.chapterHeightVh}
          chapterRef={ref("encryption")}
          className="identity"
        >
          <Heading>
            <span className="eyebrow">
              {t("Votre restaurant. Votre signature.")}
            </span>
            <h2 id="encryption-title">
              {t("La signature")}
              {" "}<br />
              <em>{t("de votre table.")}</em>
            </h2>
            <p>{t("Des matières et des lignes choisies pour votre lieu.")}</p>
          </Heading>
          <FocusFrame aria-hidden="true" />
          <Action dark onClick={() => setFlip(!flip)} aria-pressed={flip}>
            <RotateCw size={13} />
            {flip ? t("Voir le QR code") : t("Retourner le support")}
          </Action>

        </Chapter>
        <Chapter
          id="grip"
          height={CINEMATIC_TIMING.chapterHeightVh}
          chapterRef={ref("grip")}
          className="grip"
        >
          <Heading>
            <span className="eyebrow">{t("Voir avant de savourer")}</span>
            <h2 id="grip-title">
              {t("Chaque angle.")}{" "}
              <em>{t("Chaque détail.")}</em>
            </h2>
            <p>{t("Un plat en volume, à explorer du bout des doigts.")}</p>
          </Heading>
          <div
            className="dish-switch"
            ref={dishSwitchRef}
            role="group"
            aria-label={t("Choisir un plat 3D")}
          >
            {dishes
              .filter((x) => x.model)
              .map((x) => (
                <button
                  key={x.id}
                  data-dish-id={x.id}
                  className={dish === x.id ? "selected" : ""}
                  aria-pressed={dish === x.id}
                  onClick={() => {
                    setDish(x.id);
                    setDishZoom(1);
                    setDrag(0.5);
                  }}
                >
                  {x.label || x.name}
                </button>
              ))}
          </div>
          {modelLoading && (
            <span className="model-loading" role="status">
              {t("Préparation de")}{" "}
              {dishes.find((x) => x.id === modelLoading)?.label ||
                t("votre plat")}
              …
            </span>
          )}
          <FocusFrame
            className="dish-gesture"
            role="slider"
            tabIndex={0}
            aria-label={t("Faire tourner le plat en 3D")}
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(drag * 360)}
            {...dishGestures}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                setDrag(
                  clamp(drag + (e.key === "ArrowRight" ? 0.025 : -0.025)),
                );
              }
            }}
          />
          {modelError && (
            <div className="model-error" role="status">
              <span>
                {t(
                  "Ce plat ne peut pas être chargé. Le dernier modèle reste disponible.",
                )}
              </span>
              <button onClick={() => setRetryModel((n) => n + 1)}>
                {t("Réessayer")}
              </button>
            </div>
          )}
          <div className="rotation-control">
            <div>
              <span>{t("Tourner le plat")}</span>
              <span>{Math.round(drag * 360)}°</span>
            </div>
            <div className="rotation-track">
              <MoveHorizontal size={16} />
              <RotationSlider value={drag} onChange={setDrag} />
            </div>
            <div
              className="dish-zoom"
              role="group"
              aria-label={t("Zoom du plat 3D")}
            >
              <button
                aria-label={t("Dézoomer le plat")}
                disabled={dishZoom <= 0.6}
                onClick={() =>
                  setDishZoom(Math.max(0.6, +(Math.min(dishZoom, fittedDishZoom.requested === dishZoom ? fittedDishZoom.zoom : dishZoom) - 0.2).toFixed(1)))
                }
              >
                −
              </button>
              <output aria-live="polite">{Math.round((fittedDishZoom.requested !== dishZoom ? dishZoom : fittedDishZoom.zoom) * 100)} %</output>
              <button
                aria-label={t("Zoomer le plat")}
                disabled={dishZoom >= maxDishZoom}
                onClick={() =>
                  setDishZoom((z) => Math.min(maxDishZoom, +(z + 0.2).toFixed(1)))
                }
              >
                +
              </button>
              <button
                className="reset-dish"
                aria-label={t("Recentrer le plat")}
                onClick={() => {
                  setDishZoom(1);
                  setDrag(0.5);
                }}
              >
                <RotateCw size={15} />
              </button>
            </div>
            <small>
              {t(
                "Glissez pour tourner. Écartez deux doigts pour vous rapprocher.",
              )}
            </small>
          </div>
          <div className="grip-actions">
            <ARAction
              item={currentDish}
              ios={arSupported}
              disabled={
                isAndroid && !gpuError && Boolean(modelLoading || modelError)
              }
              onLaunch={() => launchAR(currentDish)}
            />
            <DishDetailLink item={currentDish} />
          </div>

        </Chapter>
        <Chapter
          id="sustainability"
          height={CINEMATIC_TIMING.chapterHeightVh}
          chapterRef={ref("sustainability")}
          className="living"
        >
          <div className="living-copy">
            <span className="eyebrow">
              {t("Votre Dashboard restaurateur.")}
            </span>
            <h2 id="sustainability-title" className="living-title">
              {t("Toujours")}
              {" "}<br />
              <em>{t("vivante.")}</em>
            </h2>
            <div className="living-description">
              <p>
                {t("Changez un prix. Ajoutez un plat.")}
                {" "}<br />
                {t("Votre QR code reste le même.")}
              </p>
              <small className="dashboard-caption">
                {t("Aperçu du Dashboard Vistaire · données de démonstration")}
              </small>
              <a href={link("/apercu-restaurateur")}>
                {t("Explorer l’aperçu restaurateur")}
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          <FocusFrame aria-hidden="true" />
          <div className="living-facts">
            <span>{t("Contenus & disponibilités")}</span>
            <span>{t("Allergènes structurés")}</span>
            <span>{t("Langues de votre carte")}</span>
          </div>

        </Chapter>
        <Chapter
          id="testimonies"
          height={CINEMATIC_TIMING.chapterHeightVh}
          chapterRef={ref("testimonies")}
          className="identities"
        >
          <h2 id="testimonies-title">
            {t("Trois expériences.")}
            {" "}<br />
            {t("Trois identités.")}
          </h2>
          <p className="identity-intro">
            {t("Votre restaurant a son propre univers.")}
            {" "}<br />
            {t("Votre carte doit le prolonger.")}
          </p>
          <div className="experience-list">
            {experiences.map((x, i) => (
              <a
                key={x.id}
                href={link(`/menu/${x.id}?lang=fr-CA`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="index">0{i + 1}</span>
                <div>
                  <span className="eyebrow">{x.tag}</span>
                  <h3>{x.name}</h3>
                  <p>{x.description}</p>
                </div>
                <img
                  src={x.thumbnail}
                  alt={getSeoMarketingImage(`HOME:testimonies:${x.id}`, locale).alt}
                  loading="lazy"
                />
                <ArrowUpRight />
              </a>
            ))}
          </div>

        </Chapter>
        <Chapter
          id="social-content"
          height={CINEMATIC_TIMING.readingChapterHeightVh}
          chapterRef={ref("social-content")}
          className="social"
        >
          <h2 id="social-content-title" className="sr-only">
            {t("Vistaire à table")}
          </h2>
          <div className="social-rail">
            {experiences.map((x, i) => (
              <article
                key={x.id}
                className={socialBeat === i ? "is-current" : ""}
                inert={socialBeat !== i ? true : undefined}
                aria-hidden={socialBeat !== i}
              >
                <img
                  className="social-bg"
                  src={x.image}
                  alt={getSeoMarketingImage(`HOME:social-content:${x.id}`, locale).alt}
                  loading="lazy"
                />
                <div className="social-inner">
                  <span className="eyebrow">{x.tag}</span>
                  <h3>
                    {[t("L’envie."), t("Le choix."), t("L’expérience.")][i]}
                  </h3>
                  <p className="social-description">{x.description}</p>
                  <div className="walkthrough-frame">
                    <DemoVideo id={x.id} index={i} />
                  </div>
                  <div className="social-bottom">
                    <a
                      className="restaurant-menu-link"
                      href={link(`/menu/${x.id}?lang=fr-CA`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={
                        locale === "en"
                          ? `Open the ${x.name} menu in a new tab`
                          : `Ouvrir le menu de ${x.name} dans un nouvel onglet`
                      }
                    >
                      {x.name}
                      <ArrowUpRight size={16} />
                    </a>
                    <Action
                      href={link(`/menu/${x.id}?lang=fr-CA`)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ArrowUpRight size={12} />
                      {t("Ouvrir le menu interactif")}
                    </Action>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="social-pager">
            {experiences.map((x, i) => (
              <button
                key={x.id}
                className={socialBeat === i ? "selected" : ""}
                aria-current={socialBeat === i ? "true" : undefined}
                aria-label={
                  locale === "en" ? `View ${x.name}` : `Voir ${x.name}`
                }
                onClick={() => {
                  stateRef.current.cancelEntryAssist?.("social-pager-navigation");
                  const el = sectionRefs.current["social-content"];
                  window.scrollTo({
                    top:
                      el.getBoundingClientRect().top + scrollY +
                      (el.getBoundingClientRect().height - el.firstElementChild.getBoundingClientRect().height) *
                        SOCIAL_HOLD_CENTERS[i],
                    behavior: reduce ? "instant" : "smooth",
                  });
                }}
              />
            ))}
          </div>

        </Chapter>
        <Chapter
          id="product"
          height={CINEMATIC_TIMING.chapterHeightVh}
          chapterRef={ref("product")}
          className="product"
        >
          <span className="eyebrow stage-eyebrow">
            {t("Choisissez votre collection")}
          </span>
          <h2 id="product-title">VISTAIRE</h2>
          <div
            role="tablist"
            aria-label={t("Collections de supports")}
            className="collection-tabs"
          >
            {collections.map((x) => (
              <button
                key={x.id}
                role="tab"
                id={`tab-${x.id}`}
                aria-selected={collection === x.id}
                aria-controls="collection-panel"
                onClick={() => setCollection(x.id)}
                className={collection === x.id ? "selected" : ""}
                tabIndex={collection === x.id ? 0 : -1}
                onKeyDown={(e) => {
                  const index = collections.findIndex(
                    (c) => c.id === collection,
                  );
                  let next;
                  if (e.key === "ArrowRight") next = (index + 1) % 4;
                  else if (e.key === "ArrowLeft") next = (index + 3) % 4;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = 3;
                  if (next !== undefined) {
                    e.preventDefault();
                    setCollection(collections[next].id);
                    document
                      .getElementById("tab-" + collections[next].id)
                      ?.focus();
                  }
                }}
              >
                {x.name}
              </button>
            ))}
          </div>
          <FocusFrame
            className="support-gesture"
            role="slider"
            tabIndex={0}
            aria-label={
              locale === "en"
                ? `Rotate the ${selected.name} stand in 3D`
                : `Tourner le support ${selected.name} en 3D`
            }
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(((supportAngle % 360) + 360) % 360)}
            {...supportGestures}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                turnSupport(supportAngle + (e.key === "ArrowRight" ? 15 : -15));
              }
            }}
          />
          <div className="support-controls">
            <span>{t("Glissez le support pour le tourner")}</span>
            <button
              onClick={() => turnSupport(0)}
              aria-label={t("Recentrer le support")}
            >
              <RotateCw size={14} />
              {t("Recentrer")}
            </button>
          </div>
          <div
            role="tabpanel"
            id="collection-panel"
            aria-labelledby={`tab-${collection}`}
            className="collection-details"
          >
            <div>
              <span className="eyebrow">Collection {selected.name}</span>
              <p>{selected.description}</p>
              <p className="collection-usage">{selected.usage}</p>
            </div>
            <Action dark href={link("/tarifs-menu-digital-restaurant")}>
              {t("Composer votre expérience")}
              <ArrowUpRight size={14} />
            </Action>
          </div>

        </Chapter>
        <Chapter
          id="open-weight"
          height={130}
          chapterRef={ref("open-weight")}
          className="pricing"
        >
          <Pricing collection={collection} stateRef={stateRef} />
        </Chapter>
      </main>
      <Chapter
        as="footer"
        id="footer"
        height={110}
        chapterRef={ref("footer")}
        className="footer"
      >
        <h2 id="footer-title" className="sr-only">{t("Contact")}</h2>
        <PublicFooterNavigation locale={locale} />
        <div className="footer-grid">
          <div>
            <span className="eyebrow">{t("Un projet ?")}</span>
            <p className="footer-place">{locale === "en" ? "Montreal, Quebec, Canada" : "Montréal, Québec, Canada"}</p>
            <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
            <a href="tel:+15147152421">514-715-2421</a>
          </div>
          <div>
            <span className="eyebrow">{t("Une expérience à partager.")}</span>
            <button onClick={copy}>
              {copied ? t("Lien copié") : t("Copier le lien Vistaire")}
              {copied ? <Check size={15} /> : <ArrowUpRight size={15} />}
            </button>
            {getVistaireSocialProfiles().map((profile) => (
              <a href={profile.url} key={profile.url} target="_blank" rel="me noopener noreferrer">
                {profile.label}<ArrowUpRight size={15} />
              </a>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>{locale === "en" ? "© 2026 Vistaire. All rights reserved." : "© 2026 Vistaire. Tous droits réservés."}</span>
          <Link prefetch={false} href={`${link("/tarifs-menu-digital-restaurant")}#pricing-terms-title`}>
            {locale === "en" ? "Offer terms" : "Conditions de l’offre"}
          </Link>
        </div>
      </Chapter>
      <AdaptiveScrollGuide visible={guideVisible && ready && !menu && !modal && chapter !== "footer"} />
      <div className="chapter-progress" aria-hidden="true">
        <span
          style={{
            height: `${((chapters.findIndex((x) => x[0] === chapter) + 1) / chapters.length) * 100}%`,
          }}
        />
      </div>
      <div
        id="ar-overlay"
        className={`ar-overlay ${arStatus !== "idle" ? "is-active" : ""}`}
        inert={arStatus === "idle" ? true : undefined}
        aria-hidden={arStatus === "idle"}
      >
        <div className="ar-toolbar">
          <div role="status">
            <strong>{currentDish.label}</strong>
            <span>
              {arStatus === "placed"
                ? t("Votre plat est à table.")
                : arStatus === "requesting"
                  ? t("Ouverture de la caméra…")
                  : t(
                      "Bougez doucement pour repérer la table, puis touchez le cercle.",
                    )}
            </span>
          </div>
          <button
            aria-label={t("Fermer la réalité augmentée")}
            onClick={() => stateRef.current.endAR?.()}
          >
            <X />
          </button>
        </div>
        {arStatus === "placed" && (
          <div className="ar-controls">
            <label>
              {t("Taille du plat ·")} {Math.round(arScale * 100)} %
              <input
                aria-label={t("Taille du plat en réalité augmentée")}
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={arScale}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setARScale(value);
                  stateRef.current.scaleAR?.(value);
                }}
              />
            </label>
            <button onClick={() => stateRef.current.rotateAR?.()}>
              {t("Tourner")}
              <RotateCw size={16} />
            </button>
            <button onClick={() => stateRef.current.repositionAR?.()}>
              {t("Replacer")}
              <ScanLine size={16} />
            </button>
            <small>{t("La taille est indicative et peut être ajustée.")}</small>
          </div>
        )}
      </div>
      {modal && (
        <Modal
          label={modal.type === "share" ? t("Partagez l’expérience.") : t("Expérience Vistaire")}
          close={close}
        >
          {modal.type === "ar" && (
            <ARHelp
              item={dishes.find((x) => x.id === modal.id) || currentDish}
              error={modal.error}
            />
          )}
          {modal.type === "share" && (
            <div className="share-modal">
              <h2>{t("Partagez l’expérience.")}</h2>
              <label>
                {t("Adresse Vistaire")}
                <input
                  readOnly
                  value={site}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
