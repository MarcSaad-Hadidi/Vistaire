"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DynamicVideoText } from "@/components/DynamicVideoText";
import { frameConfig } from "@/lib/frameConfig";
import { getActiveChapter, videoChapters } from "@/lib/videoChapters";

const PRIMARY_VIDEO_SRC = "/videos/upscaled-video.mp4";
const FALLBACK_VIDEO_SRC = "/videos/menualive-full.mp4";
const SEEK_EPSILON = 1 / 30;

type LoadState = "loading" | "ready" | "image";

const clampProgress = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

function seekVideo(video: HTMLVideoElement, progress: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;
  const nextTime = clampProgress(progress) * video.duration;
  if (
    progress <= 0.001 ||
    progress >= 0.999 ||
    Math.abs(video.currentTime - nextTime) >= SEEK_EPSILON
  ) {
    try {
      video.currentTime = nextTime;
    } catch {
      // Browser may reject a seek while the video is still warming up.
    }
  }
}

export function ScrollVideoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const chapterRef = useRef(videoChapters[0].id);
  const [chapter, setChapter] = useState(videoChapters[0]);
  const [src, setSrc] = useState(PRIMARY_VIDEO_SRC);
  const [loadState, setLoadState] = useState<LoadState>("loading");
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

    let cancelled = false;
    setLoadState("loading");

    const syncVideo = () => {
      if (cancelled) return;
      seekVideo(video, progressRef.current);
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setLoadState("ready");
      }
    };

    const warmVideo = () => {
      video.muted = true;
      video.playsInline = true;
      video.pause();
      syncVideo();
      const warmup = video.play();
      if (warmup) {
        void warmup
          .then(() => {
            video.pause();
            syncVideo();
          })
          .catch(syncVideo);
      }
    };

    const onError = () => {
      if (src !== FALLBACK_VIDEO_SRC) {
        setSrc(FALLBACK_VIDEO_SRC);
      } else {
        setLoadState("image");
      }
    };

    video.addEventListener("loadedmetadata", warmVideo);
    video.addEventListener("loadeddata", syncVideo);
    video.addEventListener("canplay", syncVideo);
    video.addEventListener("error", onError);

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) warmVideo();
    video.load();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", warmVideo);
      video.removeEventListener("loadeddata", syncVideo);
      video.removeEventListener("canplay", syncVideo);
      video.removeEventListener("error", onError);
    };
  }, [src, reducedMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    gsap.registerPlugin(ScrollTrigger);

    const scheduleSeek = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const video = videoRef.current;
        if (video && !reducedMotion) seekVideo(video, progressRef.current);
      });
    };

    const update = (progress: number) => {
      const safeProgress = clampProgress(progress);
      progressRef.current = safeProgress;
      const nextChapter = getActiveChapter(safeProgress);
      if (nextChapter.id !== chapterRef.current) {
        chapterRef.current = nextChapter.id;
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
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion]);

  const showVideo = !reducedMotion && loadState === "ready";
  const showImage = reducedMotion || loadState !== "ready";

  return (
    <section
      id="experience"
      ref={sectionRef}
      className="scroll-video-section relative overflow-clip bg-[#080706]"
      aria-label="Expérience Vistaire"
    >
      <div className="video-sticky-viewport sticky top-0 overflow-hidden bg-[#080706]">
        <video
          ref={videoRef}
          src={src}
          poster={frameConfig.framePath(0)}
          aria-hidden="true"
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${
            showVideo ? "opacity-100" : "opacity-0"
          }`}
        />
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frameConfig.framePath(0)}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center"
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
