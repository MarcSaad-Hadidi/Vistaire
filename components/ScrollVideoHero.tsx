"use client";

import { useEffect, useState } from "react";
import { CanvasScrollVideo } from "@/components/CanvasScrollVideo";
import { StableScrollVideoHero } from "@/components/StableScrollVideoHero";

export function ScrollVideoHero() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  if (isDesktop) {
    return <CanvasScrollVideo />;
  }

  return <StableScrollVideoHero />;
}
