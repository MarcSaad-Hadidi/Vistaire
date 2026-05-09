"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import type { Dish } from "@/lib/demoMenuData";
import {
  getArUnavailableMessage,
  isBraveUserAgent,
  isIosDevice,
  isIosEmbeddedBrowser,
  type ArUnavailableVariant
} from "@/lib/arEnvironment";
import { openSystemBrowserHandoffForAr } from "@/lib/openSystemBrowser";

const MV_INIT_TIMEOUT_MS = 12_000;
const AR_HELP_TEXT =
  "Placez le plat sur votre table avec la cam\u00e9ra de votre t\u00e9l\u00e9phone.";
const IOS_USDZ_MISSING_TEXT =
  "Pour activer l\u2019AR iPhone, ajoutez un fichier USDZ \u00e0 ce plat.";

export type ArRequestStatus =
  | "launched"
  /** Lecteur ou mod\u00e8le pas pr\u00eat : l\u2019utilisateur doit utiliser le bouton dans le viewer. */
  | "deferred"
  /** AR indisponible sur cet appareil / navigateur. */
  | "unsupported"
  /** iOS sans fichier USDZ. */
  | "missing-ios-src";

type DishModelViewerProps = {
  dish: Pick<Dish, "name" | "model3dUrl" | "usdzUrl">;
  /** Chrome minimal : titres et aide fournis par le parent si besoin. */
  minimalChrome?: boolean;
};

export type DishModelViewerHandle = {
  requestAr: () => ArRequestStatus;
};

async function ensureModelViewerLoaded(): Promise<void> {
  await import("@google/model-viewer");
  if (!customElements.get("model-viewer")) {
    await customElements.whenDefined("model-viewer");
  }
}

type ModelViewerElement = HTMLElement & {
  canActivateAR?: boolean;
  activateAR?: () => Promise<void> | void;
};

function openQuickLook(iosSrc: string): boolean {
  if (typeof window === "undefined") return false;
  if (!iosSrc) return false;
  try {
    window.location.assign(iosSrc);
    return true;
  } catch {
    return false;
  }
}

function arUnavailableVariant(): ArUnavailableVariant {
  if (!isIosDevice()) return "default";
  if (isBraveUserAgent()) return "iosBrave";
  if (isIosEmbeddedBrowser()) return "iosEmbedded";
  return "default";
}

export const DishModelViewer = forwardRef<
  DishModelViewerHandle,
  DishModelViewerProps
