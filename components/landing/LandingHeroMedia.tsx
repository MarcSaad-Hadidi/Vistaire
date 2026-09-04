"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { HERO_VIDEO_SOURCES } from "./heroVideoSources";
import styles from "./LandingHeroMedia.module.css";

const heroPosterSrc = "/frames/menualive/frame_0200.webp";
const landingVideoSrc = HERO_VIDEO_SOURCES.desktopHigh.src;
const mobileLandingVideoSrc = HERO_VIDEO_SOURCES.mobile.src;
const heroCaptionsSrc = "/captions/hero-empty.vtt";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function LandingHeroMedia({
  locale
}: {
  locale: "fr" | "en";
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollFrameRef = useRef<number | null>(null);

  const syncVideoToScroll = useCallback(() => {
    const video = videoRef.current;
    const media = video?.parentElement;
    if (
      !video ||
      !media ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return;
    }

    const rect = media.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;
    const scrollStart = viewportHeight;
    const scrollEnd = -Math.max(rect.height, 1);
    const progress = clamp01(
      (scrollStart - rect.top) / Math.max(1, scrollStart - scrollEnd)
    );
    const targetTime = progress * Math.max(0, video.duration - 0.05);

    if (Math.abs(video.currentTime - targetTime) > 0.06) {
      video.currentTime = targetTime;
    }
  }, []);

  useEffect(() => {
    const scheduleScrollSync = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        syncVideoToScroll();
      });
    };

    scheduleScrollSync();
    window.addEventListener("scroll", scheduleScrollSync, { passive: true });
    window.addEventListener("resize", scheduleScrollSync);
    window.addEventListener("orientationchange", scheduleScrollSync);

    return () => {
      window.removeEventListener("scroll", scheduleScrollSync);
      window.removeEventListener("resize", scheduleScrollSync);
      window.removeEventListener("orientationchange", scheduleScrollSync);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [syncVideoToScroll]);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;

      const playPromise = video.play();
      if (playPromise) {
        playPromise
          .then(() => {
            if (!cancelled) {
              setVideoFailed(false);
              setIsPlaying(true);
              syncVideoToScroll();
            }
          })
          .catch(() => {
            if (!cancelled) setIsPlaying(false);
          });
      } else {
        setVideoFailed(false);
        setIsPlaying(true);
        syncVideoToScroll();
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [syncVideoToScroll]);

  return (
    <div className={styles.media} data-hero-media={isPlaying ? "video" : "poster"}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.poster}
        fill
        priority
        sizes="(max-width: 920px) calc(100vw - 36px), 690px"
        src={heroPosterSrc}
      />
      <video
        aria-hidden="true"
        autoPlay
        className={styles.video}
        controls={false}
        data-hero-video-state={isPlaying ? "playing" : "poster"}
        data-video-deferred="false"
        data-video-failed={videoFailed ? "true" : "false"}
        id="landing-hero-video"
        loop
        muted
        onError={() => {
          setVideoFailed(true);
          setIsPlaying(false);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => {
          setVideoFailed(false);
          setIsPlaying(true);
        }}
        onCanPlay={() => {
          const video = videoRef.current;
          if (!video || !video.paused) return;
          void video.play().catch(() => setIsPlaying(false));
        }}
        onLoadedMetadata={syncVideoToScroll}
        playsInline
        poster={heroPosterSrc}
        preload="metadata"
        ref={videoRef}
      >
        <source
          media="(min-width: 721px)"
          src={landingVideoSrc}
          type="video/mp4"
        />
        <source
          media="(max-width: 720px)"
          src={mobileLandingVideoSrc}
          type="video/mp4"
        />
        <source src={landingVideoSrc} type="video/mp4" />
        <track
          default
          kind="captions"
          label={locale === "en" ? "English" : "Français"}
          src={heroCaptionsSrc}
          srcLang={locale}
        />
      </video>
    </div>
  );
}
