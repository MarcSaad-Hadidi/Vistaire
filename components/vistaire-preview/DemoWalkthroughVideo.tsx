"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function DemoWalkthroughVideo({
  label,
  poster,
  src,
  controls = false,
  disablePictureInPicture = false,
  autoPlay = true,
  playLabel = "Play video",
  sizes = "(max-width: 760px) 80vw, 340px",
  playbackRate = 1
}: {
  label: string;
  poster: string;
  src: string;
  controls?: boolean;
  disablePictureInPicture?: boolean;
  autoPlay?: boolean;
  playLabel?: string;
  sizes?: string;
  playbackRate?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [decoded, setDecoded] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // WebKit needs the live property set before attaching an autoplay source.
    video.defaultMuted = true;
    video.muted = true;
    // A new source restarts at defaultPlaybackRate: set both.
    video.defaultPlaybackRate = playbackRate;
    video.playbackRate = playbackRate;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isIntersecting = false;
    let userPaused = false;
    let lifecyclePause = false;
    let disposed = false;
    const pauseForVisibility = () => {
      if (video.paused) return;
      lifecyclePause = true;
      video.pause();
    };
    const updatePlayback = () => {
      if (!video.isConnected) return;
      // Keep decorative menu clips autoplaying only after checking preferences.
      video.autoplay = autoPlay && !controls && !motion.matches && isIntersecting && !document.hidden;
      if (!isIntersecting || document.hidden || (motion.matches && !controls)) {
        pauseForVisibility();
        return;
      }
      // Native controls remain usable with reduced motion, but never auto-start.
      if (!video.hasAttribute("src")) video.src = src;
      if (autoPlay && !motion.matches && !userPaused && video.paused) {
        void video.play().catch((error: unknown) => {
          if (!disposed && controls && (error as DOMException)?.name !== "AbortError") {
            setPlaybackBlocked(true);
          }
        });
      }
    };
    const onPlay = () => {
      userPaused = false;
      setPlaybackBlocked(false);
    };
    const onPause = () => {
      // A pause from the native controls must survive viewport/tab changes.
      if (lifecyclePause) lifecyclePause = false;
      else if (controls) userPaused = true;
    };
    const onMotionChange = () => {
      if (motion.matches) {
        video.autoplay = false;
        pauseForVisibility();
      }
      else updatePlayback();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = Boolean(entry?.isIntersecting);
        if (isIntersecting) video.poster = poster;
        updatePlayback();
      },
      { rootMargin: controls ? "0px" : "200px 0px" }
    );
    const observeVideo = () => observer.observe(video);
    const releaseVideo = () => {
      observer.unobserve(video);
      isIntersecting = false;
      pauseForVisibility();
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    motion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", updatePlayback);
    observeVideo();
    window.addEventListener("pagehide", releaseVideo);
    window.addEventListener("pageshow", observeVideo);
    return () => {
      disposed = true;
      window.removeEventListener("pagehide", releaseVideo);
      window.removeEventListener("pageshow", observeVideo);
      document.removeEventListener("visibilitychange", updatePlayback);
      motion.removeEventListener("change", onMotionChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      observer.disconnect();
      releaseVideo();
    };
  }, [src, poster, controls, autoPlay, playbackRate]);

  return (
    <div className="public-film-frame">
      <Image
        alt=""
        aria-hidden="true"
        className="public-film-poster"
        fill
        sizes={sizes}
        src={poster}
        unoptimized
      />
      <video
        aria-label={label}
        controls={controls}
        disablePictureInPicture={disablePictureInPicture}
        data-demo-video
        loop
        muted
        playsInline
        poster={controls ? poster : undefined}
        preload={controls ? "none" : "metadata"}
        ref={videoRef}
        onLoadedData={() => setDecoded(true)}
        onPlaying={() => setDecoded(true)}
        onVolumeChange={(event) => {
          // WebKit can reset mute when applying a decorative film's playback rate.
          if (!controls && !event.currentTarget.muted) event.currentTarget.muted = true;
        }}
        onError={() => setDecoded(false)}
        style={{ opacity: decoded || controls ? 1 : 0 }}
      />
      {controls && playbackBlocked && (
        <button
          data-video-play-fallback
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (video) void video.play().catch(() => setPlaybackBlocked(true));
          }}
        >
          <span aria-hidden="true">{"▶︎"}</span> {playLabel}
        </button>
      )}
    </div>
  );
}

