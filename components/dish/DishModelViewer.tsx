"use client";

import Script from "next/script";
import { useId, useState } from "react";
import type { Dish } from "@/lib/demoMenuData";

const MODEL_VIEWER_CDN =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";

type DishModelViewerProps = {
  dish: Pick<Dish, "name" | "model3dUrl" | "usdzUrl">;
};

export function DishModelViewer({ dish }: DishModelViewerProps) {
  const titleId = useId();
  const [scriptReady, setScriptReady] = useState(false);
  const hasModel = Boolean(dish.model3dUrl?.trim());

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
          <h3
            id={titleId}
            className="font-display text-lg text-cream sm:text-xl"
          >
            Aperçu 3D
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#b9aa94]">
            Modèle 3D bientôt disponible pour ce plat signature.
          </p>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-[#7a6c5c]">
            La structure technique est prête pour l’ajout de fichiers GLB /
            USDZ — aucun modèle n’est chargé sur cet appareil pour cette démo.
          </p>
          <p className="mt-6 text-[10px] uppercase tracking-[0.22em] text-white/35">
            Prêt pour GLB / USDZ
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-white/12 bg-[#0a0806] p-3 sm:p-4"
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className="sr-only">
        Modèle 3D — {dish.name}
      </h3>
      <Script
        id="model-viewer-module"
        src={MODEL_VIEWER_CDN}
        type="module"
        strategy="lazyOnload"
        onLoad={() => setScriptReady(true)}
      />
      {scriptReady ? (
        <model-viewer
          src={dish.model3dUrl}
          {...(dish.usdzUrl?.trim() ? { "ios-src": dish.usdzUrl.trim() } : {})}
          alt={`Modèle 3D de ${dish.name}`}
          camera-controls
          auto-rotate
          ar
          ar-modes="webxr scene-viewer quick-look"
          shadow-intensity="1"
          exposure="1"
          className="mx-auto h-[min(65vh,420px)] w-full max-w-lg rounded-xl bg-[#14100c]"
        />
      ) : (
        <div className="flex h-[min(65vh,420px)] w-full items-center justify-center rounded-xl bg-[#14100c] text-sm text-[#9a8b78]">
          Initialisation du lecteur 3D…
        </div>
      )}
      <p className="mt-3 text-center text-xs text-[#8a7b68]">
        Contrôlez la vue au doigt · La réalité augmentée dépend du navigateur et
        de l’appareil.
      </p>
    </section>
  );
}
