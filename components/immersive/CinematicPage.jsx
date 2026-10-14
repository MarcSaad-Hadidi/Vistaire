"use client";

// One cinematic page outside the landing: the landing's Scene, chapter joins
// and assisted scroll, driven by a short list of chapters. Each chapter names
// a Scene shot (see Scene.jsx baseComposition) and carries server-rendered copy;
// the page's free-reading content (guide, FAQ, footer) follows as children.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createEntryScrollAssist } from "./EntryScrollAssist.js";
import { bindJourneyViewport } from "./JourneyViewport.js";
import {
  CINEMATIC_TIMING,
  cinematicCopyWeights,
  measurePageTransitions,
  transitionAtScroll,
  transitionSceneFrame,
} from "./SceneDirector.js";
import "./styles.css";
import "./cinematic-page.css";

const Scene = lazy(() => import("./Scene.jsx"));
const clamp = (value) => Math.max(0, Math.min(1, value));

export function CinematicPage({ chapters, scene = {}, children, footer, mainProps }) {
  // Each page shows its own dish, stand and one restaurant's menu on every
  // phone shot (pagePhoneDemo, unlike the landing's demo picker).
  const { phoneDemo = "maison-elyse", ...objects } = scene;
  // Chapters may own the stand's collection, the phone's restaurant or the
  // laptop's lid (pricing, demo and restaurant preview pages).
  const needsLaptop = chapters.some((chapter) => chapter.laptopLid);
  const stateRef = useRef({
    section: chapters[0].shot,
    progress: 0,
    flip: false,
    collection: "acrylique",
    drag: 0.5,
    dish: "homard",
    pointer: { x: 0, y: 0 },
    sceneReady: false,
    ...objects,
    phoneDemo,
    pagePhoneDemo: phoneDemo,
    needsLaptop,
    preloadCollections: [...new Set(chapters.map((chapter) => chapter.scene?.collection).filter(Boolean))],
  });
  const sectionRefs = useRef([]);
  const naturalRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => {
    stateRef.current.sceneReady = true;
    setReady(true);
  }, []);
  const onError = useCallback(() => setFailed(true), []);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    const release = bindJourneyViewport();
    return () => { release(); root.style.scrollBehavior = previous; };
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    const base = { collection: state.collection, phoneDemo: state.pagePhoneDemo, laptop: state.needsLaptop };
    let measurements = [];
    let transitions = [];
    let frames = {};
    let stageHeight = innerHeight;
    let naturalTop = Infinity;
    let guideStop = null;
    let frame = 0;
    let stopped = false;
    const written = new WeakMap();
    const write = (element, name, value) => {
      const previous = written.get(element) ?? {};
      if (previous[name] === value) return;
      previous[name] = value;
      written.set(element, previous);
      element.style.setProperty(name, value);
    };
    const measure = () => {
      const first = sectionRefs.current[0];
      if (!first) return;
      stageHeight = first.firstElementChild.getBoundingClientRect().height || innerHeight;
      measurements = chapters.map((chapter, index) => {
        const el = sectionRefs.current[index];
        const stage = el.firstElementChild;
        const bounds = el.getBoundingClientRect();
        const stageBounds = stage.getBoundingClientRect();
        const focus = el.querySelector(".scene-focus")?.getBoundingClientRect();
        return {
          id: chapter.shot,
          el,
          top: bounds.top + scrollY,
          travel: Math.max(1, bounds.height - stageBounds.height),
          sceneFrame: focus
            ? {
                x: (focus.left + focus.width / 2) / innerWidth,
                y: (focus.top - stageBounds.top + focus.height / 2) / stageHeight,
                width: focus.width / innerWidth,
                height: focus.height / stageHeight,
              }
            : null,
        };
      });
      frames = Object.fromEntries(measurements.map((m) => [m.id, m.sceneFrame]));
      transitions = measurePageTransitions(measurements, stageHeight);
      naturalTop = naturalRef.current ? naturalRef.current.getBoundingClientRect().top + scrollY : Infinity;
      // The guide's head arrives just below the fixed navigation bar.
      const guide = naturalRef.current?.firstElementChild?.getBoundingClientRect();
      guideStop = guide ? guide.top + scrollY - 104 : null;
    };
    const update = (now) => {
      frame = 0;
      if (stopped || !measurements.length) return;
      const y = scrollY;
      let current = measurements[0];
      for (const m of measurements) {
        if (y >= m.top - 1) current = m;
        else break;
      }
      const transition = transitionAtScroll(transitions, y);
      // Chapter-owned objects change halfway through a join, while hidden.
      const ownerId = transition ? (transition.progress < 0.5 ? transition.from : transition.to) : current.id;
      const ownerIndex = Math.max(0, measurements.findIndex((m) => m.id === ownerId));
      const owner = chapters[ownerIndex];
      const ownerProgress = clamp((y - measurements[ownerIndex].top) / measurements[ownerIndex].travel);
      const lid = owner.laptopLid ?? [1, 1];
      measurements.forEach((m, index) => {
        const weights = (window) => window
          ? cinematicCopyWeights((y - window.start) / (window.end - window.start))
          : { incoming: 1, outgoing: 1 };
        const entrance = index === 0 ? 1 : weights(transitions.find((t) => t.to.id === m.id)).incoming;
        const alpha = entrance * weights(transitions.find((t) => t.from.id === m.id)).outgoing;
        write(m.el, "--copy-opacity", String(alpha));
        write(m.el, "--copy-shift", `${(1 - entrance) * 24}px`);
        // Pin only visible copy natively, as on the landing. The last chapter
        // stays sticky so the free-reading content scrolls in after it.
        write(m.el.firstElementChild, "position", alpha > 0 && index < measurements.length - 1 ? "fixed" : "sticky");
        if (m.el.inert !== alpha < 0.5) m.el.inert = alpha < 0.5;
      });
      Object.assign(state, {
        section: current.id,
        progress: clamp((y - current.top) / current.travel),
        transition,
        sceneFrames: frames,
        sceneFrame: transition ? transitionSceneFrame(transition, frames) : current.sceneFrame,
        scrollDistance: Math.max(0, (y - measurements[0].top) / stageHeight),
        pageScrollY: y,
        // Free reading covers the room: freeze the last pose behind it.
        sceneOccluded: y >= naturalTop,
        chapterProgress: {},
        collection: owner.scene?.collection ?? base.collection,
        pagePhoneDemo: owner.scene?.phoneDemo ?? base.phoneDemo,
        laptopLid: base.laptop ? lid[0] + (lid[1] - lid[0]) * ownerProgress : undefined,
      });
      if (state.renderSceneFrame && Number.isFinite(now)) state.renderSceneFrame(now);
      else state.invalidateScene?.();
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    const relayout = () => { measure(); queue(); };
    measure();
    update();
    const assist = createEntryScrollAssist({
      getGeometry: () => {
        return {
          opening: measurements.length ? { top: measurements[0].top, motionTravel: 0, stageHeight } : null,
          transitions,
          naturalFrom: guideStop,
        };
      },
      isBlocked: () => stopped || !state.sceneReady || state.reducedMotion,
    });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => { state.reducedMotion = reduced.matches; };
    motion();
    reduced.addEventListener("change", motion);
    addEventListener("scroll", queue, { passive: true });
    const observer = new ResizeObserver(relayout);
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    if (naturalRef.current) observer.observe(naturalRef.current);
    document.fonts?.ready.then(() => { if (!stopped) relayout(); });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      assist.dispose();
      observer.disconnect();
      removeEventListener("scroll", queue);
      reduced.removeEventListener("change", motion);
    };
  }, [chapters]);

  return (
    <div data-immersive-vistaire className={`cinematic-page${ready ? " is-ready" : ""}`}>
      <div className="world" aria-hidden="true">
        <Suspense fallback={null}>
          {!failed && <Scene stateRef={stateRef} onReady={onReady} onError={onError} />}
        </Suspense>
      </div>
      <main className="cinematic-main" {...mainProps}>
        {chapters.map((chapter, index) => (
          <section
            key={chapter.shot}
            id={chapter.id}
            ref={(el) => { sectionRefs.current[index] = el; }}
            className={`chapter cinematic-chapter align-${chapter.align ?? "left"}`}
            // The last chapter ends half a screen after its stop: no empty run
            // before the guide (one gesture reaches it).
            style={{ "--chapter-height": index === chapters.length - 1
              ? (1 + CINEMATIC_TIMING.edgeScreens + 0.5) * 100
              : CINEMATIC_TIMING.chapterHeightVh }}
            aria-labelledby={chapter.titleId}
          >
            <div className="stage">
              <div className="cinematic-copy">{chapter.content}</div>
              <div className="scene-focus" aria-hidden="true" />
            </div>
          </section>
        ))}
        <div ref={naturalRef} className="cinematic-natural">{children}</div>
      </main>
      {footer}
    </div>
  );
}
