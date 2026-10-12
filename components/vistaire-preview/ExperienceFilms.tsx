"use client";

import { useEffect, useRef, type ReactNode } from "react";

// This page has one playback owner. The shared dashboard player is independent.
export function coordinateExperienceFilms(root: HTMLElement) {
  const films = Array.from(root.querySelectorAll<HTMLVideoElement>("video[data-experience-src]"));
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const states = new Map(films.map((video) => [video, {
    ratio: 0, userPaused: false, lifecyclePauses: 0, pending: false, reevaluate: false, blocked: false, failed: false
  }]));
  let active: HTMLVideoElement | null = null;
  let away = false;
  let disposed = false;

  const pause = (video: HTMLVideoElement) => {
    if (video.paused) return;
    states.get(video)!.lifecyclePauses += 1;
    video.pause();
  };
  const update = () => {
    if (disposed) return;
    active = null;
    if (!document.hidden && !away) {
      for (const video of films) {
        const ratio = states.get(video)!.ratio;
        if (!states.get(video)!.failed && ratio >= 0.25 && (!active || ratio > states.get(active)!.ratio)) active = video;
      }
    }
    // Pause the previous clip before requesting playback on the next one.
    for (const video of films) if (video !== active) pause(video);
    if (!active) return;
    const video = active;
    const state = states.get(video)!;
    if (!video.getAttribute("src")) video.setAttribute("src", video.dataset.experienceSrc!);
    if (motion.matches || state.userPaused || state.blocked || !video.paused) return;
    if (state.pending) {
      state.reevaluate = true;
      return;
    }
    state.pending = true;
    state.reevaluate = false;
    void video.play().catch((error: unknown) => {
      if (!disposed && active === video && (error as DOMException)?.name !== "AbortError") state.blocked = true;
    }).finally(() => {
      state.pending = false;
      // Consume only a newer eligible update, never retry an abort on its own.
      if (state.reevaluate) {
        state.reevaluate = false;
        update();
      }
    });
  };
  const onPlay = (event: Event) => {
    const video = event.currentTarget as HTMLVideoElement;
    const state = states.get(video)!;
    // A late play event must not revive a clip that has left the viewport.
    if (disposed || away || document.hidden || state.failed || state.ratio <= 0 || (state.pending && active !== video)) {
      pause(video);
      return;
    }
    active = video;
    state.userPaused = false;
    state.blocked = false;
    for (const other of films) if (other !== video) pause(other);
  };
  const onPause = (event: Event) => {
    const state = states.get(event.currentTarget as HTMLVideoElement)!;
    if (state.lifecyclePauses > 0) state.lifecyclePauses -= 1;
    else state.userPaused = true;
  };
  const onError = (event: Event) => {
    const video = event.currentTarget as HTMLVideoElement;
    states.get(video)!.failed = true;
    pause(video);
    // Keep the independent poster visible if decoding or the request fails.
    video.hidden = true;
  };
  const onMotionChange = () => {
    if (motion.matches) films.forEach(pause);
    else update();
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      states.get(entry.target as HTMLVideoElement)!.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
    }
    update();
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  const release = () => {
    away = true;
    active = null;
    for (const video of films) {
      pause(video);
      states.get(video)!.ratio = 0;
      video.removeAttribute("src");
      video.load();
    }
  };
  const restore = () => {
    away = false;
    observer.disconnect();
    films.forEach((video) => observer.observe(video));
  };

  for (const video of films) {
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    observer.observe(video);
  }
  document.addEventListener("visibilitychange", update);
  motion.addEventListener("change", onMotionChange);
  window.addEventListener("pagehide", release);
  window.addEventListener("pageshow", restore);
  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener("visibilitychange", update);
    motion.removeEventListener("change", onMotionChange);
    window.removeEventListener("pagehide", release);
    window.removeEventListener("pageshow", restore);
    for (const video of films) {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
    }
    release();
  };
}

export function ExperienceFilms({ children, className }: { children: ReactNode; className: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) return coordinateExperienceFilms(root.current);
  }, []);
  return <div className={className} ref={root}>{children}</div>;
}
