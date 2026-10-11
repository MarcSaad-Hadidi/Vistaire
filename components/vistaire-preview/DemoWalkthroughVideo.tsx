"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function DemoWalkthroughVideo({
  label,
  poster,
  src,
  controls = false,
  autoPlay = true,
  sizes = "(max-width: 760px) 80vw, 340px"
}: {
  label: string;
  poster: string;
  src: string;
  controls?: boolean;
  autoPlay?: boolean;
  sizes?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [decoded, setDecoded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isIntersecting = false;
    const updatePlayback = () => {
      if (!video.isConnected) return;
      if (!isIntersecting || (motion.matches && !controls)) {
        video.pause();
        return;
      }
      if (!video.hasAttribute("src")) video.src = src;
      // Explicit playback also resumes a muted clip when WebKit reveals it again.
      if (autoPlay && !motion.matches) void video.play().catch(() => undefined);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = Boolean(entry?.isIntersecting);
        updatePlayback();
      },
      { rootMargin: controls ? "0px" : "200px 0px" }
    );
    motion.addEventListener("change", updatePlayback);
    const observeVideo = () => observer.observe(video);
    const releaseVideo = () => {
      observer.unobserve(video);
      video.removeAttribute("src");
      video.load();
    };

    observeVideo();
    window.addEventListener("pagehide", releaseVideo);
    window.addEventListener("pageshow", observeVideo);
    return () => {
      window.removeEventListener("pagehide", releaseVideo);
      window.removeEventListener("pageshow", observeVideo);
      motion.removeEventListener("change", updatePlayback);
      observer.disconnect();
      releaseVideo();
    };
  }, [src, controls, autoPlay]);

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
        autoPlay={autoPlay}
        controls={controls}
        data-demo-video
        loop
        muted
        playsInline
        poster={poster}
        preload={controls ? "none" : "metadata"}
        ref={videoRef}
        onLoadedData={() => setDecoded(true)}
        onPlaying={() => setDecoded(true)}
        onError={() => setDecoded(false)}
        style={{ opacity: decoded || controls ? 1 : 0 }}
      />
    </div>
  );
}
