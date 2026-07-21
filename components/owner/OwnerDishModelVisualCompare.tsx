"use client";

import { useEffect, useRef, useState } from "react";
import { configureModelViewerAssetDecoders } from "@/components/dish/DishModelViewer";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  formatModelAssetBytes,
  normalizeModelAssetBytes
} from "@/lib/owner/modelAssetSize";

type OwnerDishModelVisualCompareProps = {
  dishName: string;
  webModel3dUrl: string;
  webModel3dBytes?: number;
  arPreviewModelUrl?: string;
  arUsdzUrl: string;
  arUsdzBytes?: number;
};

type ModelViewerDomElement = HTMLElement & {
  src?: string;
  iosSrc?: string;
};

type CompareModelViewerProps = {
  src: string;
  iosSrc?: string;
  ar?: boolean;
  orbit: string;
};

function sizeLabel(bytes: number): string {
  if (bytes > 0) return formatModelAssetBytes(bytes);
  return "Poids inconnu";
}

async function resolveAssetBytes(url: string): Promise<number> {
  if (!url) return 0;
  const response = await fetch(url, { method: "HEAD", cache: "no-store" });
  if (!response.ok) return 0;
  return normalizeModelAssetBytes(response.headers.get("content-length"));
}

function CompareModelViewer({
  src,
  iosSrc = "",
  ar = false,
  orbit
}: CompareModelViewerProps) {
  const ref = useRef<ModelViewerDomElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.setAttribute("src", src);
    node.src = src;
    if (iosSrc) {
      node.setAttribute("ios-src", iosSrc);
      node.iosSrc = iosSrc;
    } else {
      node.removeAttribute("ios-src");
      node.iosSrc = "";
    }
    if (ar) {
      node.setAttribute("ar", "");
    } else {
      node.removeAttribute("ar");
    }
  }, [ar, iosSrc, src]);

  return (
    <model-viewer
      key={`${src}:${iosSrc}:${ar ? "ar" : "web"}`}
      ref={ref}
      data-model-src={src}
      className={styles.modelCompareViewer}
      camera-controls
      interaction-prompt="none"
      disable-tap
      camera-orbit={orbit}
      loading="lazy"
      reveal="auto"
    />
  );
}

export function OwnerDishModelVisualCompare({
  dishName,
  webModel3dUrl,
  webModel3dBytes = 0,
  arPreviewModelUrl = webModel3dUrl,
  arUsdzUrl,
  arUsdzBytes = 0
}: OwnerDishModelVisualCompareProps) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [webBytes, setWebBytes] = useState(webModel3dBytes);
  const [usdzBytes, setUsdzBytes] = useState(arUsdzBytes);

  useEffect(() => {
    if (!loaded || (webBytes > 0 && usdzBytes > 0)) return;

    let active = true;
    Promise.all([
      webBytes > 0 ? Promise.resolve(webBytes) : resolveAssetBytes(webModel3dUrl),
      usdzBytes > 0 ? Promise.resolve(usdzBytes) : resolveAssetBytes(arUsdzUrl)
    ])
      .then(([nextWebBytes, nextUsdzBytes]) => {
        if (!active) return;
        if (nextWebBytes > 0) setWebBytes(nextWebBytes);
        if (nextUsdzBytes > 0) setUsdzBytes(nextUsdzBytes);
      })
      .catch(() => {
        // Keep the explicit "Poids inconnu" label when a CDN does not expose Content-Length.
      });

    return () => {
      active = false;
    };
  }, [arUsdzUrl, loaded, usdzBytes, webBytes, webModel3dUrl]);

  async function loadViewer() {
    setLoading(true);
    try {
      configureModelViewerAssetDecoders();
      await import("@google/model-viewer");
      configureModelViewerAssetDecoders();
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.modelCompareCard} aria-label={`Comparaison 3D ${dishName}`}>
      <div className={styles.pipelineSectionTitleRow}>
        <div>
          <p className={styles.sourceUploadEyebrow}>{dishName}</p>
          <h3 className={styles.panelTitle}>GLB web / USDZ AR</h3>
        </div>
        {!loaded ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSmall}`}
            disabled={loading}
            onClick={() => void loadViewer()}
          >
            {loading ? "Chargement..." : "Voir comparaison"}
          </button>
        ) : null}
      </div>

      {loaded ? (
        <div className={styles.modelCompareGrid}>
          <div className={styles.modelComparePane}>
            <div className={styles.modelCompareHeader}>
              <span>GLB web</span>
              <a href={webModel3dUrl} target="_blank" rel="noreferrer">
                Ouvrir GLB · {sizeLabel(webBytes)}
              </a>
            </div>
            <CompareModelViewer
              src={webModel3dUrl}
              orbit="-32deg 68deg auto"
            />
          </div>

          <div className={styles.modelComparePane}>
            <div className={styles.modelCompareHeader}>
              <span>USDZ AR</span>
              <a href={arUsdzUrl} target="_blank" rel="noreferrer">
                Ouvrir USDZ · {sizeLabel(usdzBytes)}
              </a>
            </div>
            <CompareModelViewer
              src={arPreviewModelUrl}
              iosSrc={arUsdzUrl}
              ar
              orbit="32deg 68deg auto"
            />
          </div>
        </div>
      ) : (
        <div className={styles.modelComparePlaceholder}>
          <p>Comparaison disponible apres chargement explicite du viewer.</p>
        </div>
      )}

      <p className={styles.sourceTag}>
        Le navigateur affiche l&apos;apercu via GLB; le fichier USDZ est le paquet AR servi a iOS Quick Look.
      </p>
    </section>
  );
}
