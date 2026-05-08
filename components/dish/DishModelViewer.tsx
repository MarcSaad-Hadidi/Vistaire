"use client";

import Script from "next/script";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import type { Dish } from "@/lib/demoMenuData";

const MODEL_VIEWER_CDN =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

const MV_INIT_TIMEOUT_MS = 12_000;

type DishModelViewerProps = {
  dish: Pick<Dish, "name" | "model3dUrl" | "usdzUrl">;
  /** Chrome minimal : titres et aide fournis par le parent si besoin. */
  minimalChrome?: boolean;
};

function modelViewerDefined(): boolean {
  return typeof window !== "undefined" && Boolean(customElements.get("model-viewer"));
}

async function ensureModelViewer(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (customElements.get("model-viewer")) return true;
  await customElements.whenDefined("model-viewer");
  return true;
}

export function DishModelViewer({
  dish,
  minimalChrome = false
}: DishModelViewerProps) {
  const titleId = useId();
  const [mvReady, setMvReady] = useState(() => modelViewerDefined());
  const [initTimedOut, setInitTimedOut] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(false);
  const loadWatchRef = useRef<HTMLElement | null>(null);
  const hasModel = Boolean(dish.model3dUrl?.trim());
  const modelSrc = useMemo(() => dish.model3dUrl?.trim() ?? "", [dish.model3dUrl]);

  const handleScriptLoad = useCallback(() => {
    void ensureModelViewer().then(() => setMvReady(true));
  }, []);

  /** Détection lecteur : microtask évite setState synchrone dans l’effet (eslint). */
  useEffect(() => {
    if (!hasModel) return;
    let alive = true;
    queueMicrotask(() => {
      if (alive && modelViewerDefined()) setMvReady(true);
    });
    void ensureModelViewer().then(() => {
      if (alive) setMvReady(true);
    });
    return () => {
      alive = false;
    };
  }, [hasModel]);

  /** Ne pas rester bloqué indéfiniment si le lecteur ne s’initialise pas */
  useEffect(() => {
    if (!hasModel || mvReady) return;
    const t = window.setTimeout(() => setInitTimedOut(true), MV_INIT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [hasModel, mvReady]);

  /** Listeners chargement mesh : ref posée après le commit React */
  useEffect(() => {
    if (!hasModel || !mvReady) return;
    let teardown: (() => void) | undefined;
    const wait = window.setTimeout(() => {
      const el = loadWatchRef.current;
      if (!el) return;
      const onMvError = () => setModelLoadError(true);
      const onMvLoad = () => setModelLoadError(false);
      el.addEventListener("error", onMvError);
      el.addEventListener("load", onMvLoad);
      teardown = () => {
        el.removeEventListener("error", onMvError);
        el.removeEventListener("load", onMvLoad);
      };
    }, 0);
    return () => {
      window.clearTimeout(wait);
      teardown?.();
    };
  }, [hasModel, mvReady, modelSrc]);

  if (!hasModel) {
    return (
      <section
        className="overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-[#14100c] via-[#0f0b08] to-[#080706] shadow-inner"
        aria-labelledby={titleId}
      >
        <div className="flex min-h-[200px] flex-col items-center justify-center px-5 py-10 text-center sm:min-h-[240px]">
          <div
            className="mb-5 h-20 w-20 rounded-2xl border border-dashed border-champagne/28 bg-black/40 shadow-[inset_0_0_36px_rgba(217,184,121,0.05)]"
            aria-hidden
          />
          <p
            id={titleId}
            className="max-w-md font-display text-base leading-relaxed text-[#d8caba] sm:text-lg"
          >
            Ce plat sera bientôt disponible en 3D.
          </p>
        </div>
      </section>
    );
  }

  const showLoader = !mvReady && !initTimedOut;
  const showInitFail = !mvReady && initTimedOut;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/[0.14] bg-gradient-to-b from-[#14100c] to-[#070605] p-3 shadow-[inset_0_1px_0_rgba(217,184,121,0.08)] transition-opacity duration-300 sm:p-4"
      aria-labelledby={minimalChrome ? undefined : titleId}
    >
      <Script
        id="model-viewer-cdn"
        src={MODEL_VIEWER_CDN}
        type="module"
        strategy="afterInteractive"
        onReady={handleScriptLoad}
        onLoad={handleScriptLoad}
      />
      {!minimalChrome ? (
        <div className="mb-2 text-center sm:mb-3">
          <h3 id={titleId} className="font-display text-lg text-cream sm:text-xl">
            {dish.name}
          </h3>
        </div>
      ) : null}

      <div className="relative mx-auto w-full max-w-lg">
        {showLoader ? (
          <div
            className="flex h-[min(65vh,460px)] w-full animate-pulse items-center justify-center rounded-xl bg-[#10100e] ring-1 ring-white/8"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="text-sm text-[#9a8b78]">Chargement…</span>
          </div>
        ) : showInitFail ? (
          <div className="flex min-h-[min(65vh,460px)] w-full flex-col items-center justify-center gap-3 rounded-xl bg-[#10100e] px-6 text-center text-sm text-[#c4a892] ring-1 ring-white/8">
            <p>Affichage impossible pour le moment.</p>
            <p className="text-xs text-[#7d6e5c]">Actualisez la page.</p>
          </div>
        ) : (
          <>
            <model-viewer
              ref={loadWatchRef}
              src={modelSrc}
              {...(dish.usdzUrl?.trim() ? { "ios-src": dish.usdzUrl.trim() } : {})}
              alt={`Vue du plat : ${dish.name}`}
              camera-controls
              auto-rotate
              ar
              ar-modes="webxr scene-viewer quick-look"
              shadow-intensity="1"
              exposure="1.05"
              loading="auto"
              className="mx-auto block h-[min(65vh,460px)] w-full rounded-xl bg-[#10100e] ring-1 ring-white/8"
            />
            {modelLoadError ? (
              <p className="mt-2 text-center text-xs text-[#c49a84]">
                Le modèle ne s’affiche pas. Réessayez dans un instant.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
