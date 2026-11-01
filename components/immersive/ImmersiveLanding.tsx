"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n";
import { App } from "./App.jsx";
import { bindJourneyViewport } from "./JourneyViewport.js";
import "./styles.css";
import "./pricing.css";

export function ImmersiveLanding({locale = "fr"}: {locale?: Locale}) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    const release = bindJourneyViewport();
    return () => {release(); root.style.scrollBehavior = previous;};
  }, []);
  return <div data-immersive-vistaire><App locale={locale} /></div>;
}
