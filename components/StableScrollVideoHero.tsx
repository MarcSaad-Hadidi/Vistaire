"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DynamicVideoText } from "@/components/DynamicVideoText";
import { frameConfig } from "@/lib/frameConfig";
import { getActiveChapter, videoChapters } from "@/lib/videoChapters";

const VIDEO_SRC = "/videos/upscaled-video.mp4";
const FALLBACK_VIDEO_SRC = "/videos/menualive-full.mp4";
const SEEK_STEP = 1 / 30;

function clamp(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function seek(video: HTMLVideoElement, progress: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  const safeProgress = clamp(progress);
  const time = safeProgress * video.duration;
  if (
    safeProgress <= 0.001 ||
    safeProgress >= 0.999 ||
    Math.abs(video.currentTime - time) >= SEEK_STEP
  ) {
    try {
      video.currentTime = time;
    } catch {
      // Ignore transient seek errors while the browser warms the video.
    }
  }
}

export function StableScrollVideoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const metadataReadyRef = useRef(false);
  const chapterIdRef = useRef(videoChapters[0].id);
  const [chapter, setChapter] = useState(videoChapters[0]);
  const [src, setSrc] = useState(VIDEO_SRC);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    metadataReadyRef.current = false;

    const syncVideo = () => {
      metadataReadyRef.current = true;
      seek(video, progressRef.current);
    };

    const handleError = () => {
      if (src !== FALLBACK_VIDEO_SRC) setSrc(FALLBACK_VIDEO_SRC);
    };

    video.addEventListener("loadedmetadata", syncVideo);
    video.addEventListener("loadeddata", syncVideo);
    video.addEventListener("canplay", syncVideo);
    video.addEventListener("error", handleError);
    video.load();

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) syncVideo();

    return () => {
      video.removeEventListener("loadedmetadata", syncVideo);
      video.removeEventListener("loadeddata", syncVideo);
      video.removeEventListener("canplay", syncVideo);
      video.removeEventListener("error", handleError);
    };
  }, [src, reducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    gsap.registerPlugin(ScrollTrigger);

    const scheduleSeek = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const video = videoRef.current;
        if (video && metadataReadyRef.current && !reducedMotion) {
          seek(video, progressRef.current);
        }
      });
    };

    const update = (progress: number) => {
      const safeProgress = clamp(progress);
      progressRef.current = safeProgress;

      const nextChapter = getActiveChapter(safeProgress);
      if (nextChapter.id !== chapterIdRef.current) {
        chapterIdRef.current = nextChapter.id;
        setChapter(nextChapter);
      }

      scheduleSeek();
    };

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.18,
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
  }, [reducedMotion]);

  return (
    <section
      id="experience"
      ref={sectionRef}
      className="scroll-video-section relative overflow-clip bg-[#080706]"
      aria-label="Expérience Vistaire"
    >
      <div className="video-sticky-viewport sticky top-0 overflow-hidden bg-[#080706]">
        <img
          src={frameConfig.framePath(0)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[50%_42%] md:object-center"
        />
        {!reducedMotion ? (
          <video
            ref={videoRef}
            src={src}
            poster={frameConfig.framePath(0)}
            aria-hidden="true"
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover object-[50%_42%] md:object-center"
          />
        ) : null}
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
