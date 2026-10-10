"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

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
  const [decoded, setDecoded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!video.isConnected) return;
        if (!entry?.isIntersecting) {
          video.pause();
          return;
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    <div className="public-film-frame">
      <Image
        alt=""
        aria-hidden="true"
        className="public-film-poster"
        fill
        sizes="(max-width: 760px) 80vw, 340px"
        src={poster}
        unoptimized
      />
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
        onLoadedData={() => setDecoded(true)}
        onPlaying={() => setDecoded(true)}
        onWaiting={() => setDecoded(false)}
        onError={() => setDecoded(false)}
        style={{ opacity: decoded ? 1 : 0 }}
      />
    </div>
  );
}
