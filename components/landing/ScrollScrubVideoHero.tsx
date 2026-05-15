"use client";

import { useEffect, useRef, useState } from "react";
import { DynamicVideoText } from "@/components/DynamicVideoText";
import { HERO_VIDEO_POSTER } from "@/components/landing/heroVideoSources";
import { useHeroVideoMode } from "@/components/landing/useHeroVideoMode";
import { getActiveChapter, videoChapters } from "@/lib/videoChapters";

type ScrollDebugState = {
  progress: number;
  currentTime: number;
  duration: number;
  activeChapter: string;
  engine: "video-scroll-scrub";
  source: string | null;
  variant: string | null;
  readyState: number;
};

type VideoLoadRequest = {
  id: number;
  source: string;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function ScrollScrubVideoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const durationRef = useRef(0);
  const lastAssignedTimeRef = useRef(-1);
  const chapterIdRef = useRef(videoChapters[0].id);
  const loadRequestIdRef = useRef(0);

  const mode = useHeroVideoMode();
  const modeSource = mode?.source;
  const modeSourceSrc = modeSource?.src ?? null;
  const modeSourceDurationSeconds = modeSource?.durationSeconds ?? 0;
  const modeSourceScrubReady = modeSource?.scrubReady ?? false;
  const modeVariant = mode?.variant ?? null;
  const modeMinSeekDelta = mode?.minSeekDelta ?? 1 / 30;
  const isReducedMotion = mode?.isReducedMotion ?? false;
  const isSaveData = mode?.isSaveData ?? false;
  const [chapter, setChapter] = useState(videoChapters[0]);
  const [loadRequest, setLoadRequest] = useState<VideoLoadRequest | null>(
    null
  );
  const [readyRequestId, setReadyRequestId] = useState<number | null>(null);
  const [failedVideoSource, setFailedVideoSource] = useState<string | null>(
    null
  );
  const canUseScrubVideo =
    Boolean(modeSourceSrc) &&
    !isReducedMotion &&
    !isSaveData &&
    modeSourceScrubReady &&
    failedVideoSource !== modeSourceSrc;
  const shouldLoadVideo =
    canUseScrubVideo &&
    Boolean(modeSourceSrc) &&
    loadRequest?.source === modeSourceSrc;
  const isReady = shouldLoadVideo && loadRequest?.id === readyRequestId;

  useEffect(() => {
    if (!modeSourceSrc || !canUseScrubVideo || shouldLoadVideo) {
      return undefined;
    }

    const section = sectionRef.current;
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    let rafId: number | null = null;
    let isArmed = false;

    const requestIdle =
      "requestIdleCallback" in window
        ? window.requestIdleCallback.bind(window)
        : null;
    const cancelIdle =
      "cancelIdleCallback" in window
        ? window.cancelIdleCallback.bind(window)
        : null;

    const armVideo = () => {
      if (cancelled || isArmed) return;
      isArmed = true;

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (cancelled) return;

        if (requestIdle) {
          idleId = requestIdle(
            () => {
              idleId = null;
              if (!cancelled) {
                setLoadRequest((current) => {
                  if (current?.source === modeSourceSrc) return current;
                  loadRequestIdRef.current += 1;
                  return {
                    id: loadRequestIdRef.current,
                    source: modeSourceSrc
                  };
                });
              }
            },
            { timeout: 1200 }
          );
          return;
        }

        timeoutId = window.setTimeout(() => {
          timeoutId = null;
          if (!cancelled) {
            setLoadRequest((current) => {
              if (current?.source === modeSourceSrc) return current;
              loadRequestIdRef.current += 1;
              return {
                id: loadRequestIdRef.current,
                source: modeSourceSrc
              };
            });
          }
        }, 600);
      });
    };

    let observer: IntersectionObserver | null = null;

    if (section && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            armVideo();
            observer?.disconnect();
          }
        },
        { rootMargin: "240px 0px" }
      );
      observer.observe(section);

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      if (rect.top <= viewportHeight + 240 && rect.bottom >= -240) {
        armVideo();
      }
    } else {
      armVideo();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      if (idleId !== null && cancelIdle) {
        cancelIdle(idleId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [canUseScrubVideo, modeSourceSrc, shouldLoadVideo]);

  useEffect(() => {
    const activeLoadRequest = loadRequest;
    if (
      !modeSourceSrc ||
      !modeVariant ||
      !canUseScrubVideo ||
      !shouldLoadVideo ||
      !activeLoadRequest
    ) {
      return undefined;
    }

    const section = sectionRef.current;
    const video = videoRef.current;

    if (!section || !video) return undefined;

    let cancelled = false;
    durationRef.current = 0;
    lastAssignedTimeRef.current = -1;
    video.preload = modeVariant === "desktopHigh" ? "auto" : "metadata";
    video.src = modeSourceSrc;

    const writeDebugState = () => {
      const debugWindow = window as unknown as {
        __VISTAIRE_SCROLL_DEBUG__?: ScrollDebugState;
        __MENUALIVE_SCROLL_DEBUG__?: ScrollDebugState;
      };
      const debug: ScrollDebugState = {
        progress: progressRef.current,
        currentTime: video.currentTime || 0,
        duration:
          durationRef.current || video.duration || modeSourceDurationSeconds,
        activeChapter: chapterIdRef.current,
        engine: "video-scroll-scrub",
        source: modeSourceSrc,
        variant: modeVariant,
        readyState: video.readyState
      };

      debugWindow.__VISTAIRE_SCROLL_DEBUG__ = debug;
      debugWindow.__MENUALIVE_SCROLL_DEBUG__ = debug;
    };

    const revealVideo = () => {
      if (cancelled) return;
      setReadyRequestId(activeLoadRequest.id);
      writeDebugState();
    };

    const onVideoError = () => {
      if (cancelled) return;
      setReadyRequestId(null);
      setLoadRequest(null);
      setFailedVideoSource(modeSourceSrc);
      writeDebugState();
    };

    const updateChapter = (progress: number) => {
      const nextChapter = getActiveChapter(progress);

      if (nextChapter.id !== chapterIdRef.current) {
        chapterIdRef.current = nextChapter.id;
        setChapter(nextChapter);
      }
    };

    const seekVideo = (progress: number, force = false) => {
      const duration =
        durationRef.current ||
        (Number.isFinite(video.duration) ? video.duration : 0) ||
        modeSourceDurationSeconds;

      if (!duration || video.readyState < 1) {
        writeDebugState();
        return;
      }

      const targetTime = clamp01(progress) * duration;
      const delta = Math.abs(targetTime - lastAssignedTimeRef.current);

      if (!force && delta < modeMinSeekDelta) {
        writeDebugState();
        return;
      }

      try {
        video.currentTime = targetTime;
        lastAssignedTimeRef.current = targetTime;
      } catch {
        // Some browsers reject seeks while swapping sources. The next RAF retries.
      }

      writeDebugState();
    };

    const updateFromScroll = (forceSeek = false) => {
      rafRef.current = null;
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollableDistance = Math.max(1, rect.height - viewportHeight);
      const progress = clamp01(-rect.top / scrollableDistance);

      progressRef.current = progress;
      updateChapter(progress);
      seekVideo(progress, forceSeek);
    };

    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => updateFromScroll());
    };

    const onLoadedMetadata = () => {
      if (cancelled) return;
      durationRef.current =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : modeSourceDurationSeconds;
      video.pause();
      updateFromScroll(true);
      if (video.readyState >= 2) {
        revealVideo();
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("loadeddata", revealVideo);
    video.addEventListener("canplay", revealVideo);
    video.addEventListener("seeked", writeDebugState);
    video.addEventListener("error", onVideoError);
    if (video.readyState >= 1) {
      onLoadedMetadata();
    } else {
      video.load();
    }

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule);

    return () => {
      const debugWindow = window as unknown as {
        __VISTAIRE_SCROLL_DEBUG__?: ScrollDebugState;
        __MENUALIVE_SCROLL_DEBUG__?: ScrollDebugState;
      };
      cancelled = true;
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("loadeddata", revealVideo);
      video.removeEventListener("canplay", revealVideo);
      video.removeEventListener("seeked", writeDebugState);
      video.removeEventListener("error", onVideoError);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      delete debugWindow.__VISTAIRE_SCROLL_DEBUG__;
      delete debugWindow.__MENUALIVE_SCROLL_DEBUG__;
      setReadyRequestId((current) =>
        current === activeLoadRequest.id ? null : current
      );
      video.removeAttribute("src");
      video.preload = "metadata";
      video.load();
    };
  }, [
    canUseScrubVideo,
    loadRequest,
    modeMinSeekDelta,
    modeSourceDurationSeconds,
    modeSourceSrc,
    modeVariant,
    shouldLoadVideo
  ]);

  return (
    <section
      ref={sectionRef}
      id="experience"
      data-landing-hero-mode={mode?.variant ?? "loading-video"}
      data-hero-engine="video-scroll-scrub"
      data-video-source={modeSourceSrc ?? ""}
      data-video-ready={isReady ? "true" : "false"}
      data-video-deferred={shouldLoadVideo ? "false" : "true"}
      data-video-failed={
        failedVideoSource === modeSourceSrc ? "true" : "false"
      }
      data-reduced-motion={isReducedMotion ? "true" : "false"}
      data-save-data={isSaveData ? "true" : "false"}
      className="scroll-video-section relative overflow-clip bg-[#080706]"
      aria-label="Expérience Vistaire"
    >
      <div className="video-sticky-viewport sticky top-0 w-full overflow-hidden bg-[#080706] [contain:paint]">
        <div className="hero-video-backdrop" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_VIDEO_POSTER}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className={`hero-video-poster ${
            isReady ? "opacity-0" : "opacity-100"
          }`}
        />
        <video
          ref={videoRef}
          aria-hidden="true"
          className="hero-video-media"
          poster={HERO_VIDEO_POSTER}
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          controls={false}
          tabIndex={-1}
        />
        <div className="video-readable-overlay absolute inset-0 z-10" />
        <div className="video-warmth absolute inset-0 z-10" />
        <div className="video-transition-veil absolute inset-0 z-10" />
        <div className="video-grain absolute inset-0 z-10" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 z-20 h-28 w-44 bg-gradient-to-br from-[#080706]/0 via-[#080706]/88 to-[#080706] md:h-24 md:w-44"
        />
        <div className="hero-copy-layer relative z-30 flex h-full w-full items-end px-5 pb-14 pt-28 sm:px-10 sm:pb-20 md:items-center md:pb-0 lg:px-16">
          <div className="mx-auto w-full max-w-7xl">
            <DynamicVideoText chapter={chapter} />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-32 bg-gradient-to-t from-[#080706] via-[#080706]/72 to-transparent" />
      </div>
    </section>
  );
}
