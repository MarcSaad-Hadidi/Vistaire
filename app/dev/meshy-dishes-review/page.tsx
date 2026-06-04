"use client";

import Link from "next/link";
import { createElement, useEffect, useState } from "react";
import { configureModelViewerAssetDecoders } from "@/components/dish/DishModelViewer";

type DishReview = {
  slug: string;
  title: string;
  sourceFile: string;
  demoHref: string;
  glb: { label: string; url: string; sizeMb: string }[];
  usdz?: { label: string; url: string; previewGlb: string; sizeMb: string };
};

const DISHES: DishReview[] = [
  {
    slug: "ravioles-romarin",
    title: "Ravioles de chèvre & miel",
    sourceFile: "3D Plat/RavioleMeshyCompresser",
    demoHref: "/demo/dishes/ravioles-romarin",
    glb: [
      { label: "GLB Draco (meshy)", url: "/models/demo/ravioles-chevre-miel-meshy.glb", sizeMb: "2,7 Mo" },
      {
        label: "GLB web Meshopt",
        url: "/models/demo/ravioles-chevre-miel-meshopt-8a28933e.glb",
        sizeMb: "3,3 Mo"
      },
      {
        label: "GLB AR-lite",
        url: "/models/demo/ar-lite/ravioles-chevre-miel-ar-lite-meshy.glb",
        sizeMb: "7,7 Mo"
      }
    ],
    usdz: {
      label: "USDZ Quick Look iPhone",
      url: "/models/demo/ar-lite/ravioles-chevre-miel-ios-quicklook-meshy.usdz",
      previewGlb: "/models/demo/ar-lite/ravioles-chevre-miel-ar-lite-meshy.glb",
      sizeMb: "3,3 Mo"
    }
  },
  {
    slug: "canette-aux-figues",
    title: "Canette rôtie aux figues",
    sourceFile: "3D Plat/RotiMeshyCompresser",
    demoHref: "/demo/dishes/canette-aux-figues",
    glb: [
      { label: "GLB Draco (meshy)", url: "/models/demo/canette-aux-figues-meshy.glb", sizeMb: "2,7 Mo" },
      {
        label: "GLB web Meshopt",
        url: "/models/demo/canette-aux-figues-meshopt-d54f097e.glb",
        sizeMb: "3,4 Mo"
      },
      {
        label: "GLB AR-lite",
        url: "/models/demo/ar-lite/canette-aux-figues-ar-lite-meshy.glb",
        sizeMb: "7,4 Mo"
      }
    ],
    usdz: {
      label: "USDZ Quick Look iPhone",
      url: "/models/demo/ar-lite/canette-aux-figues-ios-quicklook-meshy.usdz",
      previewGlb: "/models/demo/ar-lite/canette-aux-figues-ar-lite-meshy.glb",
      sizeMb: "1,7 Mo"
    }
  },
  {
    slug: "bar-ligne",
    title: "Bar de ligne",
    sourceFile: "3D Plat/LigneMeshyCompresser",
    demoHref: "/demo/dishes/bar-ligne",
    glb: [
      { label: "GLB Draco (meshy)", url: "/models/demo/bar-de-ligne-meshy.glb", sizeMb: "1,9 Mo" },
      {
        label: "GLB web Meshopt",
        url: "/models/demo/bar-de-ligne-meshopt-e67c9019.glb",
        sizeMb: "2,7 Mo"
      },
      {
        label: "GLB AR-lite",
        url: "/models/demo/ar-lite/bar-de-ligne-ar-lite-meshy.glb",
        sizeMb: "5,3 Mo"
      }
    ],
    usdz: {
      label: "USDZ Quick Look iPhone",
      url: "/models/demo/ar-lite/bar-de-ligne-ios-quicklook-meshy.usdz",
      previewGlb: "/models/demo/ar-lite/bar-de-ligne-ar-lite-meshy.glb",
      sizeMb: "1,3 Mo"
    }
  },
  {
    slug: "pave-boeuf",
    title: "Pavé de bœuf maturé",
    sourceFile: "3D Plat/BoeufMeshyCompresser",
    demoHref: "/demo/dishes/pave-boeuf",
    glb: [
      { label: "GLB Draco (meshy)", url: "/models/demo/pave-boeuf-meshy.glb", sizeMb: "1,6 Mo" },
      {
        label: "GLB web Meshopt",
        url: "/models/demo/pave-boeuf-meshopt-9e10c3a6.glb",
        sizeMb: "1,8 Mo"
      },
      {
        label: "GLB AR-lite",
        url: "/models/demo/ar-lite/pave-boeuf-ar-lite-meshy.glb",
        sizeMb: "4,3 Mo"
      }
    ],
    usdz: {
      label: "USDZ Quick Look iPhone",
      url: "/models/demo/ar-lite/pave-boeuf-ios-quicklook-meshy.usdz",
      previewGlb: "/models/demo/ar-lite/pave-boeuf-ar-lite-meshy.glb",
      sizeMb: "1,0 Mo"
    }
  },
  {
    slug: "souffle-chocolat",
    title: "Soufflé chocolat",
    sourceFile: "3D Plat/SouffleMeshyCompresser",
    demoHref: "/demo/dishes/souffle-chocolat",
    glb: [
      { label: "GLB Draco (meshy)", url: "/models/demo/souffle-chocolat-meshy.glb", sizeMb: "1,6 Mo" },
      {
        label: "GLB web Meshopt",
        url: "/models/demo/souffle-chocolat-meshopt-0ad050af.glb",
        sizeMb: "1,8 Mo"
      },
      {
        label: "GLB AR-lite",
        url: "/models/demo/ar-lite/souffle-chocolat-ar-lite-meshy.glb",
        sizeMb: "4,5 Mo"
      }
    ],
    usdz: {
      label: "USDZ Quick Look iPhone",
      url: "/models/demo/ar-lite/souffle-chocolat-ios-quicklook-meshy.usdz",
      previewGlb: "/models/demo/ar-lite/souffle-chocolat-ar-lite-meshy.glb",
      sizeMb: "1,7 Mo"
    }
  }
];

