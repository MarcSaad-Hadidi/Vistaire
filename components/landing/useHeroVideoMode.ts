"use client";

import { useEffect, useState } from "react";
import {
  HERO_VIDEO_SOURCES,
  type HeroVideoSource,
  type HeroVideoVariant
} from "@/components/landing/heroVideoSources";

type NavigatorConnection = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithCapabilities = Navigator & {
  connection?: NavigatorConnection;
  mozConnection?: NavigatorConnection;
  webkitConnection?: NavigatorConnection;
  deviceMemory?: number;
};

export type HeroVideoMode = {
  source: HeroVideoSource;
  variant: HeroVideoVariant;
  isReducedMotion: boolean;
  isSaveData: boolean;
  isLowEndDevice: boolean;
  preload: "metadata";
  minSeekDelta: number;
};

function getConnection(navigatorValue: NavigatorWithCapabilities) {
  return (
    navigatorValue.connection ??
    navigatorValue.mozConnection ??
    navigatorValue.webkitConnection ??
    {}
  );
}

function selectHeroVideoMode(): HeroVideoMode {
  const navigatorValue = navigator as NavigatorWithCapabilities;
  const connection = getConnection(navigatorValue);
  const isReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;
  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const deviceMemory = navigatorValue.deviceMemory ?? 8;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const effectiveType = connection.effectiveType ?? "4g";
  const isSaveData = connection.saveData === true;
  const isSlowConnection = effectiveType === "2g" || effectiveType === "3g";
  const isLowEndDevice =
    deviceMemory <= 2 || hardwareConcurrency <= 4 || isSlowConnection;

  if (isMobileViewport || isTouchDevice) {
    return {
      source: HERO_VIDEO_SOURCES.mobile,
      variant: "mobile",
      isReducedMotion,
      isSaveData,
      isLowEndDevice,
      preload: "metadata",
      minSeekDelta: isReducedMotion || isLowEndDevice ? 1 / 12 : 1 / 24
    };
  }

  return {
    source: HERO_VIDEO_SOURCES.desktopHigh,
    variant: "desktopHigh",
    isReducedMotion,
    isSaveData,
    isLowEndDevice,
    preload: "metadata",
    minSeekDelta: isReducedMotion || isLowEndDevice ? 1 / 10 : 1 / 30
  };
}

export function useHeroVideoMode() {
  const [mode, setMode] = useState<HeroVideoMode | null>(null);

  useEffect(() => {
    const sync = () => {
      setMode(selectHeroVideoMode());
    };

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const mobileQuery = window.matchMedia("(max-width: 767px)");

    sync();

    reducedMotionQuery.addEventListener("change", sync);
    mobileQuery.addEventListener("change", sync);
    window.addEventListener("resize", sync, { passive: true });
    window.addEventListener("orientationchange", sync);

    return () => {
      reducedMotionQuery.removeEventListener("change", sync);
      mobileQuery.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return mode;
}
