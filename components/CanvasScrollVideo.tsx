"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DynamicVideoText } from "@/components/DynamicVideoText";
import { frameConfig } from "@/lib/frameConfig";
import { getActiveChapter, videoChapters } from "@/lib/videoChapters";

const PRIMARY_VIDEO_SRC = "/videos/upscaled-video.mp4";
const LEGACY_VIDEO_FALLBACK_SRC = "/videos/menualive-full.mp4";
const INITIAL_FRAME_BATCH = 12;
const NEARBY_PRELOAD_RADIUS = 12;
const PRELOAD_FRAME_STEP = 8;
const BACKGROUND_FRAME_BATCH = 3;
const BACKGROUND_PRELOAD_LIMIT = 84;
const MAX_CACHED_FRAMES = 56;
const PROGRESS_EASE = 0.22;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const FRAME_SAFE_CROP_SCALE = 1.075;
const TRANSITION_SOFTNESS = 0.025;
const NEAREST_FRAME_FALLBACK_RADIUS = 2;
const ENABLE_SCROLL_DEBUG = process.env.NODE_ENV !== "production";

type IdleCapableWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

type ScrollDebugState = {
  progress: number;
  targetProgress: number;
  displayedProgress: number;
  frameIndex: number;
  activeChapter: string;
  loadedFrames: number;
  frameCount: number;
};

declare global {
  interface Window {
    __MENUALIVE_SCROLL_DEBUG__?: ScrollDebugState;
  }
}

type LoadState = "loading" | "canvas" | "fallback";