>(function DishModelViewer({ dish, minimalChrome = false }, ref) {
  const titleId = useId();
  const helpId = useId();
  const [mvReady, setMvReady] = useState(false);
  const [initTimedOut, setInitTimedOut] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  /** \u00c9chec apr\u00e8s tentative AR r\u00e9elle (pas simple diff\u00e9r\u00e9). */
  const [arUnsupported, setArUnsupported] = useState(false);
  const loadWatchRef = useRef<ModelViewerElement | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  const hasModel = Boolean(dish.model3dUrl?.trim());
  const modelSrc = useMemo(() => dish.model3dUrl?.trim() ?? "", [dish.model3dUrl]);
  const iosSrc = useMemo(() => dish.usdzUrl?.trim() ?? "", [dish.usdzUrl]);
  const [isIos, setIsIos] = useState(false);
  useLayoutEffect(() => {
    setIsIos(isIosDevice());
  }, []);
  const missingIosAr = isIos && !iosSrc;

  useEffect(() => {
    let cancelled = false;
    void ensureModelViewerLoaded().then(() => {
      if (!cancelled) setMvReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const bindModelViewerRef = useCallback(
    (node: ModelViewerElement | null) => {
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = null;
      loadWatchRef.current = node;
      setModelLoaded(false);
      if (!node) return;

      const onLoad = () => {
        setModelLoaded(true);
        setModelLoadError(false);
      };
      const onError = () => {
        setModelLoadError(true);
        setModelLoaded(false);
      };
      const onArStatus = () => setArUnsupported(false);

      node.addEventListener("load", onLoad);
      node.addEventListener("error", onError);
      node.addEventListener("ar-status", onArStatus);

      listenerCleanupRef.current = () => {
        node.removeEventListener("load", onLoad);
        node.removeEventListener("error", onError);
        node.removeEventListener("ar-status", onArStatus);
      };

      // Mod\u00e8le d\u00e9j\u00e0 en cache : pas toujours un nouveau \u00e9v\u00e9nement load.
      queueMicrotask(() => {
        const loaded =
          (node as unknown as { loaded?: boolean }).loaded === true;
        if (loaded) onLoad();
      });
    },
    []
  );

  useEffect(() => {
    setModelLoaded(false);
  }, [modelSrc]);

  useEffect(
    () => () => {
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = null;
    },
    []
  );

  const requestAr = useCallback((): ArRequestStatus => {
    if (missingIosAr) {
      return "missing-ios-src";
    }
    if (!mvReady) {
      return "deferred";
    }
    const el = loadWatchRef.current;
    if (!el?.activateAR) {
      // Fallback robuste iOS: ouvrir directement le USDZ dans Quick Look.
      if (isIos && openQuickLook(iosSrc)) {
        return "launched";
      }
      return "deferred";
    }
    if (!modelLoaded) {
      return "deferred";
    }
    if (el.canActivateAR === false) {
      if (isIos && openQuickLook(iosSrc)) {
        return "launched";
      }
      setArUnsupported(true);
      return "unsupported";
    }

    setArUnsupported(false);
    try {
      const result = el.activateAR();
      if (result && typeof result.then === "function") {
        result.catch(() => {
          if (isIos && openQuickLook(iosSrc)) {
            return;
          }
          setArUnsupported(true);
          openSystemBrowserHandoffForAr();
        });
      }
      return "launched";
    } catch {
      if (isIos && openQuickLook(iosSrc)) {
        return "launched";
      }
      setArUnsupported(true);
      return "unsupported";
    }
  }, [missingIosAr, mvReady, modelLoaded, isIos, iosSrc]);

  useImperativeHandle(ref, () => ({ requestAr }), [requestAr]);

  useEffect(() => {
    if (!hasModel || mvReady) return;
    const t = window.setTimeout(() => setInitTimedOut(true), MV_INIT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [hasModel, mvReady]);

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
  const arHintVariant = arUnsupported
    ? arUnavailableVariant()
    : "default";

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/[0.14] bg-gradient-to-b from-[#14100c] to-[#070605] p-3 shadow-[inset_0_1px_0_rgba(217,184,121,0.08)] transition-opacity duration-300 sm:p-4"
      aria-labelledby={minimalChrome ? undefined : titleId}
    >
      {!minimalChrome ? (
        <div className="mb-2 text-center sm:mb-3">
          <h3 id={titleId} className="font-display text-lg text-cream sm:text-xl">
            {dish.name}
          </h3>
        </div>
      ) : null}

      <div className="relative mx-auto w-full max-w-lg">
        {showInitFail ? (
          <div className="flex min-h-[min(65vh,460px)] w-full flex-col items-center justify-center gap-3 rounded-xl bg-[#10100e] px-6 text-center text-sm text-[#c4a892] ring-1 ring-white/8">
            <p>Affichage impossible pour le moment.</p>
            <p className="text-xs text-[#7d6e5c]">Actualisez la page.</p>
          </div>
        ) : (
          <div className="relative">
            {showLoader ? (
              <div
                className="absolute inset-0 z-20 flex h-[min(58vh,420px)] min-h-[280px] w-full animate-pulse items-center justify-center rounded-xl bg-[#10100e]/95 ring-1 ring-white/8 sm:h-[min(65vh,460px)] sm:min-h-[340px]"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <span className="text-sm text-[#9a8b78]">Chargement…</span>
              </div>
            ) : null}
            {mvReady ? (
              /* GLB en mètres réalistes ; ar-scale fixed évite l’auto-scale agressif sur Android */
              <model-viewer
                ref={bindModelViewerRef}
                src={modelSrc}
                {...(iosSrc ? { "ios-src": iosSrc } : {})}
                alt={`Vue du plat : ${dish.name}`}
                aria-describedby={helpId}
                camera-controls
                auto-rotate
                ar
                ar-modes="quick-look scene-viewer webxr"
                ar-placement="floor"
                ar-scale="fixed"
                shadow-intensity="1"
                exposure="1.05"
                loading="auto"
                camera-orbit="0deg 68deg 145%"
                camera-target="0m 0.015m 0m"
                field-of-view="34deg"
                min-camera-orbit="auto auto 65%"
                max-camera-orbit="auto auto 175%"
                className="mx-auto block h-[min(58vh,420px)] min-h-[280px] w-full rounded-xl bg-[#10100e] ring-1 ring-white/8 sm:h-[min(65vh,460px)] sm:min-h-[340px]"
              >
                <button
                  type="button"
                  slot="ar-button"
                  className="absolute bottom-4 left-1/2 inline-flex min-h-11 -translate-x-1/2 items-center justify-center rounded-full border border-champagne/45 bg-[#080706]/92 px-5 text-sm font-semibold text-champagne shadow-[0_14px_40px_rgba(0,0,0,0.48)] backdrop-blur transition hover:border-champagne/70 hover:bg-[#120d09] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-[#10100e]"
                >
                  Ouvrir en réalité augmentée
                </button>
              </model-viewer>
            ) : (
              <div
                className="h-[min(58vh,420px)] min-h-[280px] w-full rounded-xl bg-[#10100e] ring-1 ring-white/8 sm:h-[min(65vh,460px)] sm:min-h-[340px]"
                aria-hidden
              />
            )}
            <div className="mt-3 space-y-1.5 px-1 text-center text-xs leading-relaxed text-[#bba88f] sm:text-sm">
              <p id={helpId}>{AR_HELP_TEXT}</p>
              {arUnsupported ? (
                <p className="text-[#8f806d]">
                  {getArUnavailableMessage(arHintVariant)}
                </p>
              ) : null}
              {missingIosAr ? (
                <p className="text-[#c4a892]">{IOS_USDZ_MISSING_TEXT}</p>
              ) : null}
            </div>
            {modelLoadError ? (
              <p className="mt-2 text-center text-xs text-[#c49a84]">
                {getArUnavailableMessage("modelLoad")}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
});
