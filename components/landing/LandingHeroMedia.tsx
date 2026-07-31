"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./LandingHeroMedia.module.css";

const heroPosterSrc = "/frames/menualive/frame_0200.webp";
const landingVideoSrc = "/videos/Vistaire2.mp4";
const heroCaptionsSrc = "/captions/hero-empty.vtt";

type ConnectionAwareNavigator = Navigator & {
  connection?: {
    saveData?: boolean;
  };
};

export function LandingHeroMedia({
  locale
}: {
  locale: "fr" | "en";
}) {
  const [autoplayAllowed, setAutoplayAllowed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playLabel = locale === "en" ? "Play video" : "Lire la vidéo";
  const pauseLabel = locale === "en" ? "Pause video" : "Mettre la vidéo en pause";

  useEffect(() => {
    const navigatorWithConnection = navigator as ConnectionAwareNavigator;
    const shouldAutoplay =
      navigatorWithConnection.connection?.saveData !== true &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setAutoplayAllowed(shouldAutoplay);
      if (!shouldAutoplay) return;

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

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => setIsPlaying(false));
      }
    } else {
      video.pause();
    }
  };

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
        autoPlay={autoplayAllowed}
        className={styles.video}
        controls={false}
        data-hero-video-state={isPlaying ? "playing" : "poster"}
        id="landing-hero-video"
        loop
        muted
        onError={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        playsInline
        poster={heroPosterSrc}
        preload={autoplayAllowed ? "metadata" : "none"}
        ref={videoRef}
      >
        <source src={landingVideoSrc} type="video/mp4" />
        <track
          default
          kind="captions"
          label={locale === "en" ? "English" : "Français"}
          src={heroCaptionsSrc}
          srcLang={locale}
        />
      </video>
      <button
        aria-controls="landing-hero-video"
        aria-label={isPlaying ? pauseLabel : playLabel}
        className={styles.videoControl}
        onClick={togglePlayback}
        type="button"
      >
        {isPlaying ? "Ⅱ" : "▶"}
      </button>
    </div>
  );
}
