"use client";

import Link from "next/link";
import { createElement, useEffect, useState } from "react";
import { configureModelViewerAssetDecoders } from "@/components/dish/DishModelViewer";

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
  glbPreviewUrl?: string;
  note?: string;
};

const GLB_ASSETS: GlbAsset[] = [
  {
    id: "source-draco",
    label: "GLB principal — Draco (Meshy compressed)",
    role: "model3dUrl",
    path: "public/models/demo/homard-bisque-meshy.glb",
    sizeMb: "3,4 Mo",
    modelUrl: "/models/demo/homard-bisque-meshy.glb",
    note: "Source 3D Plat/Homard bleu Meshy.compressed.glb — Android / fallback web"
  },
  {
    id: "web-meshopt",
    label: "GLB web — Meshopt",
    role: "webModel3dUrl",
    path: "public/models/demo/homard-bisque-meshopt-ee44bc60.glb",
    sizeMb: "4,7 Mo",
    modelUrl: "/models/demo/homard-bisque-meshopt-ee44bc60.glb",
    note: "Variante chargée par le viewer desktop après clic « Voir en 3D »"
  },
  {
    id: "ar-lite",
    label: "GLB AR-lite",
    role: "arModel3dUrl",
    path: "public/models/demo/ar-lite/homard-bisque-ar-lite-meshy.glb",
    sizeMb: "8,2 Mo",
    modelUrl: "/models/demo/ar-lite/homard-bisque-ar-lite-meshy.glb",
    note: "Scene Viewer Android — simplifié pour l’AR"
  }
];

const USDZ_ASSETS: UsdzAsset[] = [
  {
    id: "ios-ultra",
    label: "USDZ iPhone Quick Look (ultra)",
    role: "arUsdzUrl",
    path: "public/models/demo/ar-lite/homard-bisque-ios-quicklook-meshy.usdz",
    sizeMb: "2,3 Mo",
    usdzUrl: "/models/demo/ar-lite/homard-bisque-ios-quicklook-meshy.usdz",
    glbPreviewUrl: "/models/demo/ar-lite/homard-bisque-ar-lite-meshy.glb",
    note: "Production iOS AR — promu depuis le pipeline ultra"
  },
  {
    id: "source-usdz",
    label: "USDZ source (legacy, inchangé sur main)",
    role: "usdzUrl",
    path: "public/models/demo/homard-bisque.usdz",
    sizeMb: "~25 Mo",
    usdzUrl: "/models/demo/homard-bisque.usdz",
    glbPreviewUrl: "/models/demo/homard-bisque-meshy.glb",
    note: "Grandfather asset conservé tel quel — pas régénéré avec le nouveau GLB. Quick Look iPhone = ultra ci-dessus."
  }
];

const MODEL_FRAME_CLASS =
  "h-[min(58vh,420px)] min-h-[280px] w-full rounded-xl bg-[#10100e] ring-1 ring-white/8 sm:h-[min(65vh,460px)] sm:min-h-[340px]";

function ModelPane({ asset }: { asset: GlbAsset }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

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
  }, []);

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
          href={asset.modelUrl}
          className="mt-3 inline-block text-xs text-champagne underline-offset-2 hover:underline"
          download
        >
          Télécharger le GLB
        </a>
      </div>

      <div className="relative mx-auto w-full max-w-lg">
        {ready ? (
          createElement("model-viewer", {
            src: asset.modelUrl,
            alt: `Vue 3D — ${asset.label}`,
            "camera-controls": true,
            "auto-rotate": true,
            "shadow-intensity": "1",
            exposure: "1.05",
            loading: "eager",
            reveal: "auto",
            "touch-action": "none",
            "camera-orbit": "0deg 68deg 145%",
            "camera-target": "0m 0.015m 0m",
            "field-of-view": "34deg",
            "min-camera-orbit": "auto auto 65%",
            "max-camera-orbit": "auto auto 175%",
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
  }, []);

  const previewUrl = asset.glbPreviewUrl ?? asset.usdzUrl;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#10100e]/80 p-4 sm:p-5">
      <div className="mb-4 border-b border-white/8 pb-4">
        <h2 className="font-display text-xl text-cream">{asset.label}</h2>
        <p className="mt-1 font-mono text-xs text-champagne/90">{asset.path}</p>
        <p className="mt-1 text-sm text-[#d8caba]">
          Rôle <span className="text-cream">{asset.role}</span> · {asset.sizeMb}
        </p>
        {asset.note ? <p className="mt-2 text-sm leading-relaxed text-[#a89882]">{asset.note}</p> : null}
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a href={asset.usdzUrl} className="text-champagne underline-offset-2 hover:underline" download>
            Télécharger l’USDZ
          </a>
          {asset.glbPreviewUrl ? (
            <span className="text-[#a89882]">Aperçu GLB associé ci-dessous</span>
          ) : null}
        </div>
      </div>

      {asset.glbPreviewUrl && ready ? (
        <div className="relative mx-auto w-full max-w-lg">
          {createElement("model-viewer", {
            src: previewUrl,
            "ios-src": asset.usdzUrl,
            alt: `AR — ${asset.label}`,
            "camera-controls": true,
            "auto-rotate": true,
            "ar": true,
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
        <p className="text-sm text-[#a89882]">Fichier USDZ uniquement — ouvrir sur iOS ou télécharger.</p>
      )}
    </section>
  );
}

export default function HomardProductionReviewPage() {
  return (
    <main className="min-h-screen bg-[#070605] px-4 py-8 text-cream sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-champagne/80">Revu local — rebuild homard</p>
        <h1 className="mt-2 font-display text-2xl text-cream sm:text-3xl">
          Tous les fichiers homard générés
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d8caba]">
          Aperçu des assets de production créés ou régénérés depuis{" "}
          <span className="text-cream">3D Plat/Homard bleu Meshy.compressed.glb</span>. Comparez chaque
          variante avant de valider sur la fiche plat démo.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="/demo/dishes/homard-bisque"
            className="rounded-full border border-champagne/40 px-4 py-2 text-champagne transition hover:bg-champagne/10"
          >
            Fiche plat démo
          </Link>
          <Link
            href="/dev/meshy-dishes-review"
            className="rounded-full border border-white/15 px-4 py-2 text-[#d8caba] transition hover:bg-white/5"
          >
            Revue plats Meshy
          </Link>
          <Link
            href="/dev/souffle-production-review"
            className="rounded-full border border-white/15 px-4 py-2 text-[#d8caba] transition hover:bg-white/5"
          >
            Revue soufflé
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
          <h2 className="mb-6 font-display text-lg text-champagne">Fichiers USDZ</h2>
          <div className="flex flex-col gap-10">
            {USDZ_ASSETS.map((asset) => (
              <div key={asset.id} id={asset.id}>
                <UsdzPane asset={asset} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