export function CanvasScrollVideo() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transitionVeilRef = useRef<HTMLDivElement>(null);
  const canvasMetricsRef = useRef({ width: 0, height: 0, dpr: 1 });
  const imagesRef = useRef<Array<HTMLImageElement | null>>(
    Array.from({ length: frameConfig.frameCount }, () => null)
  );
  const imageRequestsRef = useRef<Map<number, Promise<HTMLImageElement>>>(
    new Map()
  );
  const cachedFrameOrderRef = useRef<number[]>([]);
  const targetProgressRef = useRef(0);
  const displayedProgressRef = useRef(0);
  const previousTargetProgressRef = useRef(0);
  const currentChapterRef = useRef(videoChapters[0].id);
  const currentFrameRef = useRef(-1);
  const lastPreloadFrameRef = useRef(-1);
  const lastPreloadDirectionRef = useRef(1);
  const backgroundPreloadCursorRef = useRef(INITIAL_FRAME_BATCH);
  const rafRef = useRef<number | null>(null);
  const backgroundPreloadRef = useRef<{
    id: number;
    type: "idle" | "timeout";
  } | null>(null);
  const mountedRef = useRef(false);
  const [activeChapter, setActiveChapter] = useState(videoChapters[0]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const context = canvas?.getContext("2d", {
      alpha: false,
      desynchronized: true
    });

    if (!canvas || !section || !context) {
      const frame = window.requestAnimationFrame(() => {
        setLoadState("fallback");
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    let cancelled = false;
    let removeResizeListener = () => {};
    let killScrollTrigger = () => {};

    imagesRef.current = Array.from({ length: frameConfig.frameCount }, () => null);
    imageRequestsRef.current.clear();
    cachedFrameOrderRef.current = [];
    backgroundPreloadCursorRef.current = INITIAL_FRAME_BATCH;
    lastPreloadFrameRef.current = -1;
    lastPreloadDirectionRef.current = 1;

    const configureContext = () => {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    };

    const clampFrameIndex = (index: number) =>
      Math.min(frameConfig.frameCount - 1, Math.max(0, index));

    const rememberLoadedFrame = (index: number) => {
      cachedFrameOrderRef.current = cachedFrameOrderRef.current.filter(
        (cachedIndex) => cachedIndex !== index
      );
      cachedFrameOrderRef.current.push(index);
    };

    const pruneFrameCache = (centerIndex: number) => {
      const keepStart = Math.max(0, centerIndex - NEARBY_PRELOAD_RADIUS * 2);
      const keepEnd = Math.min(
        frameConfig.frameCount - 1,
        centerIndex + NEARBY_PRELOAD_RADIUS * 2
      );
      const cacheOrder = cachedFrameOrderRef.current;

      while (cacheOrder.length > MAX_CACHED_FRAMES) {
        const distantIndex = cacheOrder.findIndex(
          (cachedIndex) => cachedIndex < keepStart || cachedIndex > keepEnd
        );
        const removableIndex =
          distantIndex >= 0
            ? distantIndex
            : cacheOrder.findIndex((cachedIndex) => cachedIndex !== centerIndex);

        if (removableIndex < 0) {
          return;
        }

        const [removedFrameIndex] = cacheOrder.splice(removableIndex, 1);
        imagesRef.current[removedFrameIndex] = null;
      }
    };

    const updateActiveChapter = (progress: number) => {
      const nextChapter = getActiveChapter(progress);

      if (nextChapter.id !== currentChapterRef.current) {
        currentChapterRef.current = nextChapter.id;
        setActiveChapter(nextChapter);
      }
    };

    const loadFrame = (index: number, priority: "high" | "low" = "low") => {
      const safeIndex = clampFrameIndex(index);
      const existingImage = imagesRef.current[safeIndex];

      if (existingImage) {
        rememberLoadedFrame(safeIndex);
        return Promise.resolve(existingImage);
      }

      const existingRequest = imageRequestsRef.current.get(safeIndex);

      if (existingRequest) {
        return existingRequest;
      }

      const request = new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();

        image.decoding = "async";
        image.loading = "eager";
        image.fetchPriority = priority;
        image.onload = async () => {
          try {
            await image.decode();
          } catch {
            // Some browsers report decode issues after a successful load.
          }

          imagesRef.current[safeIndex] = image;
          imageRequestsRef.current.delete(safeIndex);
          rememberLoadedFrame(safeIndex);
          pruneFrameCache(
            currentFrameRef.current >= 0 ? currentFrameRef.current : safeIndex
          );
          resolve(image);
        };
        image.onerror = () => {
          imageRequestsRef.current.delete(safeIndex);
          reject(new Error(`Unable to load frame ${safeIndex + 1}`));
        };
        image.src = frameConfig.framePath(safeIndex);
      });

      imageRequestsRef.current.set(safeIndex, request);
      return request;
    };

    const findNearestLoadedFrame = (
      index: number,
      maxOffset = NEAREST_FRAME_FALLBACK_RADIUS
    ) => {
      const images = imagesRef.current;
      const safeIndex = clampFrameIndex(index);

      if (images[safeIndex]) {
        rememberLoadedFrame(safeIndex);
        return images[safeIndex];
      }

      for (let offset = 1; offset <= maxOffset; offset += 1) {
        const previous = safeIndex - offset;
        const next = safeIndex + offset;

        if (previous >= 0 && images[previous]) {
          rememberLoadedFrame(previous);
          return images[previous];
        }

        if (next < frameConfig.frameCount && images[next]) {
          rememberLoadedFrame(next);
          return images[next];
        }
      }

      return null;
    };

    const preloadNearbyFrames = (index: number, direction = 1) => {
      const safeIndex = clampFrameIndex(index);
      const preferredDirection = direction >= 0 ? 1 : -1;

      for (let offset = 1; offset <= NEARBY_PRELOAD_RADIUS; offset += 1) {
        const next = safeIndex + offset * preferredDirection;
        const previous = safeIndex - offset * preferredDirection;

        if (next >= 0 && next < frameConfig.frameCount) {
          loadFrame(next, offset <= 4 ? "high" : "low").catch(() => undefined);
        }

        if (previous >= 0 && previous < frameConfig.frameCount) {
          loadFrame(previous, offset <= 3 ? "high" : "low").catch(() => undefined);
        }
      }
    };

    const preloadNearbyFramesOnce = (index: number, direction: number) => {
      const safeIndex = clampFrameIndex(index);
      const preferredDirection = direction >= 0 ? 1 : -1;

      if (
        Math.abs(safeIndex - lastPreloadFrameRef.current) < PRELOAD_FRAME_STEP &&
        preferredDirection === lastPreloadDirectionRef.current
      ) {
        return;
      }

      lastPreloadFrameRef.current = safeIndex;
      lastPreloadDirectionRef.current = preferredDirection;
      preloadNearbyFrames(safeIndex, preferredDirection);
    };

    const scheduleBackgroundPreload = () => {
      if (backgroundPreloadRef.current !== null || cancelled) {
        return;
      }

      const loadBackgroundBatch = () => {
        backgroundPreloadRef.current = null;

        if (cancelled) {
          return;
        }

        const start = backgroundPreloadCursorRef.current;
        const end = Math.min(
          frameConfig.frameCount,
          BACKGROUND_PRELOAD_LIMIT,
          start + BACKGROUND_FRAME_BATCH
        );

        for (let index = start; index < end; index += 1) {
          loadFrame(index).catch(() => undefined);
        }

        backgroundPreloadCursorRef.current = end;

        if (end < Math.min(frameConfig.frameCount, BACKGROUND_PRELOAD_LIMIT)) {
          scheduleBackgroundPreload();
        }
      };

      const idleWindow = window as IdleCapableWindow;

      if (typeof idleWindow.requestIdleCallback === "function") {
        backgroundPreloadRef.current = {
          id: idleWindow.requestIdleCallback(loadBackgroundBatch, { timeout: 900 }),
          type: "idle"
        };
        return;
      }

      backgroundPreloadRef.current = {
        id: window.setTimeout(loadBackgroundBatch, 220),
        type: "timeout"
      };
    };

    const preloadStoryFrames = () => {
      const storyFrameIndexes = new Set<number>();

      videoChapters.forEach((chapter) => {
        const anchorIndex = clampFrameIndex(
          Math.round(chapter.start * (frameConfig.frameCount - 1))
        );

        for (let offset = -2; offset <= 3; offset += 1) {
          storyFrameIndexes.add(clampFrameIndex(anchorIndex + offset));
        }
      });

      storyFrameIndexes.add(frameConfig.frameCount - 1);

      storyFrameIndexes.forEach((index) => {
        loadFrame(index, "low").catch(() => undefined);
      });
    };

    const setTransitionVeil = (progress: number) => {
      if (!transitionVeilRef.current) {
        return;
      }

      const transitionStrength = videoChapters
        .slice(1)
        .reduce((strongest, chapter) => {
          const distance = Math.abs(progress - chapter.start);

          if (distance > TRANSITION_SOFTNESS) {
            return strongest;
          }

          return Math.max(strongest, 1 - distance / TRANSITION_SOFTNESS);
        }, 0);

      transitionVeilRef.current.style.opacity = String(
        Math.min(0.16, transitionStrength * 0.16)
      );
    };

    const drawImageCover = (
      image: HTMLImageElement,
      alpha = 1
    ) => {
      const canvasWidth =
        canvasMetricsRef.current.width || canvas.clientWidth || window.innerWidth;
      const canvasHeight =
        canvasMetricsRef.current.height ||
        canvas.clientHeight ||
        window.innerHeight;

      if (canvasWidth === 0 || canvasHeight === 0) {
        return;
      }

      const imageAspect = image.naturalWidth / image.naturalHeight;
      const canvasAspect = canvasWidth / canvasHeight;
      let drawWidth = canvasWidth;
      let drawHeight = canvasHeight;
      let drawX = 0;
      let drawY = 0;

      if (imageAspect > canvasAspect) {
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * imageAspect;
        drawX = (canvasWidth - drawWidth) / 2;
      } else {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imageAspect;
        drawY = (canvasHeight - drawHeight) / 2;
      }

      drawWidth *= FRAME_SAFE_CROP_SCALE;
      drawHeight *= FRAME_SAFE_CROP_SCALE;
      drawX = (canvasWidth - drawWidth) / 2;
      drawY = (canvasHeight - drawHeight) / 2;

      context.globalAlpha = alpha;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      context.globalAlpha = 1;
    };

    const drawFrame = (exactFrame: number, force = false) => {
      const safeExactFrame = Math.min(
        frameConfig.frameCount - 1,
        Math.max(0, exactFrame)
      );
      const safeIndex = clampFrameIndex(Math.floor(safeExactFrame));

      if (!force && safeIndex === currentFrameRef.current) {
        return;
      }

      const image = findNearestLoadedFrame(safeIndex);

      if (!image) {
        loadFrame(safeIndex, "high").catch(() => undefined);
        return;
      }

      const canvasWidth =
        canvasMetricsRef.current.width || canvas.clientWidth || window.innerWidth;
      const canvasHeight =
        canvasMetricsRef.current.height ||
        canvas.clientHeight ||
        window.innerHeight;

      if (canvasWidth === 0 || canvasHeight === 0) {
        return;
      }

      configureContext();
      context.fillStyle = "#080706";
      context.fillRect(0, 0, canvasWidth, canvasHeight);
      drawImageCover(image);

      currentFrameRef.current = safeIndex;
      pruneFrameCache(safeIndex);

      if (!imagesRef.current[safeIndex]) {
        loadFrame(safeIndex, "high")
          .then(() => {
            if (!cancelled && safeIndex === currentFrameRef.current) {
              drawFrame(safeExactFrame, true);
            }
          })
          .catch(() => undefined);
      }

    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        MAX_DEVICE_PIXEL_RATIO
      );
      const displayWidth = Math.max(1, Math.floor(rect.width || window.innerWidth));
      const displayHeight = Math.max(
        1,
        Math.floor(rect.height || window.innerHeight)
      );
      const width = Math.floor(displayWidth * dpr);
      const height = Math.floor(displayHeight * dpr);

      canvasMetricsRef.current = {
        width: displayWidth,
        height: displayHeight,
        dpr
      };
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      configureContext();
      drawFrame(currentFrameRef.current < 0 ? 0 : currentFrameRef.current, true);
    };

    const renderLoop = () => {
      if (cancelled) {
        return;
      }

      const targetProgress = targetProgressRef.current;
      const currentProgress = displayedProgressRef.current;
      const nextProgress =
        Math.abs(targetProgress - currentProgress) < 0.0008
          ? targetProgress
          : currentProgress + (targetProgress - currentProgress) * PROGRESS_EASE;

      displayedProgressRef.current = nextProgress;

      const clampedProgress = Math.min(1, Math.max(0, nextProgress));
      const exactFrame = clampedProgress * (frameConfig.frameCount - 1);
      const frameIndex = Math.min(
        frameConfig.frameCount - 1,
        Math.max(0, Math.floor(exactFrame))
      );
      const direction = targetProgress >= previousTargetProgressRef.current ? 1 : -1;

      preloadNearbyFramesOnce(frameIndex, direction);
      drawFrame(exactFrame);
      setTransitionVeil(clampedProgress);
      previousTargetProgressRef.current = targetProgress;
      if (ENABLE_SCROLL_DEBUG) {
        window.__MENUALIVE_SCROLL_DEBUG__ = {
          progress: targetProgress,
          targetProgress,
          displayedProgress: clampedProgress,
          frameIndex,
          activeChapter: currentChapterRef.current,
          loadedFrames: cachedFrameOrderRef.current.length,
          frameCount: frameConfig.frameCount
        };
      }
      rafRef.current = window.requestAnimationFrame(renderLoop);
    };

    const preloadFrames = async () => {
      try {
        await loadFrame(0, "high");

        if (cancelled) {
          return;
        }

        resizeCanvas();
        drawFrame(0, true);
        setLoadState("canvas");

        for (
          let index = 1;
          index < Math.min(INITIAL_FRAME_BATCH, frameConfig.frameCount);
          index += 1
        ) {
          loadFrame(index, index < 5 ? "high" : "low").catch(() => undefined);
        }

        preloadNearbyFrames(0);
        preloadStoryFrames();
        scheduleBackgroundPreload();
      } catch {
        if (!cancelled && mountedRef.current) {
          setLoadState("fallback");
        }
      }
    };

    const initialiseScroll = () => {
      if (cancelled) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.12,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const progress = self.progress;

          targetProgressRef.current = progress;
          updateActiveChapter(progress);
        }
      });

      targetProgressRef.current = trigger.progress;
      displayedProgressRef.current = trigger.progress;
      updateActiveChapter(trigger.progress);

      killScrollTrigger = () => {
        trigger.kill();
      };

      ScrollTrigger.refresh();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    removeResizeListener = () => {
      window.removeEventListener("resize", resizeCanvas);
    };

    rafRef.current = window.requestAnimationFrame(renderLoop);
    preloadFrames();
    initialiseScroll();

    return () => {
      cancelled = true;

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      const backgroundPreload = backgroundPreloadRef.current;

      if (backgroundPreload !== null) {
        if (backgroundPreload.type === "idle") {
          const idleWindow = window as IdleCapableWindow;

          idleWindow.cancelIdleCallback?.(backgroundPreload.id);
        } else {
          window.clearTimeout(backgroundPreload.id);
        }
      }

      removeResizeListener();
      killScrollTrigger();
    };
  }, []);

  if (loadState === "fallback") {
    return (
      <section
        id="experience"
        aria-label="Expérience MenuAlive"
        className="relative min-h-[100svh] overflow-hidden bg-charcoal"
      >
        <video
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        >
          <source src={PRIMARY_VIDEO_SRC} type="video/mp4" />
          <source src={LEGACY_VIDEO_FALLBACK_SRC} type="video/mp4" />
        </video>
        <div className="video-readable-overlay absolute inset-0" />
        <div className="relative z-10 flex min-h-[100svh] items-end px-5 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-28 sm:px-10 lg:px-16 lg:pb-24">
          <DynamicVideoText chapter={activeChapter} />
        </div>
        <div className="sr-only">
          {videoChapters.map((chapter) => (
            <p key={chapter.id}>
              {chapter.eyebrow}. {chapter.title} {chapter.body}
            </p>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="experience"
      aria-label="Expérience MenuAlive"
      className="relative h-[420vh] bg-charcoal md:h-[520vh]"
    >
      <div className="sticky top-0 h-screen min-h-[560px] w-full overflow-hidden bg-charcoal [contain:paint]">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
            loadState === "canvas" ? "opacity-100" : "opacity-0"
          }`}
        />
        <div className="video-readable-overlay absolute inset-0 z-10" />
        <div className="video-warmth absolute inset-0 z-10" />
        <div ref={transitionVeilRef} className="video-transition-veil absolute inset-0 z-10" />
        <div className="video-grain absolute inset-0 z-10" />

        <div className="relative z-20 flex h-full w-full items-end px-5 pb-[max(3.75rem,env(safe-area-inset-bottom))] pt-28 sm:px-10 md:items-center lg:px-16 lg:pb-20">
          <DynamicVideoText chapter={activeChapter} />
        </div>
      </div>
    </section>
  );
}
