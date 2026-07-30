"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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
  locale,
  videoLabel
}: {
  locale: "fr" | "en";
  videoLabel: string;
}) {
  const [playVideo, setPlayVideo] = useState<boolean | null>(null);

  useEffect(() => {
    const navigatorWithConnection = navigator as ConnectionAwareNavigator;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const frame = window.requestAnimationFrame(() => {
      setPlayVideo(
        navigatorWithConnection.connection?.saveData !== true &&
          !prefersReducedMotion
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (playVideo !== true) {
    return (
      <div className={styles.media} data-hero-media="poster">
        <Image
          alt=""
          aria-hidden="true"
          className={styles.poster}
          fill
          priority
          sizes="(max-width: 920px) calc(100vw - 36px), 690px"
          src={heroPosterSrc}
        />
      </div>
    );
  }

  return (
    <div className={styles.media} data-hero-media="video">
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
        aria-label={videoLabel}
        autoPlay
        className={styles.video}
        controls={false}
        loop
        muted
        onError={() => setPlayVideo(false)}
        playsInline
        poster={heroPosterSrc}
        preload="metadata"
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
    </div>
  );
}
