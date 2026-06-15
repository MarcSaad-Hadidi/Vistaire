"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { VistaireDigitalMenuScene } from "@/components/seo/VistaireDigitalMenuScene";
import type { CinematicMenuBloomData } from "@/lib/cinematicMenuBloomData";
import type { PdfMenuSection } from "@/lib/pdfComparePreviewData";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

type CinematicMenuBloomProps = {
  preview: CinematicMenuBloomData;
  className?: string;
};

const BLOOM_DURATION_MS = 3200;

const BLOOM_STYLES = `
.cmb-root {
  --cmb-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --cmb-ease-soft: cubic-bezier(0.4, 0, 0.2, 1);
  --cmb-ease-overshoot: cubic-bezier(0.34, 1.4, 0.64, 1);
  --cmb-scrub-ms: 0ms;
}

.cmb-root .cmb-ambient {
  opacity: 1;
}

.cmb-root .cmb-paper,
.cmb-root .cmb-sweep,
.cmb-root .cmb-phone,
.cmb-root .cmb-layer,
.cmb-root .cmb-dish,
.cmb-root .cmb-badge,
.cmb-root .cmb-cta {
  animation-play-state: paused;
  animation-fill-mode: both;
}

.cmb-root .cmb-paper {
  animation: cmb-paper-exit 900ms var(--cmb-ease-soft) forwards;
  animation-delay: calc(240ms - var(--cmb-scrub-ms, 0ms));
}

.cmb-root .cmb-sweep {
  opacity: 0;
  animation: cmb-light-sweep 1000ms var(--cmb-ease-soft) forwards;
  animation-delay: calc(120ms - var(--cmb-scrub-ms, 0ms));
}

.cmb-root .cmb-phone {
  opacity: 0;
  animation: cmb-phone-in 760ms var(--cmb-ease-out) forwards;
  animation-delay: calc(720ms - var(--cmb-scrub-ms, 0ms));
}

.cmb-root .cmb-layer {
  opacity: 0;
  animation: cmb-rise 560ms var(--cmb-ease-out) forwards;
  animation-delay: calc(var(--cmb-delay, 0ms) - var(--cmb-scrub-ms, 0ms));
}

.cmb-root .cmb-dish {
  opacity: 0;
  animation: cmb-dish-in 820ms var(--cmb-ease-out) forwards;
  animation-delay: calc(var(--cmb-delay, 0ms) - var(--cmb-scrub-ms, 0ms));
}

.cmb-root .cmb-badge {
  opacity: 0;
  animation: cmb-pulse-in 620ms var(--cmb-ease-overshoot) forwards;
  animation-delay: calc(var(--cmb-delay, 0ms) - var(--cmb-scrub-ms, 0ms));
}

.cmb-root .cmb-cta {
  opacity: 0;
  animation: cmb-rise 520ms var(--cmb-ease-out) forwards;
  animation-delay: calc(var(--cmb-delay, 0ms) - var(--cmb-scrub-ms, 0ms));
}

@keyframes cmb-paper-exit {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0deg);
    filter: blur(0);
  }
  38% {
    opacity: 0.95;
    transform: translateY(-4px) scale(1.008) rotate(0.2deg);
  }
  100% {
    opacity: 0;
    transform: translateY(-22px) scale(1.045) rotate(0.8deg);
    filter: blur(3px);
  }
}

@keyframes cmb-light-sweep {
  0% { opacity: 0; transform: translateX(-110%) skewX(-12deg); }
  20% { opacity: 0.65; }
  80% { opacity: 0.45; }
  100% { opacity: 0; transform: translateX(120%) skewX(-12deg); }
}

@keyframes cmb-phone-in {
  0% {
    opacity: 0;
    transform: scale(0.94) translateY(14px);
    filter: blur(6px);
  }
  55% {
    opacity: 1;
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
}

@keyframes cmb-rise {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes cmb-dish-in {
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.965);
    filter: blur(4px);
  }
  60% {
    opacity: 1;
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes cmb-pulse-in {
  0% { opacity: 0; transform: scale(0.82); }
  60% { transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .cmb-root[data-force-cinematic-motion="true"] .cmb-paper {
    animation: cmb-paper-exit 900ms var(--cmb-ease-soft) forwards !important;
    animation-delay: calc(240ms - var(--cmb-scrub-ms, 0ms)) !important;
    animation-play-state: paused !important;
  }

  .cmb-root[data-force-cinematic-motion="true"] .cmb-sweep {
    animation: cmb-light-sweep 1000ms var(--cmb-ease-soft) forwards !important;
    animation-delay: calc(120ms - var(--cmb-scrub-ms, 0ms)) !important;
    animation-play-state: paused !important;
  }

  .cmb-root[data-force-cinematic-motion="true"] .cmb-phone {
    animation: cmb-phone-in 760ms var(--cmb-ease-out) forwards !important;
    animation-delay: calc(720ms - var(--cmb-scrub-ms, 0ms)) !important;
    animation-play-state: paused !important;
  }

  .cmb-root[data-force-cinematic-motion="true"] .cmb-layer,
  .cmb-root[data-force-cinematic-motion="true"] .cmb-dish,
  .cmb-root[data-force-cinematic-motion="true"] .cmb-badge,
  .cmb-root[data-force-cinematic-motion="true"] .cmb-cta {
    animation-play-state: paused !important;
  }
}
`;

