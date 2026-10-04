"use client";

import { useEffect, useRef } from "react";

export function DemoWalkthroughVideo({
  label,
  poster,
  src
}: {
  label: string;
  poster: string;
  src: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || !video.isConnected) return;
        if (!video.hasAttribute("src")) video.src = src;
        // Explicit playback also resumes a muted clip when WebKit reveals it again.
        void video.play().catch(() => undefined);
      },
      { rootMargin: "200px 0px" }
    );
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
      observer.disconnect();
      releaseVideo();
    };
  }, [src]);

  return (
    <video
      aria-label={label}
      autoPlay
      data-demo-video
      loop
      muted
      playsInline
      poster={poster}
      preload="metadata"
      ref={videoRef}
    />
  );
}
