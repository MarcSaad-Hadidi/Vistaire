"use client";

import { useEffect, useRef, useState } from "react";
import { configureModelViewerAssetDecoders } from "@/components/dish/DishModelViewer";
import styles from "@/components/owner/OwnerCockpit.module.css";

type OwnerDishModelVisualCompareProps = {
  dishName: string;
  webModel3dUrl: string;
  arPreviewModelUrl?: string;
  arUsdzUrl: string;
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
      ref={ref}
      data-model-src={src}
      className={styles.modelCompareViewer}
      camera-controls
      interaction-prompt="none"
      disable-tap
      camera-orbit={orbit}
      loading="eager"
      reveal="auto"
    />
  );
}

export function OwnerDishModelVisualCompare({
  dishName,
  webModel3dUrl,
  arPreviewModelUrl = webModel3dUrl,
  arUsdzUrl
}: OwnerDishModelVisualCompareProps) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

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
                Ouvrir GLB
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
                Ouvrir USDZ
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
