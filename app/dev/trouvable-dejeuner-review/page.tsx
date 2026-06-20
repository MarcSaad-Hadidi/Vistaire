"use client";

import Link from "next/link";
import { createElement, useEffect, useState } from "react";
import { configureModelViewerAssetDecoders } from "@/components/dish/DishModelViewer";

const BASE =
  "/models/restaurants/trouvable/principal/dejeuner-classique-maison/meshy-20260620";

type GlbAsset = {
  id: string;
  label: string;
  role: string;
  path: string;
  sizeMb: string;
  modelUrl: string;
  note?: string;
};

type UsdzAsset = {
  id: string;
  label: string;
  role: string;
  path: string;
  sizeMb: string;
  usdzUrl: string;
  glbPreviewUrl: string;
  note?: string;
};

const GLB_ASSETS: GlbAsset[] = [
  {
    id: "source-draco",
    label: "GLB principal — Draco (Meshy compressed)",
    role: "model3dUrl",
    path: `${BASE}/dejeuner-classique-maison-meshy.glb`,
    sizeMb: "382 Ko",
    modelUrl: `${BASE}/dejeuner-classique-maison-meshy.glb`,
    note: "Source 3D Plat/DejeunerMeshyCompresser.glb"
  },
  {
    id: "web-meshopt",
    label: "GLB web — Meshopt",
    role: "webModel3dUrl",
    path: `${BASE}/dejeuner-classique-maison-meshopt-576a9e99.glb`,
    sizeMb: "531 Ko",
    modelUrl: `${BASE}/dejeuner-classique-maison-meshopt-576a9e99.glb`,
    note: "Variante chargée par le viewer après clic « Voir en 3D »"
  },
  {
    id: "ar-lite",
    label: "GLB AR-lite",
    role: "arModel3dUrl",
    path: `${BASE}/ar-lite/dejeuner-classique-maison-ar-lite-meshy.glb`,
    sizeMb: "1,6 Mo",
    modelUrl: `${BASE}/ar-lite/dejeuner-classique-maison-ar-lite-meshy.glb`,
    note: "Scene Viewer Android — simplifié pour l’AR"
  }
];

const USDZ_ASSET: UsdzAsset = {
  id: "ios-quicklook",
  label: "USDZ iPhone Quick Look (meshy)",
  role: "arUsdzUrl",
  path: `${BASE}/ar-lite/dejeuner-classique-maison-ios-quicklook-meshy.usdz`,
  sizeMb: "637 Ko",
  usdzUrl: `${BASE}/ar-lite/dejeuner-classique-maison-ios-quicklook-meshy.usdz`,
  glbPreviewUrl: `${BASE}/ar-lite/dejeuner-classique-maison-ar-lite-meshy.glb`,
  note: "Production iOS AR — « Afficher devant moi » sur iPhone"
};

const PREVIEW_CACHE_BUST = "meshy-20260620";

function previewAssetUrl(url: string): string {
  return `${url}?v=${PREVIEW_CACHE_BUST}`;
}

const MODEL_FRAME_CLASS =
  "h-[min(58vh,420px)] min-h-[280px] w-full rounded-xl bg-[#10100e] ring-1 ring-white/8 sm:h-[min(65vh,460px)] sm:min-h-[340px]";

