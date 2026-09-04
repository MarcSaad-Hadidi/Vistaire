"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HERO_VIDEO_SOURCES } from "./heroVideoSources";
import styles from "./LandingHeroMedia.module.css";

const heroPosterSrc = "/frames/menualive/frame_0200.webp";
const landingVideoSrc = "/videos/Vistaire2.mp4";
const mobileLandingVideoSrc = HERO_VIDEO_SOURCES.mobile.src;
const heroCaptionsSrc = "/captions/hero-empty.vtt";

export function LandingHeroMedia({
  locale
}: {
  locale: "fr" | "en";
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
            if (!cancelled) setIsPlaying(true);
          })
          .catch(() => {
            if (!cancelled) setIsPlaying(false);
          });
      } else {
        setIsPlaying(true);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

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
        id="landing-hero-video"
        loop
        muted
        onError={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onCanPlay={() => {
          const video = videoRef.current;
          if (!video || !video.paused) return;
          void video.play().catch(() => setIsPlaying(false));
        }}
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
