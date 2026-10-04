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
        if (!entry?.isIntersecting) return;
        video.src = src;
        // Once loaded, the walkthrough keeps looping as explicitly requested.
        observer.disconnect();
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(video);
    return () => observer.disconnect();
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
