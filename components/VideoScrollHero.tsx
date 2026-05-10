"use client";

import { useEffect, useRef, useState } from "react";
import { DynamicVideoText } from "@/components/DynamicVideoText";
import { frameConfig } from "@/lib/frameConfig";
import { getActiveChapter, videoChapters } from "@/lib/videoChapters";

const VIDEO_SRC = "/videos/upscaled-video.mp4";
const SEEK_EPSILON = 1 / 24;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function seekVideo(video: HTMLVideoElement, progress: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;

  const safeProgress = clamp01(progress);
  const nextTime = safeProgress * video.duration;

  if (
    safeProgress <= 0.001 ||
    safeProgress >= 0.999 ||
    Math.abs(video.currentTime - nextTime) >= SEEK_EPSILON
  ) {
    try {
      if (typeof video.fastSeek === "function") {
        video.fastSeek(nextTime);
      } else {
        video.currentTime = nextTime;
      }
    } catch {
      try {
        video.currentTime = nextTime;
      } catch {
        // Ignore transient browser seek errors.
      }
    }
  }
}

export function VideoScrollHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const chapterIdRef = useRef(videoChapters[0].id);

  const [chapter, setChapter] = useState(videoChapters[0]);
  const [reducedMotion, setReducedMotion] = useState(false);

  const posterSrc = frameConfig.framePath(0);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(motion.matches);

    sync();
    motion.addEventListener("change", sync);

    return () => motion.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    const syncVideo = () => seekVideo(video, progressRef.current);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.addEventListener("loadedmetadata", syncVideo);
    video.addEventListener("loadeddata", syncVideo);
    video.addEventListener("canplay", syncVideo);
    video.load();

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) syncVideo();

    return () => {
      video.removeEventListener("loadedmetadata", syncVideo);
      video.removeEventListener("loadeddata", syncVideo);
      video.removeEventListener("canplay", syncVideo);
    };
  }, [reducedMotion]);

  useEffect(() => {
    const updateFromScroll = () => {
      rafRef.current = null;

      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollableDistance = Math.max(1, rect.height - viewportHeight);
      const progress = clamp01(-rect.top / scrollableDistance);
      progressRef.current = progress;

      const nextChapter = getActiveChapter(progress);
      if (nextChapter.id !== chapterIdRef.current) {
        chapterIdRef.current = nextChapter.id;
        setChapter(nextChapter);
      }

      if (!reducedMotion) {
        const video = videoRef.current;
        if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          seekVideo(video, progress);
        }
      }
    };

    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(updateFromScroll);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="experience"
      className="scroll-video-section relative overflow-clip bg-[#080706]"
      aria-label="Expérience Vistaire"
    >
      <div className="video-sticky-viewport sticky top-0 overflow-hidden bg-[#080706]">
        <img
          src={posterSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {!reducedMotion ? (
          <video
            ref={videoRef}
            src={VIDEO_SRC}
            poster={posterSrc}
            aria-hidden="true"
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full scale-[1.085] object-cover object-[50%_48%] md:scale-[1.045] md:object-center"
          />
        ) : null}

        <div className="video-readable-overlay absolute inset-0 z-10" />
        <div className="video-warmth absolute inset-0 z-10" />
        <div className="video-grain absolute inset-0 z-10" />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 z-20 h-28 w-44 bg-gradient-to-br from-[#080706]/0 via-[#080706]/88 to-[#080706] md:h-24 md:w-44"
        />

        <div className="absolute inset-0 z-30 flex items-end px-5 pb-14 pt-28 sm:px-10 sm:pb-20 md:items-center md:pb-0 lg:px-16">
          <div className="mx-auto w-full max-w-7xl">
            <DynamicVideoText chapter={chapter} />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-32 bg-gradient-to-t from-[#080706] via-[#080706]/72 to-transparent" />
      </div>
    </section>
  );
}