const NOSCRIPT_FALLBACK = `
.cmb-root .cmb-layer,
.cmb-root .cmb-dish,
.cmb-root .cmb-badge,
.cmb-root .cmb-cta,
.cmb-root .cmb-phone,
.cmb-root .cmb-ambient {
  opacity: 1 !important;
  transform: none !important;
  animation: none !important;
}
.cmb-root .cmb-paper,
.cmb-root .cmb-sweep { display: none !important; }
`;

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function computeScrollProgress(node: HTMLElement): number {
  const rect = node.getBoundingClientRect();
  const viewHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const start = viewHeight * 0.78;
  const end = viewHeight * 0.22;
  return clampProgress((start - rect.top) / (start - end));
}

function PdfPaperRow({ name, price }: { name: string; price: string }) {
  return (
    <div className="flex items-end gap-1.5 font-sans leading-none text-[#2a2118]">
      <span className="min-w-0 flex-[1_1_62%] text-[10px] leading-[1.25]">{name}</span>
      <span
        aria-hidden
        className="mb-[3px] min-w-[8px] flex-1 border-b border-dotted border-[#2a2118]/45"
      />
      <span className="shrink-0 text-[10px] font-semibold leading-none text-[#1f1810]">
        {price}
      </span>
    </div>
  );
}