function ModelPane({ asset }: { asset: GlbAsset }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const modelUrl = previewAssetUrl(asset.modelUrl);

  useEffect(() => {
    let cancelled = false;
    configureModelViewerAssetDecoders();
    void import("@google/model-viewer").then(() => {
      configureModelViewerAssetDecoders();
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#10100e]/80 p-4 sm:p-5">
      <div className="mb-4 border-b border-white/8 pb-4">
        <h2 className="font-display text-xl text-cream">{asset.label}</h2>
        <p className="mt-1 font-mono text-xs text-champagne/90">{asset.path}</p>
        <p className="mt-1 text-sm text-[#d8caba]">
          Rôle <span className="text-cream">{asset.role}</span> · {asset.sizeMb}
        </p>
        {asset.note ? <p className="mt-2 text-sm leading-relaxed text-[#a89882]">{asset.note}</p> : null}
        <a
          href={modelUrl}
          className="mt-3 inline-block text-xs text-champagne underline-offset-2 hover:underline"
          download
        >
          Télécharger le GLB
        </a>
      </div>

      <div className="relative mx-auto w-full max-w-lg">
        {ready ? (
          createElement("model-viewer", {
            key: modelUrl,
            src: modelUrl,
            alt: `Vue 3D — ${asset.label}`,
            "camera-controls": true,
            "auto-rotate": true,
            "shadow-intensity": "1",
            exposure: "1.05",
            loading: "eager",
            reveal: "auto",
            "touch-action": "none",
            className: `mx-auto block touch-none ${MODEL_FRAME_CLASS}`,
            onLoad: () => setStatus("loaded"),
            onError: () => setStatus("error")
          })
        ) : (
          <div className={MODEL_FRAME_CLASS} aria-hidden />
        )}

        {status === "loading" ? (
          <p className="absolute inset-x-0 bottom-3 text-center text-xs text-[#a89882]">
            Chargement du modèle…
          </p>
        ) : null}
        {status === "error" ? (
          <p className="absolute inset-x-0 bottom-3 text-center text-xs text-red-300">
            Échec de chargement — vérifier Draco / Meshopt dans la console.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function UsdzPane({ asset }: { asset: UsdzAsset }) {
  const [ready, setReady] = useState(false);
  const previewUrl = previewAssetUrl(asset.glbPreviewUrl);
  const usdzUrl = previewAssetUrl(asset.usdzUrl);

  useEffect(() => {
    let cancelled = false;
    configureModelViewerAssetDecoders();
    void import("@google/model-viewer").then(() => {
      configureModelViewerAssetDecoders();
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [previewUrl, usdzUrl]);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#10100e]/80 p-4 sm:p-5">
      <div className="mb-4 border-b border-white/8 pb-4">
        <h2 className="font-display text-xl text-cream">{asset.label}</h2>
        <p className="mt-1 font-mono text-xs text-champagne/90">{asset.path}</p>
        <p className="mt-1 text-sm text-[#d8caba]">
          Rôle <span className="text-cream">{asset.role}</span> · {asset.sizeMb}
        </p>
        {asset.note ? <p className="mt-2 text-sm leading-relaxed text-[#a89882]">{asset.note}</p> : null}
        <a href={usdzUrl} className="mt-3 inline-block text-xs text-champagne underline-offset-2 hover:underline" download>
          Télécharger l’USDZ
        </a>
      </div>

      {ready ? (
        <div className="relative mx-auto w-full max-w-lg">
          {createElement("model-viewer", {
            key: previewUrl,
            src: previewUrl,
            "ios-src": usdzUrl,
            alt: `AR — ${asset.label}`,
            "camera-controls": true,
            "auto-rotate": true,
            ar: true,
            "ar-modes": "quick-look",
            "shadow-intensity": "1",
            exposure: "1.05",
            loading: "eager",
            className: `mx-auto block touch-none ${MODEL_FRAME_CLASS}`
          })}
          <p className="mt-3 text-center text-xs text-[#a89882]">
            Sur iPhone : bouton AR pour ouvrir l’USDZ en Quick Look.
          </p>
        </div>
      ) : (
        <div className={MODEL_FRAME_CLASS} aria-hidden />
      )}
    </section>
  );
}

export default function TrouvableDejeunerReviewPage() {
  return (
    <main className="min-h-screen bg-[#070605] px-4 py-8 text-cream sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-champagne/80">Revue locale — Trouvable</p>
        <h1 className="mt-2 font-display text-2xl text-cream sm:text-3xl">
          Déjeuner classique maison — pipeline Meshy
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d8caba]">
          Aperçu des assets owner générés depuis{" "}
          <span className="text-cream">3D Plat/DejeunerMeshyCompresser.glb</span> pour le restaurant
          Trouvable.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="/menu/trouvable/dishes/dejeuner-classique-maison"
            className="rounded-full border border-champagne/40 px-4 py-2 text-champagne transition hover:bg-champagne/10"
          >
            Fiche plat Trouvable
          </Link>
          <Link
            href="/menu/trouvable"
            className="rounded-full border border-white/15 px-4 py-2 text-[#d8caba] transition hover:bg-white/5"
          >
            Menu Trouvable
          </Link>
          <Link
            href="/dev/meshy-dishes-review"
            className="rounded-full border border-white/15 px-4 py-2 text-[#d8caba] transition hover:bg-white/5"
          >
            Revue plats Meshy démo
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-10">
        <div>
          <h2 className="mb-6 font-display text-lg text-champagne">Fichiers GLB</h2>
          <div className="flex flex-col gap-10">
            {GLB_ASSETS.map((asset) => (
              <div key={asset.id} id={asset.id}>
                <ModelPane asset={asset} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-6 font-display text-lg text-champagne">USDZ Quick Look</h2>
          <UsdzPane asset={USDZ_ASSET} />
        </div>
      </div>
    </main>
  );
}
