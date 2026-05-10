"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DynamicVideoText } from "@/components/DynamicVideoText";
import { frameConfig } from "@/lib/frameConfig";
import { getActiveChapter, videoChapters } from "@/lib/videoChapters";

const VIDEO_SRC = "/videos/upscaled-video.mp4";
const FRAME_PRELOAD_RADIUS = 8;
const MOBILE_QUERY = "(max-width: 767px)";

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

function frameFromProgress(progress: number) {
  return Math.min(
    frameConfig.frameCount - 1,
    Math.max(0, Math.round(clamp01(progress) * (frameConfig.frameCount - 1)))
  );
}

function seekVideo(video: HTMLVideoElement, progress: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  const nextTime = clamp01(progress) * video.duration;
  if (Math.abs(video.currentTime - nextTime) > 1 / 24) {
    try {
      video.currentTime = nextTime;
    } catch {
      // Safe no-op while the browser is still preparing the video.
    }
  }
}

export function ResponsiveScrollHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const loadedFramesRef = useRef<Set<number>>(new Set());
  const chapterRef = useRef(videoChapters[0].id);

  const [isMobile, setIsMobile] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [chapter, setChapter] = useState(videoChapters[0]);
  const [reducedMotion, setReducedMotion] = useState(false);

  const frameSrc = useMemo(() => frameConfig.framePath(frameIndex), [frameIndex]);
  const posterSrc = frameConfig.framePath(0);

  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_QUERY);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setIsMobile(mobile.matches);
      setReducedMotion(motion.matches);
    };

    sync();
    mobile.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    return () => {
      mobile.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (isMobile || reducedMotion) return;

    const start = Math.max(0, frameIndex - FRAME_PRELOAD_RADIUS);
    const end = Math.min(frameConfig.frameCount - 1, frameIndex + FRAME_PRELOAD_RADIUS);

    for (let index = start; index <= end; index += 1) {
      if (loadedFramesRef.current.has(index)) continue;
      loadedFramesRef.current.add(index);
      const image = new Image();
      image.decoding = "async";
      image.src = frameConfig.framePath(index);
    }
  }, [frameIndex, isMobile, reducedMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isMobile || reducedMotion) return;

    const sync = () => seekVideo(video, progressRef.current);
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("loadeddata", sync);
    video.addEventListener("canplay", sync);
    video.load();

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) sync();

    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("loadeddata", sync);
      video.removeEventListener("canplay", sync);
    };
  }, [isMobile, reducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    gsap.registerPlugin(ScrollTrigger);

    const scheduleUpdate = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const progress = progressRef.current;

        if (!isMobile && !reducedMotion) {
          setFrameIndex(frameFromProgress(progress));
          return;
        }

        const video = videoRef.current;
        if (video && isMobile && !reducedMotion) {
          seekVideo(video, progress);
        }
      });
    };

    const update = (progress: number) => {
      const safeProgress = clamp01(progress);
      progressRef.current = safeProgress;

      const nextChapter = getActiveChapter(safeProgress);
      if (nextChapter.id !== chapterRef.current) {
        chapterRef.current = nextChapter.id;
        setChapter(nextChapter);
      }

      scheduleUpdate();
    };

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.12,
      onUpdate: (self) => update(self.progress),
      onRefresh: (self) => update(self.progress)
    });

    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      update(trigger.progress);
    });

    return () => {
      trigger.kill();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isMobile, reducedMotion]);

  return (
    <section
      id="experience"
      ref={sectionRef}
      className="scroll-video-section relative overflow-clip bg-[#080706]"
      aria-label="Expérience Vistaire"
    >
      <div className="video-sticky-viewport sticky top-0 overflow-hidden bg-[#080706]">
        {isMobile && !reducedMotion ? (
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={posterSrc}
            aria-hidden="true"
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-contain object-center"
          />
        ) : (
          <img
            src={reducedMotion ? posterSrc : frameSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}
        <div className="video-readable-overlay absolute inset-0 z-10" />
        <div className="video-warmth absolute inset-0 z-10" />
        <div className="video-grain absolute inset-0 z-10" />
        <div className="absolute inset-0 z-20 flex items-end px-5 pb-14 pt-28 sm:px-10 sm:pb-20 md:items-center md:pb-0 lg:px-16">
          <div className="mx-auto w-full max-w-7xl">
            <DynamicVideoText chapter={chapter} />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-[#080706] via-[#080706]/72 to-transparent" />
      </div>
    </section>
  );
}