function PaperMenuOverlay({
  restaurantName,
  sections
}: {
  restaurantName: string;
  sections: PdfMenuSection[];
}) {
  return (
    <div
      aria-hidden
      className="cmb-paper pointer-events-none absolute inset-x-3 top-5 z-20 mx-auto max-w-[280px] overflow-hidden rounded-[3px] bg-[#f3ece0] text-[#2a2118] shadow-[0_30px_70px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.06)] sm:inset-x-4 sm:max-w-[300px]"
    >
      <div className="px-5 pb-5 pt-6">
        <div className="text-center">
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-[#5e4a36]">
            {restaurantName}
          </p>
          <p className="mt-1 font-display text-[18px] leading-none text-[#1f1810]">
            Carte
          </p>
          <div className="mx-auto mt-1.5 h-px w-8 bg-[#5e4a36]/55" />
        </div>
        <div className="mt-3 space-y-2">
          {sections.slice(0, 3).map((section) => (
            <section key={section.title}>
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-[#5e4a36]">
                {section.title}
              </p>
              <div className="mt-1 space-y-1">
                {section.rows.slice(0, 2).map((row) => (
                  <PdfPaperRow
                    key={`${section.title}-${row.name}`}
                    name={row.name}
                    price={row.price}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function LightSweep() {
  return (
    <span
      aria-hidden
      className="cmb-sweep pointer-events-none absolute inset-y-0 left-0 z-30 w-[55%]"
      style={{
        background:
          "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(245,234,216,0.18) 36%, rgba(217,184,121,0.55) 50%, rgba(245,234,216,0.18) 64%, rgba(255,255,255,0) 100%)",
        mixBlendMode: "screen"
      }}
    />
  );
}

function AmbientSpotlight() {
  return (
    <div
      aria-hidden
      className="cmb-ambient pointer-events-none absolute inset-0 z-0"
      style={{
        background:
          "radial-gradient(ellipse 60% 50% at 50% 38%, rgba(217,184,121,0.22) 0%, rgba(217,184,121,0.08) 38%, rgba(0,0,0,0) 70%)"
      }}
    />
  );
}

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cmb-phone relative mx-auto w-full max-w-[320px] sm:max-w-[340px] lg:max-w-[360px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-[2.6rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,184,121,0.16),transparent_62%)]"
      />
      <div className="relative rounded-[2.2rem] border-[8px] border-[#141316] bg-[#0a0907] shadow-[0_36px_90px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)] ring-1 ring-champagne/10">
        <span
          aria-hidden
          className="absolute left-1/2 top-2 z-30 h-4 w-[38%] -translate-x-1/2 rounded-full bg-black/92"
        />
        <div className="relative overflow-hidden rounded-[1.65rem] bg-[#080706]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function CinematicMenuBloom({
  preview,
  className = ""
}: CinematicMenuBloomProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [scrollProgress, setScrollProgress] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const titleId = useId();
  const liveId = useId();

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const updateProgress = () => {
      rafRef.current = null;
      setScrollProgress(computeScrollProgress(node));
    };

    const scheduleUpdate = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      setScrollProgress(computeScrollProgress(node));
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const { restaurant, pdfSections } = preview;
  const scrubMs = scrollProgress * BLOOM_DURATION_MS;

  return (
    <div
      ref={rootRef}
      data-pillar-animation="menu-digital-bloom"
      data-bloom-progress={Math.round(scrollProgress * 100)}
      data-reduced-motion={reducedMotion ? "true" : undefined}
      data-force-cinematic-motion="true"
      aria-labelledby={titleId}
      aria-describedby={liveId}
      className={`cmb-root relative isolate ${className}`}
      style={{ ["--cmb-scrub-ms" as string]: `${scrubMs}ms` }}
    >
      <style dangerouslySetInnerHTML={{ __html: BLOOM_STYLES }} />
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: NOSCRIPT_FALLBACK }} />
      </noscript>

      <p id={titleId} className="sr-only">
        Animation Cinematic Menu Bloom : une carte papier devient une carte
        digitale Vistaire, structurée et désirable.
      </p>
      <p id={liveId} className="sr-only">
        Lecture cinématique liée au défilement : papier, balayage de lumière,
        écran, accueil Maison Élyse, catégories visuelles, suggestion du chef
        et appel vers toute la carte.
      </p>

      <div
        className="relative mx-auto flex w-full max-w-[420px] items-center justify-center px-2 py-4 sm:max-w-[460px] sm:py-6 lg:max-w-[480px]"
        style={{ minHeight: "min(48vh, 440px)" }}
      >
        <AmbientSpotlight />

        <div className="relative w-full">
          <PaperMenuOverlay
            restaurantName={restaurant.name}
            sections={pdfSections}
          />

          <PhoneShell>
            <LightSweep />
            <div className="relative aspect-[9/16] w-full">
              <VistaireDigitalMenuScene
                preview={preview}
                showLayerLabel={false}
                bloomLayers
              />
            </div>
          </PhoneShell>
        </div>
      </div>
    </div>
  );
}