const MODEL_FRAME_CLASS =
  "h-[min(50vh,380px)] min-h-[260px] w-full rounded-xl bg-[#10100e] ring-1 ring-white/8";

function ModelViewerPane({
  src,
  iosSrc,
  label
}: {
  src: string;
  iosSrc?: string;
  label: string;
}) {
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

  if (!ready) {
    return <div className={MODEL_FRAME_CLASS} aria-hidden />;
  }

  return createElement("model-viewer", {
    src,
    ...(iosSrc ? { "ios-src": iosSrc, ar: true, "ar-modes": "quick-look" } : {}),
    alt: label,
    "camera-controls": true,
    "auto-rotate": true,
    "shadow-intensity": "1",
    exposure: "1.05",
    loading: "eager",
    className: `mx-auto block touch-none ${MODEL_FRAME_CLASS}`
  });
}

export default function MeshyDishesReviewPage() {
  const [activeSlug, setActiveSlug] = useState(DISHES[0].slug);
  const dish = DISHES.find((entry) => entry.slug === activeSlug) ?? DISHES[0];

  return (
    <main className="min-h-screen bg-[#070605] px-4 py-8 text-cream sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.18em] text-champagne/80">Revue locale — Meshy</p>
        <h1 className="mt-2 font-display text-2xl text-cream sm:text-3xl">
          Nouveaux plats 3D (5 sources 3D Plat)
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d8caba]">
          Comparez preview web, AR-lite et Quick Look iPhone pour chaque plat reconstruit depuis les
          fichiers Meshy compressés du 4 juin 2026.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="/dev/homard-production-review"
            className="rounded-full border border-white/15 px-4 py-2 text-[#d8caba] transition hover:bg-white/5"
          >
            Revue homard
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {DISHES.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              onClick={() => setActiveSlug(entry.slug)}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                entry.slug === activeSlug
                  ? "bg-champagne/20 text-champagne ring-1 ring-champagne/40"
                  : "border border-white/10 text-[#d8caba] hover:bg-white/5"
              }`}
            >
              {entry.title}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-[#10100e]/80 p-5">
        <h2 className="font-display text-xl text-cream">{dish.title}</h2>
        <p className="mt-1 font-mono text-xs text-champagne/90">{dish.sourceFile}</p>
        <Link
          href={dish.demoHref}
          className="mt-4 inline-block rounded-full border border-champagne/40 px-4 py-2 text-sm text-champagne transition hover:bg-champagne/10"
        >
          Fiche plat démo
        </Link>

        <div className="mt-8 flex flex-col gap-8">
          {dish.glb.map((asset) => (
            <section key={asset.url}>
              <h3 className="text-sm text-champagne">
                {asset.label} · {asset.sizeMb}
              </h3>
              <p className="mt-1 font-mono text-[10px] text-[#a89882]">{asset.url}</p>
              <div className="mt-3">
                <ModelViewerPane src={asset.url} label={asset.label} />
              </div>
            </section>
          ))}
          {dish.usdz ? (
            <section>
              <h3 className="text-sm text-champagne">
                {dish.usdz.label} · {dish.usdz.sizeMb}
              </h3>
              <p className="mt-1 font-mono text-[10px] text-[#a89882]">{dish.usdz.url}</p>
              <div className="mt-3">
                <ModelViewerPane
                  src={dish.usdz.previewGlb}
                  iosSrc={dish.usdz.url}
                  label={dish.usdz.label}
                />
              </div>
              <p className="mt-2 text-xs text-[#a89882]">
                Aperçu AR-lite + Quick Look sur iPhone (même base visuelle que « Afficher devant moi »).
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
