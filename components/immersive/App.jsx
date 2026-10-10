"use client";

import Link from "next/link";
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
  Play,
  RotateCw,
  ScanLine,
  X,
} from "lucide-react";
import {
  chapters,
  collections as sourceCollections,
  dishes as sourceDishes,
  experiences as sourceExperiences,
  money as formatMoney,
  site,
} from "./content.js";
import Pricing from "./Pricing.jsx";
import { useModelGesture, useSupportGesture } from "./useModelGesture.js";
import { ARAction, ARHelp, DishDetailLink, isIOSDevice } from "./ARActions.jsx";
import { LandingLocaleProvider, useLandingLocale } from "./locale.jsx";
import { PublicControls } from "../vistaire-preview/PublicControls";
const Scene = lazy(() => import("./Scene.jsx"));
// Restaurant-specific menus keep their original production interface.
// Vistaire presentation pages are part of this same styled frontend.
// Distances use the frozen journey viewport, not elapsed time or scroll velocity.
// Keep the finished phone pose visible for another 1.5 viewports.
const OPENING_MOTION_VH = 480;
const OPENING_PHONE_HOLD_VH = 150;
const SOCIAL_TRANSITIONS = [[0.28, 0.36], [0.64, 0.72]];
const SOCIAL_HOLD_CENTERS = [0.14, 0.5, 0.86];
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
  return (
    <Element
      id={id}
      ref={chapterRef}
      className={`chapter ${className}`}
      style={{ "--chapter-height": height }}
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
      />
      <video
        ref={videoRef}
        className={decoded ? "has-decoded-frame" : ""}
        src={`/videos/demo/${id}.mp4`}
        poster={`/immersive-assets/phone-poster-${id}.webp`}
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
export function App({ locale = "fr" }) {
  return (
    <LandingLocaleProvider locale={locale}>
      <LandingContent />
    </LandingLocaleProvider>
  );
}

function LandingContent() {
  const { locale, languageTag, t, href: link, currency } = useLandingLocale();
  const money = (amount) => formatMoney(amount, languageTag);
  const collections = sourceCollections.map((item) => ({
    ...item,
    description: t(item.description),
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
  const [gpuError, setGpuError] = useState(false);
  const [modal, setModal] = useState(null);
  const [collection, setCollection] = useState("acrylique");
  const [tables, setTables] = useState(20);
  const [phoneDemo, setPhoneDemo] = useState("maison-elyse");
  const [supportAngles, setSupportAngles] = useState({
    acrylique: 0,
    sculpte: 0,
    carre: 0,
    signature: 0,
  });
  const [flip, setFlip] = useState(false);
  const [drag, setDrag] = useState(0.5);
  const [dishZoom, setDishZoom] = useState(1);
  const [dishPitch, setDishPitch] = useState(0);
  const dishGestures = useModelGesture({
    angle: drag,
    pitch: dishPitch,
    zoom: dishZoom,
    onAngle: setDrag,
    onPitch: setDishPitch,
    onZoom: setDishZoom,
  });
  const [dish, setDish] = useState(initialDish);
  const [arStatus, setARStatus] = useState("idle");
  const [arScale, setARScale] = useState(1);
  const [pilotage, setPilotage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [smallScreen, setSmallScreen] = useState(
    false,
  );
  const cinematicFormat = smallScreen ? "portrait" : "landscape";
  const cinematicSrc = `/immersive-media/cinematic-${cinematicFormat}.mp4?v=window-table-proportions-20261009-v12`;
  const cinematicPoster = `/immersive-assets/cinematic-${cinematicFormat}.webp?v=window-table-proportions-20261009-v12`;
  const [isAndroid, setIsAndroid] = useState(false);
  const [arSupported, setARSupported] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsAndroid(/Android/i.test(navigator.userAgent));
      setARSupported(isIOSDevice() || document.createElement("a").relList.supports?.("ar") || false);
      const requested = new URLSearchParams(location.search).get("dish");
      if (sourceDishes.some(item => item.id === requested)) setDish(requested);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const [modelError, setModelError] = useState(null);
  const [modelLoading, setModelLoading] = useState(null);
  const [retryModel, setRetryModel] = useState(0);
  const menuRef = useRef(null);
  const headerRef = useRef(null);
  const supportAngle = supportAngles[collection];
  const turnSupport = (angle) =>
    setSupportAngles((angles) => ({ ...angles, [collection]: angle }));
  const supportGestures = useSupportGesture({
    angle: (((supportAngle % 360) + 360) % 360) / 360,
    pitch: 0,
    zoom: 1,
    zoomEnabled: false,
    onAngle: (angle) => turnSupport(angle * 360),
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
    const query = matchMedia("(max-width:767.98px)");
    const update = () => setSmallScreen(query.matches);
    const frame = requestAnimationFrame(update);
    query.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      query.removeEventListener("change", update);
    };
  }, []);
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
    let lastSection = "";
    let lastChapterBeats = {};
    let measurements = [];
    let opening = null;
    let stopped = false;
    let needsMeasure = false;
    let activeTouches = 0;
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
      const journey = openingRef.current;
      const top = journey.getBoundingClientRect().top + scrollY;
      const travel =
        journey.offsetHeight - journey.firstElementChild.clientHeight;
      const stageHeight = journey.firstElementChild.clientHeight;
      const motionTravel = Math.max(
        1,
        travel - (stageHeight * OPENING_PHONE_HOLD_VH) / 100,
      );
      const sceneHeight = document.querySelector(".world").clientHeight;
      opening = {
        top,
        travel,
        motionTravel,
        height: journey.offsetHeight,
        sceneHeight,
      };
      measurements = chapters
        .map(([id]) => {
          const el = sectionRefs.current[id];
          if (!el) return null;
          const stage = el.firstElementChild,
            focus = el.querySelector(".scene-focus");
          let sceneFrame = null;
          if (focus) {
            const r = focus.getBoundingClientRect(),
              sr = stage.getBoundingClientRect();
            sceneFrame = {
              x: (r.left + r.width / 2) / innerWidth,
              y: (r.top - sr.top + r.height / 2) / sceneHeight,
              width: r.width / innerWidth,
              height: r.height / sceneHeight,
            };
          }
          const openingAnchor = { hero: 0, ai: 0.48, wearable: 0.94 }[id];
          const sectionTop =
            openingAnchor == null
              ? el.getBoundingClientRect().top + scrollY
              : top + motionTravel * openingAnchor;
          scrollTargets.current[id] = sectionTop;
          return {
            id,
            top: sectionTop,
            travel: Math.max(
              1,
              el.offsetHeight -
                (id === "open-weight" ? sceneHeight : stage.clientHeight),
            ),
            sceneFrame,
          };
        })
        .filter(Boolean);
    };
    const update = () => {
      ticking = false;
      if (stopped || !openingRef.current) return;
      if (needsMeasure) {
        needsMeasure = false;
        measure();
      }
      const y = scrollY;
      // Once native scrolling or an interactive control is understood, leave
      // the visitor alone. No chapter resets, idle timers or extra listeners.
      const discoveryDistance = Math.max(64, Math.min(120, opening.sceneHeight * 0.1));
      if (Math.abs(y - arrivalY) >= discoveryDistance) guideDismissed.current = true;
      const showGuide = !guideDismissed.current && y < opening.top + opening.motionTravel * 0.14;
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
          ? clamp((y - opening.top) / opening.motionTravel)
          : null;
      const openingPosition = clamp((y - opening.top) / opening.motionTravel);
      const fade = (start, end) => {
        const t = clamp((openingPosition - start) / (end - start));
        return t * t * (3 - 2 * t);
      };
      const openingOpacities = [
        1 - fade(0.14, 0.3),
        fade(0.3, 0.42) * (1 - fade(0.66, 0.8)),
        fade(0.8, 0.92),
      ];
      // Flush the final state even if this contact left the opening entirely.
      // Native scrolling cancels PointerEvents before physical touch end.
      if (!activeTouches)
        ["hero", "ai", "wearable"].forEach((id, i) => {
          const panel = sectionRefs.current[id];
          const inert = openingOpacities[i] < 0.5;
          const hidden = String(openingOpacities[i] < 0.01);
          if (panel.inert !== inert) panel.inert = inert;
          if (panel.getAttribute("aria-hidden") !== hidden)
            panel.setAttribute("aria-hidden", hidden);
        });
      let transition = null;
      let sceneFrame = current.sceneFrame;
      if (openingProgress != null) {
        const p = openingProgress;
        current = measurements.find(
          (m) => m.id === (p < 0.3 ? "hero" : p < 0.8 ? "ai" : "wearable"),
        );
        const from = measurements[p < 0.56 ? 0 : 1].sceneFrame;
        const to = measurements[p < 0.56 ? 1 : 2].sceneFrame;
        const t = clamp((p - (p < 0.56 ? 0 : 0.56)) / (p < 0.56 ? 0.56 : 0.44));
        const eased = t * t * (3 - 2 * t);
        sceneFrame = Object.fromEntries(
          Object.keys(from).map((key) => [
            key,
            from[key] + (to[key] - from[key]) * eased,
          ]),
        );

        ["hero", "ai", "wearable"].forEach((id, i) => {
          const panel = sectionRefs.current[id];
          writeVisualProperty(panel, "--opening-opacity", openingOpacities[i]);
          writeVisualProperty(
            panel,
            "--opening-shift",
            `${(1 - openingOpacities[i]) * (i === 0 ? -28 : 28)}px`,
          );
        });
      }
      // The sticky exit is a full viewport of choreography: the next scene
      // is already being prepared before its chapter becomes active.
      const fromOpening = openingProgress != null;
      const from = fromOpening ? measurements[2] : current;
      const next = measurements[measurements.indexOf(from) + 1];
      const exitStart = fromOpening
        ? opening.top + opening.travel
        : from.top + from.travel;
      if (next && y >= exitStart) {
        const t = clamp((y - exitStart) / Math.max(1, next.top - exitStart));
        const eased = t * t * (3 - 2 * t);
        transition = {
          from: from.id,
          to: next.id,
          fromProgress: fromOpening ? 0 : 1,
          toProgress: 0,
          fromOpening,
          progress: t,
        };
        const a = sceneFrame || next.sceneFrame;
        const b = next.sceneFrame || a;
        if (a && b)
          sceneFrame = Object.fromEntries(
            Object.keys(a).map((key) => [
              key,
              a[key] + (b[key] - a[key]) * eased,
            ]),
          );
      }
      // Text follows the native page; fading its exit prevents a moving model
      // from passing over the previous copy. No wheel/touch position rewriting.
      for (const m of measurements.slice(3)) {
        if (m.id === "open-weight") continue;
        const el = sectionRefs.current[m.id];
        const entrance =
          y < m.top ? clamp(1 - (m.top - y) / opening.sceneHeight) : 1;
        const exit =
          m.id === "footer"
            ? 0
            : clamp((y - m.top - m.travel) / opening.sceneHeight);
        const alpha = entrance * (1 - exit * exit * (3 - 2 * exit));
        writeVisualProperty(el, "--copy-opacity", alpha);
        writeVisualProperty(el, "--copy-shift", `${(1 - entrance) * 24}px`);
      }
      const progress =
        openingProgress == null
          ? clamp((y - current.top) / current.travel)
          : openingProgress;
      stateRef.current.section = current.id;
      const pricing = measurements.find((m) => m.id === "open-weight");
      stateRef.current.sceneOccluded =
        y >= pricing.top && y <= pricing.top + pricing.travel;
      stateRef.current.scrollDistance = Math.max(
        0,
        (y - opening.top) / opening.sceneHeight,
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
      stateRef.current.sceneFrames = Object.fromEntries(
        measurements.map((m) => [m.id, m.sceneFrame]),
      );
      stateRef.current.transition = transition;
      const socialProgress = stateRef.current.chapterProgress["social-content"];
      const socialPosition = SOCIAL_TRANSITIONS.reduce((position, [start, end]) => {
        const phase = clamp((socialProgress - start) / (end - start));
        return position + phase * phase * (3 - 2 * phase);
      }, 0);
      const socialIndex = Math.min(2, Math.round(socialPosition));
      writeVisualProperty(
        sectionRefs.current["social-content"],
        "--rail-progress",
        stateRef.current.reducedMotion ? socialIndex : socialPosition,
      );
      const preparedBeats = {
        features: Math.min(2, Math.floor(stateRef.current.chapterProgress.features * 3)),
        "social-content": socialIndex,
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
    };
    const queue = () => {
      if (!ticking && !stopped) {
        ticking = true;
        queuedFrame = requestAnimationFrame(update);
      }
    };
    const layoutChanged = () => {
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
    // Overlayed opening panels share one DOM position; their deep links need
    // the same measured scroll destination as the navigation controls.
    const initialAnchor = location.hash.slice(1);
    if (Object.hasOwn(scrollTargets.current, initialAnchor))
      scrollTo({
        top: scrollTargets.current[initialAnchor],
        behavior: "instant",
      });
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
    update();
    addEventListener("scroll", queue, { passive: true });
    // ResizeObserver tracks real stage/focus sizes, without measuring the
    // whole page again for toolbar-only resize notifications.
    addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("touchstart", contactChanged, { passive: true });
    document.addEventListener("touchend", contactChanged, { passive: true });
    document.addEventListener("touchcancel", contactChanged, { passive: true });
    return () => {
      removeEventListener("scroll", queue);
      stopped = true;
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
      dishPitch,
      dish,
      reducedMotion: reduce,
      modalOpen: Boolean(modal),
      menuOpen: menu,
      retryModel,
    });
  }, [
    collection,
    phoneDemo,
    supportAngle,
    flip,
    drag,
    dishZoom,
    dishPitch,
    dish,
    reduce,
    modal,
    menu,
    retryModel,
  ]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const buttons = () => [
      ...headerRef.current.querySelectorAll("button,a[href]"),
      ...menuRef.current.querySelectorAll("button,a[href]"),
    ].filter((control) => control.getClientRects().length > 0);
    menuRef.current.querySelector("button,a[href]")?.focus();
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
      const play =
        when === chapter ||
        (when === `social-content-${beat}` && chapter === "social-content");
      if ((play || when === "fallback") && !reduce && !modal && !menu) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, [chapter, beat, reduce, modal, menu, gpuError, cinematicFormat]);
  const goto = useCallback(
    (id) => {
      setMenu(false);
      scrollTo({
        top: scrollTargets.current[id] || 0,
        behavior: reduce ? "instant" : "smooth",
      });
      history.replaceState(null, "", `#${id}`);
    },
    [reduce],
  );
  const observe = useCallback(
    (id) => {
      setDish(id);
      setModal(null);
      goto("grip");
    },
    [goto],
  );
  const amount = selected.price;
  const currentDish = dishes.find((x) => x.id === dish);
  const modalDish = dishes.find((item) => item.id === modal?.id);
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
    } else setModal({ type: "ar", id: item.id });
  };
  const onSceneError = useCallback(() => {
    setGpuError(true);
    setModelLoading(null);
    setModelError(null);
    setReady(true);
  }, []);
  const onSceneReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!ready || !new URLSearchParams(location.search).has("dish")) return;
    sectionRefs.current.grip?.scrollIntoView({ behavior: "instant" });
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
      <div
        className={`world ${gpuError ? "world-fallback" : ""}`}
        aria-hidden="true"
      >
        <Suspense fallback={null}>
          {!gpuError && (
            <Scene
              stateRef={stateRef}
              onReady={onSceneReady}
              onError={onSceneError}
              onAssetError={setModelError}
              onAssetLoading={setModelLoading}
              onARStatus={setARStatus}
            />
          )}
        </Suspense>
        {gpuError && (
          <>
            <video
              className="fallback-film"
              src={cinematicSrc}
              poster={cinematicPoster}
              data-play-when="fallback"
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="fallback-shade" />
          </>
        )}
      </div>
      {!ready && (
        <div className="preloader" role="status">
          <div className="loading-word">Vistaire</div>
          <div className="loading-line" />
          <span>{t("Préparons votre table.")}</span>
        </div>
      )}
      <header ref={headerRef} className={`site-header ${chapter === "hero" ? "at-hero" : ""}`}
        onPointerDownCapture={dismissGuideOnInteraction} onFocusCapture={dismissGuideOnInteraction}>
        <button
          className="brand"
          onClick={() => goto("hero")}
          aria-label={t("Vistaire — retour à l’introduction")}
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
                <button
                  className="text-link"
                  onClick={() => setModal({ type: "menu" })}
                >
                  {t("Explorer la carte")}
                  <ArrowUpRight size={17} />
                </button>
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
                <br />
                {t("juste un")}
                <br />
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
                <Action onClick={() => setModal({ type: "menu" })}>
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
                  <br />
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

            </Chapter>
          </div>
        </div>
        <Chapter
          id="features"
          height={400}
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
            <span className="eyebrow">
              {
                [
                  t("Une carte claire"),
                  t("Des plats qui se racontent"),
                  t("Le bon choix, simplement"),
                ][featureBeat]
              }
            </span>
            <h3>
              {
                [
                  t("De l’envie à la première bouchée."),
                  t("Vos signatures, sous tous les angles."),
                  t("Les bonnes informations. Au bon endroit."),
                ][featureBeat]
              }
            </h3>
            <p>
              {
                [
                  t(
                    "Des catégories lisibles, une navigation intuitive et une expérience rapide. Le menu s’ouvre dans le navigateur du client.",
                  ),
                  t(
                    "La 3D apporte un vrai plus aux plats qui le méritent. Explorez leur présentation avant de les découvrir à table.",
                  ),
                  t(
                    "Prix, descriptions, langues et allergènes : votre carte aide chacun à choisir avec confiance.",
                  ),
                ][featureBeat]
              }
            </p>
            <Action
              onClick={() =>
                featureBeat === 1 ? goto("grip") : setModal({ type: "menu" })
              }
            >
              {featureBeat === 1
                ? t("Manipuler le plat")
                : t("Découvrir la carte")}
              <ArrowUpRight size={15} />
            </Action>
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
          height={300}
          chapterRef={ref("encryption")}
          className="identity"
        >
          <Heading>
            <span className="eyebrow">
              {t("Votre restaurant. Votre signature.")}
            </span>
            <h2 id="encryption-title">
              {t("La signature")}
              <br />
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
          height={300}
          chapterRef={ref("grip")}
          className="grip"
        >
          <Heading>
            <span className="eyebrow">{t("Voir avant de savourer")}</span>
            <h2 id="grip-title">
              {t("Chaque angle.")}
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
                  className={dish === x.id ? "selected" : ""}
                  aria-pressed={dish === x.id}
                  onClick={() => {
                    setDish(x.id);
                    setDishZoom(1);
                    setDishPitch(0);
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
                  setDishZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))
                }
              >
                −
              </button>
              <output aria-live="polite">{Math.round(dishZoom * 100)} %</output>
              <button
                aria-label={t("Zoomer le plat")}
                disabled={dishZoom >= 4}
                onClick={() =>
                  setDishZoom((z) => Math.min(4, +(z + 0.2).toFixed(1)))
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
                  setDishPitch(0);
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
          height={300}
          chapterRef={ref("sustainability")}
          className="living"
        >
          <div className="living-copy">
            <span className="eyebrow">
              {t("Votre Dashboard restaurateur.")}
            </span>
            <h2 id="sustainability-title" className="living-title">
              {t("Toujours")}
              <br />
              <em>{t("vivante.")}</em>
            </h2>
            <div className="living-description">
              <p>
                {t("Changez un prix. Ajoutez un plat.")}
                <br />
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
          height={400}
          chapterRef={ref("testimonies")}
          className="identities"
        >
          <h2 id="testimonies-title">
            {t("Trois expériences.")}
            <br />
            {t("Trois identités.")}
          </h2>
          <p className="identity-intro">
            {t("Votre restaurant a son propre univers.")}
            <br />
            {t("Votre carte doit le prolonger.")}
          </p>
          <div className="experience-list">
            {experiences.map((x, i) => (
              <button
                key={x.id}
                onClick={() => setModal({ type: "video", id: x.id })}
              >
                <span className="index">0{i + 1}</span>
                <div>
                  <span className="eyebrow">{x.tag}</span>
                  <h3>{x.name}</h3>
                  <p>{x.description}</p>
                </div>
                <img
                  src={`/immersive-assets/${x.image}.webp`}
                  alt={
                    locale === "en"
                      ? `${x.name} atmosphere`
                      : `Ambiance ${x.name}`
                  }
                  loading="lazy"
                />
                <ArrowUpRight />
              </button>
            ))}
          </div>

        </Chapter>
        <Chapter
          id="social-content"
          height={640}
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
                  src={`/immersive-assets/ambience-${x.id}.webp`}
                  alt={
                    locale === "en"
                      ? `${x.name} atmosphere`
                      : `Ambiance ${x.name}`
                  }
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
                      onClick={() => setModal({ type: "video", id: x.id })}
                    >
                      <Play size={12} />
                      {t("Explorer")}
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
                  const el = sectionRefs.current["social-content"];
                  window.scrollTo({
                    top:
                      el.getBoundingClientRect().top + scrollY +
                      (el.offsetHeight - el.firstElementChild.clientHeight) *
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
          height={420}
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
              <span className="price">
                {t("Dès")} {money(selected.price)} <small>CAD</small>
              </span>
              <span className="monthly">{t("Puis 200 CAD / mois")}</span>
            </div>
            <Action dark onClick={() => setModal({ type: "collection" })}>
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
          <Pricing
            collection={collection}
            setCollection={setCollection}
            onEstimate={(estimate) => {
              setPilotage(estimate.pilotage);
              setModal({ type: "collection" });
            }}
          />
        </Chapter>
      </main>
      <Chapter
        as="footer"
        id="footer"
        height={110}
        chapterRef={ref("footer")}
        className="footer"
      >
        <div className="footer-main">
          <span className="eyebrow">
            {t("La prochaine expérience commence ici.")}
          </span>
          <h2 id="footer-title">
            {t("À la hauteur")}
            <br />
            {t("de votre")}
            <br /> <em>{t("restaurant.")}</em>
          </h2>
          <Action href={link("/prendre-rendez-vous")}>
            {t("Prendre rendez-vous")}
            <ArrowUpRight size={15} />
          </Action>
        </div>
        <FocusFrame className="footer-scene" aria-hidden="true" />
        <div className="footer-grid">
          <div>
            <span className="eyebrow">{t("Un projet ?")}</span>
            <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
            <a href="tel:+15147152421">514-715-2421</a>
          </div>
          <div>
            <span className="eyebrow">{t("Une expérience à partager.")}</span>
            <button onClick={copy}>
              {copied ? t("Lien copié") : t("Copier le lien Vistaire")}
              {copied ? <Check size={15} /> : <ArrowUpRight size={15} />}
            </button>
            <a href={link("/demo")}>
              {t("Voir les cartes Vistaire")}
              <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
        <nav className="footer-bottom" aria-label={t("Les pages Vistaire")}>
          <span>© 2026 Vistaire</span>
          <Link prefetch={false} href={link("/menu-digital-restaurant")}>{t("Découvrir Vistaire")}</Link>
          <Link prefetch={false} href={link("/guides/anatomie-menu-digital-premium")}>Guides</Link>
          <Link prefetch={false} href={link("/a-propos")}>{t("À propos")}</Link>
        </nav>
      </Chapter>
      <AdaptiveScrollGuide visible={guideVisible && ready && !menu && !modal && chapter !== "footer"} />
      <div className="chapter-progress" aria-hidden="true">
        <span
          style={{
            height: `${((chapters.findIndex((x) => x[0] === chapter) + 1) / chapters.length) * 100}%`,
          }}
        />
      </div>
      {gpuError && (
        <span className="gpu-status">
          {t("Version vidéo · 3D disponible sur navigateur compatible")}
        </span>
      )}
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
          label={
            modal.type === "menu"
              ? t("Carte de démonstration Vistaire")
              : modal.type === "dish"
                ? t("Fiche du plat")
                : modal.type === "collection"
                  ? t("Composer votre expérience Vistaire")
                  : t("Expérience Vistaire")
          }
          close={close}
        >
          {modal.type === "menu" && (
            <>
              <div className="menu-preview-head">
                <span className="eyebrow">{t("Menu de démonstration")}</span>
                <h2>{t("La sélection Vistaire")}</h2>
                <p>{t("La carte")}</p>
              </div>
              <div className="menu-preview-dishes">
                {dishes.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setModal({ type: "dish", id: x.id })}
                  >
                    <img src={`/immersive-assets/${x.image}.webp`} alt={x.fullName} />
                    <div>
                      <span className="eyebrow">{x.category}</span>
                      <h3>{x.fullName}</h3>
                      <p>{x.description}</p>
                      {x.price !== null && (
                        <span>{x.price.toLocaleString(languageTag)} CAD</span>
                      )}
                      {x.model && <small>{t("Disponible en 3D")}</small>}
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </div>
              <a
                className="menu-preview-complete"
                href={link("/menu/maison-elyse?lang=fr-CA")}
                target="_blank"
                rel="noreferrer"
              >
                {t("Ouvrir la carte complète")}
                <ArrowUpRight size={16} />
              </a>
            </>
          )}
          {modal.type === "dish" && modalDish && (
            <div className="dish-detail">
              <img
                src={`/immersive-assets/${modalDish.image}.webp`}
                alt={modalDish.fullName}
              />
              <div>
                <span className="eyebrow">
                  {modalDish.restaurant || "Vistaire"} {t("· Démonstration")}
                </span>
                <h2>{modalDish.fullName}</h2>
                <p>{modalDish.description}</p>
                {modalDish.price !== null && (
                  <strong>
                    {modalDish.price.toLocaleString(languageTag)} CAD
                  </strong>
                )}
                {modalDish.allergens && (
                  <div className="allergens">
                    <span>{t("Allergènes")}</span>
                    <p>{modalDish.allergens}</p>
                    <small>
                      {t(
                        "Les informations présentées appartiennent au menu de démonstration.",
                      )}
                    </small>
                  </div>
                )}
                {modalDish.model && (
                  <Action dark onClick={() => observe(modalDish.id)}>
                    {t("Explorer en 3D")}
                    <RotateCw size={16} />
                  </Action>
                )}
                {modalDish.model && (modalDish.id === dish || arSupported) && (
                  <ARAction
                    item={modalDish}
                    ios={arSupported}
                    disabled={
                      isAndroid &&
                      !gpuError &&
                      Boolean(modelLoading || modelError)
                    }
                    onLaunch={() => launchAR(modalDish)}
                  />
                )}
              </div>
            </div>
          )}
          {modal.type === "video" && (
            <div className="film-modal">
              <span className="eyebrow">
                {t("L’expérience Vistaire ·")}{" "}
                {modal.id === "cinematic"
                  ? t("Une autre dimension à table")
                  : experiences.find((x) => x.id === modal.id)?.name}
              </span>
              <video
                src={
                  modal.id === "cinematic"
                    ? cinematicSrc
                    : `/videos/demo/${modal.id}.mp4`
                }
                autoPlay
                muted
                playsInline
                controls
                data-demo="true"
                onLoadedMetadata={(e) => {
                  e.currentTarget.playbackRate = 2;
                }}
              />
              <a
                href={link(
                  `/menu/${modal.id === "cinematic" ? "maison-elyse" : modal.id}?lang=fr-CA`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                {t("Ouvrir le menu interactif")}
                <ArrowUpRight size={15} />
              </a>
            </div>
          )}
          {modal.type === "collection" && (
            <div className="estimate">
              <span className="eyebrow">{t("Votre expérience Vistaire")}</span>
              <h2>
                {t("Une collection.")}
                <br />
                {t("Votre signature.")}
              </h2>
              <div className="estimate-body">
                <img
                  src={`/immersive-assets/${selected.image}.webp`}
                  alt={selected.name}
                />
                <div>
                  <label>
                    {t("Votre collection")}
                    <select
                      value={collection}
                      onChange={(e) => setCollection(e.target.value)}
                    >
                      {collections.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Nombre de supports")}
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={tables}
                      onChange={(e) => setTables(e.target.value)}
                    />
                  </label>
                  <label className="estimate-pilotage">
                    <input
                      type="checkbox"
                      checked={pilotage}
                      onChange={(e) => setPilotage(e.target.checked)}
                    />{" "}
                    {t("Ajouter Pilotage · +100 CAD / mois")}
                  </label>
                  <div className="estimate-price">
                    <small>{t("Mise en place · à partir de · CAD")}</small>
                    <strong>{currency(amount)}</strong>
                    <span>
                      + {pilotage ? 300 : 200} {t("CAD / mois")}
                    </span>
                  </div>
                  {Number(tables) > 20 && (
                    <p className="estimate-extra">
                      {t("Les")} {Math.floor(Number(tables)) - 20}{" "}
                      {t(
                        "supports supplémentaires sont sur devis et ne sont pas compris dans ce montant.",
                      )}
                    </p>
                  )}
                  <p>
                    {t(
                      "Jusqu’à 20 supports et 5 plats 3D inclus. Taxes en sus. Engagement initial de 12 mois.",
                    )}
                  </p>
                  <Action dark href={link("/prendre-rendez-vous")}>
                    {t("Prendre rendez-vous")}
                    <ArrowUpRight size={15} />
                  </Action>
                  <a href={link("/tarifs-menu-digital-restaurant")}>
                    {t("Détails et conditions de l’offre")}
                  </a>
                </div>
              </div>
            </div>
          )}
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
