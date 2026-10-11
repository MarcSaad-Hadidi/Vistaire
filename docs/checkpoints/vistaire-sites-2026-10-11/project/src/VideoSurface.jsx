import { useEffect, useRef, useState } from "react";
import { createVideoSurfaceController } from "./videoSurface.js";

export default function VideoSurface({
  src,
  poster,
  label,
  active = true,
  posterClass = "walkthrough-poster",
  playLabel = "Lire la vidéo",
}) {
  const videoRef = useRef(null);
  const controllerRef = useRef(null);
  const activeRef = useRef(active);
  const refreshRef = useRef(null);
  activeRef.current = active;
  const [decoded, setDecoded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const controller = createVideoSurfaceController(video, {
      onFrame: () => {
        setDecoded(true);
        setBlocked(false);
      },
      onPoster: () => setDecoded(false),
      onBlocked: () => setBlocked(true),
    });
    controllerRef.current = controller;
    const update = () =>
      controller.update(
        activeRef.current && visible && !document.hidden && !motion.matches,
        src,
      );
    refreshRef.current = update;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        update();
      },
      { threshold: 0.01 },
    );
    observer.observe(video);
    const retry = () => {
      update();
      controller.retry();
    };
    const hide = () => controller.pause();
    document.addEventListener("visibilitychange", update);
    document.addEventListener("pointerdown", retry, { passive: true });
    motion.addEventListener("change", update);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      document.removeEventListener("pointerdown", retry);
      motion.removeEventListener("change", update);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", update);
      controller.dispose();
      controllerRef.current = null;
      refreshRef.current = null;
    };
  }, [src]);
  useEffect(() => {
    refreshRef.current?.();
  }, [active]);
  return (
    <>
      <img className={posterClass} src={poster} alt="" aria-hidden="true" />
      <video
        ref={videoRef}
        aria-label={label}
        className={decoded ? "has-decoded-frame" : ""}
        style={{ opacity: decoded ? 1 : 0 }}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
      />
      {blocked && (
        <button
          className="video-play-button"
          onClick={() => controllerRef.current?.retry()}
        >
          {playLabel}
        </button>
      )}
    </>
  );
}
