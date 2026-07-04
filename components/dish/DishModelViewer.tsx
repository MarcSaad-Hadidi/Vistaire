"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { trackMenuEvent } from "@/lib/analytics/client";
import {
  buildDemoDish3dManifest,
  selectImmersiveVariant,
  type ImmersiveBrowser,
  type ImmersiveDevice
} from "@/lib/dish3dManifest";
import type { Dish } from "@/lib/demoMenuData";
import {
  isAndroidDevice,
  isAndroidLikelySceneViewerCapable,
  isIosDevice,
  shouldShowArBrowserHandoff
} from "@/lib/arEnvironment";
import { configureModelViewerAssetDecoders } from "@/lib/modelViewerAssetDecoders";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

export { configureModelViewerAssetDecoders } from "@/lib/modelViewerAssetDecoders";

const MV_INIT_TIMEOUT_MS = 12_000;
const MODEL_LOAD_TIMEOUT_MS = 15_000;
const LOADER_REVEAL_DELAY_MS = 700;
const AR_READY_CAMERA_ORBIT = "0deg 68deg 145%";
const AR_READY_CAMERA_TARGET = "0m 0.015m 0m";
const AR_READY_FIELD_OF_VIEW = "34deg";
const MODEL_FRAME_CLASS =
  "h-[min(58vh,420px)] min-h-[280px] w-full rounded-xl bg-[#10100e] ring-1 ring-white/8 sm:h-[min(65vh,460px)] sm:min-h-[340px]";
const MODEL_VIEWER_SHELL_CLASS =
  "min-h-[350px] w-full overflow-hidden rounded-xl bg-[#10100e] ring-1 ring-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-[430px]";
const MODEL_VIEWER_CANVAS_CLASS =
  "h-[min(48vh,350px)] min-h-[250px] w-full bg-[#10100e] sm:h-[min(55vh,380px)] sm:min-h-[310px]";
const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((entry) => entry.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export type DishModelViewerCopy = Partial<{
  loadingTitle: string;
  loadingBody: string;
  arHelp: string;
  quickLookCta: string;
  shareText: string;
  loadFailureTitle: string;
  loadFailureBodyWithAr: string;
  loadFailureBody: string;
  retry: string;
  close: string;
  returnToDish: string;
  slowNetworkTitle: string;
  slowNetworkBody: string;
  slowNetworkCta: string;
  noModelQuiet: string;
  noModelIos: string;
  noModelIosHandoff: string;
  noModelSoon: string;
  safariTitle: string;
  copyLink: string;
  linkCopied: string;
  share: string;
  iosUsdzMissing: string;
  desktopArHint: string;
  arAndroidBrowser: string;
  arIosHandoff: string;
  modelAlt: (dishName: string) => string;
}>;

type ResolvedDishModelViewerCopy = Required<DishModelViewerCopy>;

const DEFAULT_MODEL_VIEWER_COPY = {
  loadingTitle: "Préparation de la vue immersive...",
  loadingBody: "Quelques secondes peuvent être nécessaires selon le réseau.",
  arHelp:
    "Faites tourner le plat en 3D. En AR, placez-le une fois : il reste fixe à cet endroit (sans rotation automatique ni redimensionnement).",
  quickLookCta: "Afficher devant moi",
  shareText: "Découvrez ce plat en 3D.",
  loadFailureTitle: "La vue 3D n'a pas pu être chargée pour le moment.",
  loadFailureBodyWithAr:
    "Vous pouvez réessayer la 3D ou placer le plat devant vous depuis Safari.",
  loadFailureBody:
    "Vous pouvez réessayer maintenant ou revenir à la fiche du plat.",
  retry: "Réessayer",
  close: "Fermer",
  returnToDish: "Revenir à la fiche du plat",
  slowNetworkTitle: "Réseau lent détecté : charger la vue 3D ?",
  slowNetworkBody:
    "La photo du plat reste disponible, et la vue 3D peut être lancée quand vous le souhaitez.",
  slowNetworkCta: "Charger la vue 3D",
  noModelQuiet: "Vue 3D indisponible pour le moment.",
  noModelIos:
    "La vue 3D sera bientôt disponible ici. Vous pouvez déjà placer le plat devant vous dans Safari.",
  noModelIosHandoff:
    "La vue 3D sera bientôt disponible ici. Pour placer le plat devant vous, ouvrez cette fiche dans Safari.",
  noModelSoon: "Ce plat sera bientôt disponible en 3D.",
  safariTitle: "Réalité augmentée disponible dans Safari",
  copyLink: "Copier le lien",
  linkCopied: "Lien copié",
  share: "Partager",
  iosUsdzMissing: "Pour activer l'AR iPhone, ajoutez un fichier USDZ à ce plat.",
  desktopArHint:
    "La réalité augmentée se lance depuis un téléphone compatible.",
  arAndroidBrowser:
    "Votre navigateur ne permet pas la réalité augmentée ici. Vous pouvez quand même faire tourner le plat en 3D.",
  arIosHandoff:
    "Pour placer le plat devant vous, ouvrez cette fiche dans Safari sur iPhone.",
  modelAlt: (dishName: string) => `Vue du plat : ${dishName}`
} satisfies ResolvedDishModelViewerCopy;

export type DishModelViewerProps = {
  dish: Pick<
    Dish,
    | "slug"
    | "categorySlug"
    | "name"
    | "model3dUrl"
    | "webModel3dUrl"
    | "arModel3dUrl"
    | "arUsdzUrl"
    | "image"
    | "imageObjectPosition"
    | "imageObjectPositionDetail"
  >;
  /** Chrome minimal : titres et aide fournis par le parent si besoin. */
  minimalChrome?: boolean;
  quietChrome?: boolean;
  copy?: DishModelViewerCopy;
  onReturnToDish?: () => void;
  onArFallbackNeeded?: (reason: string) => void;
  onArFallbackCleared?: () => void;
};

function resolveModelViewerCopy(copy?: DishModelViewerCopy): ResolvedDishModelViewerCopy {
  return {
    ...DEFAULT_MODEL_VIEWER_COPY,
    ...copy,
    modelAlt: copy?.modelAlt ?? DEFAULT_MODEL_VIEWER_COPY.modelAlt
  };
}

async function ensureModelViewerLoaded(): Promise<void> {
  configureModelViewerAssetDecoders();
  await import("@google/model-viewer");
  if (!customElements.get("model-viewer")) {
    await customElements.whenDefined("model-viewer");
  }
  configureModelViewerAssetDecoders();
}

type ModelViewerElement = HTMLElement & {
  loaded?: boolean;
  canActivateAR?: boolean;
  cameraOrbit?: string;
  cameraTarget?: string;
  fieldOfView?: string;
  activateAR?: () => Promise<void>;
  jumpCameraToGoal?: () => void;
};

function prepareModelViewerForAr(node: ModelViewerElement | null): void {
  if (!node) return;
  node.removeAttribute("auto-rotate");
  node.cameraOrbit = AR_READY_CAMERA_ORBIT;
  node.cameraTarget = AR_READY_CAMERA_TARGET;
  node.fieldOfView = AR_READY_FIELD_OF_VIEW;
  node.jumpCameraToGoal?.();
}

type ModelViewerProgressEvent = Event & {
  detail?: {
    totalProgress?: number;
  };
};

type ModelViewerArStatusEvent = Event & {
  detail?: {
    status?: "not-presenting" | "session-started" | "object-placed" | "failed";
  };
};

type ArClientEnvironment = {
  isIos: boolean;
  missingIosAr: boolean;
  needsIosHandoff: boolean;
};

type ClientConnection = {
  effectiveType?: string;
  saveData?: boolean;
};

function readArClientEnvironment(iosSrc: string): ArClientEnvironment {
  const isIos = isIosDevice();
  return {
    isIos,
    missingIosAr: isIos && !iosSrc,
    needsIosHandoff: shouldShowArBrowserHandoff()
  };
}

function readClientConnection(): ClientConnection {
  if (typeof navigator === "undefined") return {};
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  return {
    effectiveType: connection?.effectiveType,
    saveData: connection?.saveData
  };
}

function readClientViewport(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 0, height: 0 };
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function browserForSelection({
  isIos,
  isAndroid,
  needsIosHandoff,
  androidArUnavailable
}: {
  isIos: boolean;
  isAndroid: boolean;
  needsIosHandoff: boolean;
  androidArUnavailable: boolean;
}): ImmersiveBrowser {
  if (isIos) return needsIosHandoff ? "unknown" : "safari";
  if (isAndroid) return androidArUnavailable ? "unknown" : "chrome";
  return "chrome";
}

function deviceForSelection(isIos: boolean, isAndroid: boolean): ImmersiveDevice {
  if (isIos) return "ios";
  if (isAndroid) return "android";
  return "desktop";
}

function getCurrentPageUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

async function copyPageLink(): Promise<boolean> {
  const url = getCurrentPageUrl();
  if (!url || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

async function sharePageLink(dishName: string, text: string): Promise<boolean> {
  const url = getCurrentPageUrl();
  if (!url || !navigator.share) return false;
  try {
    await navigator.share({
      title: dishName,
      text,
      url
    });
    return true;
  } catch {
    return false;
  }
}

function getPosterPosition(
  dish: Pick<Dish, "imageObjectPosition" | "imageObjectPositionDetail">
): string {
  return (
    dish.imageObjectPositionDetail ??
    dish.imageObjectPosition ??
    "center 44%"
  );
}

function PremiumDishBackdrop({
  dish
}: {
  dish: Pick<
    Dish,
    "name" | "image" | "imageObjectPosition" | "imageObjectPositionDetail"
  >;
}) {
  return (
    <>
      {dish.image ? (
        <Image
          src={dish.image}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-cover opacity-80"
          style={{ objectPosition: getPosterPosition(dish) }}
          quality={90}
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a1f18] via-[#16100c] to-[#080706]" />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#080706]/20 via-[#080706]/68 to-[#080706]/94"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(217,184,121,0.18),transparent_48%)]"
        aria-hidden
      />
    </>
  );
}

function PremiumLoadingState({
  dish,
  copy,
  progress = 0
}: {
  dish: Pick<
    Dish,
    "name" | "image" | "imageObjectPosition" | "imageObjectPositionDetail"
  >;
  copy: ResolvedDishModelViewerCopy;
  progress?: number;
}) {
  const progressPercent = Math.max(8, Math.min(100, Math.round(progress * 100)));

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 isolate flex ${MODEL_FRAME_CLASS} flex-col justify-end overflow-hidden px-5 py-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <PremiumDishBackdrop dish={dish} />
      <div className="relative">
        <p className="font-display text-lg leading-tight text-cream sm:text-xl">
          {copy.loadingTitle}
        </p>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#d6c7af] sm:text-sm">
          {copy.loadingBody}
        </p>
        <div className="mt-5 h-px w-full overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-gradient-to-r from-champagne/70 via-champagne to-[#f0dca5] transition-[width] duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function IosQuickLookArLink({
  href,
  className,
  label,
  onClick
}: {
  href: string;
  className: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <a href={href} rel="ar" className={className} onClick={onClick}>
      {/* Safari Quick Look exige un enfant img/picture sur les liens rel="ar". */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      <span className="whitespace-nowrap">{label}</span>
    </a>
  );
}

function PremiumFailureState({
  dish,
  copy,
  onRetry,
  onReturnToDish,
  quickLookHref,
  onQuickLookClick,
  quietChrome = false
}: {
  dish: Pick<
    Dish,
    "name" | "image" | "imageObjectPosition" | "imageObjectPositionDetail"
  >;
  copy: ResolvedDishModelViewerCopy;
  onRetry: () => void;
  onReturnToDish?: () => void;
  quickLookHref?: string;
  onQuickLookClick?: () => void;
  quietChrome?: boolean;
}) {
  const hasDirectAr = Boolean(quickLookHref && onQuickLookClick);

  return (
    <div
      className={`relative isolate flex ${MODEL_FRAME_CLASS} flex-col justify-end overflow-hidden px-5 py-6 text-left`}
      role="status"
      aria-live="polite"
    >
      <PremiumDishBackdrop dish={dish} />
      <div className="relative">
        <p className="font-display text-lg leading-tight text-cream sm:text-xl">
          {copy.loadFailureTitle}
        </p>
        {!quietChrome ? (
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#d6c7af] sm:text-sm">
            {hasDirectAr ? copy.loadFailureBodyWithAr : copy.loadFailureBody}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {hasDirectAr ? (
            <IosQuickLookArLink
              href={quickLookHref!}
              label={copy.quickLookCta}
              onClick={onQuickLookClick!}
              className="relative inline-flex min-h-10 items-center justify-center rounded-full border border-champagne/45 bg-champagne px-4 text-xs font-semibold text-[#17100a] transition hover:bg-[#e3c785] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            />
          ) : null}
          <button
            type="button"
            className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne ${
              hasDirectAr
                ? "border border-white/18 bg-black/35 text-cream hover:bg-white/10"
                : "border border-champagne/45 bg-champagne text-[#17100a] hover:bg-[#e3c785]"
            }`}
            onClick={onRetry}
          >
            {copy.retry}
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/18 bg-black/35 px-4 text-xs font-semibold text-cream transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            onClick={onReturnToDish}
          >
            {quietChrome ? copy.close : copy.returnToDish}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DishModelViewer({
  dish,
  minimalChrome = false,
  quietChrome = false,
  copy: customCopy,
  onReturnToDish,
  onArFallbackNeeded,
  onArFallbackCleared
}: DishModelViewerProps) {
  const copy = resolveModelViewerCopy(customCopy);
  const titleId = useId();
  const helpId = useId();
  const [mvReady, setMvReady] = useState(false);
  const [initTimedOut, setInitTimedOut] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(false);
  const [modelLoadTimedOut, setModelLoadTimedOut] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [runtimeArFailed, setRuntimeArFailed] = useState(false);
  const [loaderRevealed, setLoaderRevealed] = useState(false);
  const [modelAttempt, setModelAttempt] = useState(0);
  const [arSessionActive, setArSessionActive] = useState(false);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [slowNetworkConfirmed, setSlowNetworkConfirmed] = useState(false);
  const loadWatchRef = useRef<ModelViewerElement | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const isAndroid = isAndroidDevice();
  const manifest = useMemo(() => buildDemoDish3dManifest(dish), [dish]);
  const iosSrc = manifest.variants.iosUsdz?.url ?? "";
  const arEnvironment = readArClientEnvironment(iosSrc);
  const { isIos, missingIosAr, needsIosHandoff } = arEnvironment;
  const androidArUnavailable =
    isAndroid && !isAndroidLikelySceneViewerCapable();
  const selectionDevice = deviceForSelection(isIos, isAndroid);
  const selectionBrowser = browserForSelection({
    isIos,
    isAndroid,
    needsIosHandoff,
    androidArUnavailable
  });
  const baseConnection = readClientConnection();
  const effectiveConnection = slowNetworkConfirmed
    ? { ...baseConnection, effectiveType: "4g", saveData: false }
    : baseConnection;
  const viewport = readClientViewport();
  const modelSelection = selectImmersiveVariant({
    manifest,
    device: selectionDevice,
    browser: selectionBrowser,
    viewport,
    connection: effectiveConnection,
    userIntent: "view3d",
    prefersReducedMotion,
    allowedExternalOrigins: ALLOWED_3D_CDN_ORIGINS
  });
  const arSelection = selectImmersiveVariant({
    manifest,
    device: selectionDevice,
    browser: selectionBrowser,
    viewport,
    connection: effectiveConnection,
    userIntent: "ar",
    prefersReducedMotion,
    allowedExternalOrigins: ALLOWED_3D_CDN_ORIGINS
  });
  const modelSrc = modelSelection.shouldLoadModel ? modelSelection.url : "";
  const hasModel = Boolean(modelSrc);
  const shouldConfirmSlowNetwork =
    modelSelection.requiresConfirmation && !slowNetworkConfirmed;
  const directIosQuickLookHref =
    isIos && !needsIosHandoff && arSelection.kind === "iosUsdz"
      ? arSelection.url
      : "";
  const arLiteReady = arSelection.kind === "arLite" && Boolean(arSelection.url);
  const iosNativeArEnabled = isIos && !needsIosHandoff && !missingIosAr;
  const androidNativeArEnabled =
    isAndroid && !androidArUnavailable && arLiteReady;
  const showNoModelIosHandoff =
    !hasModel && needsIosHandoff && Boolean(iosSrc) && !shouldConfirmSlowNetwork;

  const markModelLoaded = useCallback(() => {
    setModelLoaded(true);
    setModelLoadError(false);
    setModelLoadTimedOut(false);
    setModelProgress(1);
    setRuntimeArFailed(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void ensureModelViewerLoaded().then(
      () => {
        if (!cancelled) setMvReady(true);
      },
      () => {
        if (!cancelled) setInitTimedOut(true);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [modelAttempt]);

  const bindModelViewerRef = useCallback(
    (node: ModelViewerElement | null) => {
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = null;
      loadWatchRef.current = node;
      setModelLoaded(false);
      setModelProgress(0);
      if (!node) return;

      const onLoad = () => markModelLoaded();
      const onError = () => {
        setModelLoadError(true);
        setModelLoadTimedOut(false);
        setModelLoaded(false);
      };
      const onProgress = (event: Event) => {
        const totalProgress =
          (event as ModelViewerProgressEvent).detail?.totalProgress ?? 0;
        setModelProgress((current) => Math.max(current, totalProgress));
      };
      const onArStatus = (event: Event) => {
        const status = (event as ModelViewerArStatusEvent).detail?.status;
        if (status === "failed") {
          setRuntimeArFailed(true);
          setArSessionActive(false);
          onArFallbackNeeded?.("ar-status-failed");
          return;
        }
        if (status === "session-started" || status === "object-placed") {
          setRuntimeArFailed(false);
          setArSessionActive(true);
          onArFallbackCleared?.();
          prepareModelViewerForAr(node);
          return;
        }
        if (status === "not-presenting") {
          setRuntimeArFailed(false);
          setArSessionActive(false);
          onArFallbackCleared?.();
        }
      };

      node.addEventListener("load", onLoad);
      node.addEventListener("error", onError);
      node.addEventListener("progress", onProgress);
      node.addEventListener("ar-status", onArStatus);

      listenerCleanupRef.current = () => {
        node.removeEventListener("load", onLoad);
        node.removeEventListener("error", onError);
        node.removeEventListener("progress", onProgress);
        node.removeEventListener("ar-status", onArStatus);
      };

      // Modèle déjà en cache : pas toujours un nouveau événement load.
      queueMicrotask(() => {
        if (node.loaded === true) onLoad();
      });
    },
    [markModelLoaded, onArFallbackCleared, onArFallbackNeeded]
  );

  useEffect(
    () => () => {
      listenerCleanupRef.current?.();
      listenerCleanupRef.current = null;
    },
    []
  );

  useEffect(() => {
    const resetTemporaryArState = () => {
      setRuntimeArFailed(false);
      setLoaderRevealed(false);
    };
    const resetWhenVisible = () => {
      if (document.visibilityState === "visible") resetTemporaryArState();
    };

    document.addEventListener("visibilitychange", resetWhenVisible);
    window.addEventListener("pageshow", resetTemporaryArState);
    window.addEventListener("focus", resetTemporaryArState);
    window.addEventListener("pagehide", resetTemporaryArState);

    return () => {
      document.removeEventListener("visibilitychange", resetWhenVisible);
      window.removeEventListener("pageshow", resetTemporaryArState);
      window.removeEventListener("focus", resetTemporaryArState);
      window.removeEventListener("pagehide", resetTemporaryArState);
    };
  }, []);

  useEffect(() => {
    if (!hasModel || mvReady) return;
    const t = window.setTimeout(() => setInitTimedOut(true), MV_INIT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [hasModel, mvReady, modelAttempt]);

  useEffect(() => {
    if (!hasModel || !mvReady || modelLoaded || modelLoadError || modelLoadTimedOut) {
      return undefined;
    }
    const syncLoaded = window.setInterval(() => {
      if (loadWatchRef.current?.loaded === true) {
        markModelLoaded();
      }
    }, 250);
    const t = window.setTimeout(() => {
      setModelLoadTimedOut(true);
    }, MODEL_LOAD_TIMEOUT_MS);
    return () => {
      window.clearInterval(syncLoaded);
      window.clearTimeout(t);
    };
  }, [
    hasModel,
    mvReady,
    modelLoaded,
    modelLoadError,
    modelLoadTimedOut,
    modelAttempt,
    markModelLoaded
  ]);

  const trackArIntent = useCallback(() => {
    prepareModelViewerForAr(loadWatchRef.current);
    window.setTimeout(() => {
      try {
        trackMenuEvent({
          eventName: "dish_ar_clicked",
          dishSlug: dish.slug,
          categorySlug: dish.categorySlug
        });
      } catch {
        // Analytics must never block Safari Quick Look navigation.
      }
    }, 0);
  }, [dish.categorySlug, dish.slug]);

  const handleModelViewerArClick = useCallback(() => {
    trackArIntent();
    void loadWatchRef.current?.activateAR?.().catch(() => {
      setRuntimeArFailed(true);
      setArSessionActive(false);
      onArFallbackNeeded?.("activate-ar-failed");
    });
  }, [onArFallbackNeeded, trackArIntent]);

  const handleRetry = useCallback(() => {
    setInitTimedOut(false);
    setModelLoadError(false);
    setModelLoadTimedOut(false);
    setModelLoaded(false);
    setModelProgress(0);
    setRuntimeArFailed(false);
    setLoaderRevealed(false);
    setHandoffDismissed(false);
    setModelAttempt((attempt) => attempt + 1);
  }, []);

  const showInitFail = !mvReady && initTimedOut;
  const showLoadFailure = showInitFail || modelLoadError || modelLoadTimedOut;
  const isLoadingModel =
    hasModel && !showLoadFailure && (!mvReady || (mvReady && !modelLoaded));
  const showLoader = isLoadingModel && loaderRevealed;
  const showArReady = modelLoaded && !showLoadFailure;
  const canOpenDirectIosQuickLook =
    iosNativeArEnabled && Boolean(directIosQuickLookHref);
  const showIosQuickLookButton = showArReady && canOpenDirectIosQuickLook;
  const showAndroidSceneViewerButton = showArReady && androidNativeArEnabled;
  const shouldReserveArActionRail =
    hasModel &&
    !showLoadFailure &&
    (canOpenDirectIosQuickLook || androidNativeArEnabled);
  const showHandoff =
    showArReady && !handoffDismissed && needsIosHandoff && Boolean(iosSrc);
  const showAndroidFallback =
    showArReady &&
    !handoffDismissed &&
    (androidArUnavailable || (isAndroid && runtimeArFailed));
  const showMissingIosAr = showArReady && missingIosAr;
  const showDesktopArHint = showArReady && !isIos && !isAndroid;
  const arModes = isAndroid
    ? "scene-viewer webxr quick-look"
    : "webxr scene-viewer quick-look";

  useEffect(() => {
    if (showHandoff) onArFallbackNeeded?.("ios-handoff");
    if (showAndroidFallback) onArFallbackNeeded?.("android-fallback");
    if (showMissingIosAr) onArFallbackNeeded?.("missing-ios-usdz");
  }, [
    onArFallbackNeeded,
    showAndroidFallback,
    showHandoff,
    showMissingIosAr
  ]);

  useEffect(() => {
    if (!isLoadingModel) return undefined;
    const t = window.setTimeout(
      () => setLoaderRevealed(true),
      LOADER_REVEAL_DELAY_MS
    );
    return () => window.clearTimeout(t);
  }, [isLoadingModel, modelAttempt]);

  if (shouldConfirmSlowNetwork) {
    return (
      <section
        className="overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-[#14100c] via-[#0f0b08] to-[#080706] shadow-inner"
        aria-labelledby={titleId}
      >
        <div
          className={`relative isolate flex ${MODEL_FRAME_CLASS} flex-col justify-end overflow-hidden px-5 py-6 text-left`}
          role="status"
          aria-live="polite"
        >
          <PremiumDishBackdrop dish={dish} />
          <div className="relative">
            <p
              id={titleId}
              className="font-display text-lg leading-tight text-cream sm:text-xl"
            >
              {copy.slowNetworkTitle}
            </p>
            {!quietChrome ? (
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#d6c7af] sm:text-sm">
                {copy.slowNetworkBody}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-champagne/45 bg-champagne px-4 text-xs font-semibold text-[#17100a] transition hover:bg-[#e3c785] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                onClick={() => setSlowNetworkConfirmed(true)}
              >
                {copy.slowNetworkCta}
              </button>
              {onReturnToDish ? (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/18 bg-black/35 px-4 text-xs font-semibold text-cream transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                  onClick={onReturnToDish}
                >
                  {quietChrome ? copy.close : copy.returnToDish}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

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
            {canOpenDirectIosQuickLook
              ? quietChrome
                ? copy.noModelQuiet
                : copy.noModelIos
              : showNoModelIosHandoff && !quietChrome
                ? copy.noModelIosHandoff
              : copy.noModelSoon}
          </p>
          {canOpenDirectIosQuickLook ? (
            <IosQuickLookArLink
              href={directIosQuickLookHref}
              label={copy.quickLookCta}
              onClick={trackArIntent}
              className="relative mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-champagne/45 bg-champagne px-5 text-sm font-semibold text-[#17100a] transition hover:bg-[#e3c785] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            />
          ) : null}
          {showNoModelIosHandoff && !quietChrome ? (
            <div
              className="mt-5 w-full max-w-md rounded-xl border border-champagne/25 bg-champagne/10 p-3 text-left"
              role="status"
              aria-live="polite"
            >
              <p className="font-display text-base leading-tight text-cream">
                {copy.safariTitle}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[#eadcc6]">
                {copy.arIosHandoff}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="min-h-10 rounded-full border border-champagne/45 px-3 text-xs font-semibold text-champagne transition hover:bg-champagne/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                  onClick={() => {
                    void copyPageLink().then((ok) => {
                      setCopyConfirmed(ok);
                      if (ok) {
                        window.setTimeout(() => setCopyConfirmed(false), 1800);
                      }
                    });
                  }}
                >
                  {copyConfirmed ? copy.linkCopied : copy.copyLink}
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-full border border-white/18 px-3 text-xs font-semibold text-cream transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                  onClick={() => {
                    void sharePageLink(dish.name, copy.shareText);
                  }}
                >
                  {copy.share}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

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
        {showLoadFailure ? (
          <PremiumFailureState
            dish={dish}
            copy={copy}
            onRetry={handleRetry}
            onReturnToDish={onReturnToDish}
            quickLookHref={
              canOpenDirectIosQuickLook ? directIosQuickLookHref : undefined
            }
            onQuickLookClick={
              canOpenDirectIosQuickLook ? trackArIntent : undefined
            }
            quietChrome={quietChrome}
          />
        ) : (
          <div className="relative">
            <div className={`relative flex ${MODEL_VIEWER_SHELL_CLASS} flex-col touch-none overscroll-contain [contain:layout_paint]`}>
              {mvReady ? (
                /* GLB en mètres réalistes ; ar-scale fixed évite l’auto-scale agressif sur Android */
                <model-viewer
                  key={`${modelSrc}-${modelAttempt}`}
                  ref={bindModelViewerRef}
                  src={modelSrc}
                  {...(iosSrc ? { "ios-src": iosSrc } : {})}
                  alt={copy.modelAlt(dish.name)}
                  aria-describedby={quietChrome ? undefined : helpId}
                  camera-controls
                  {...(!prefersReducedMotion && !arSessionActive ? { "auto-rotate": true } : {})}
                  {...(androidNativeArEnabled ? { ar: true } : {})}
                  ar-modes={arModes}
                  ar-placement="floor"
                  ar-scale="fixed"
                  xr-environment
                  interaction-prompt="none"
                  shadow-intensity="1"
                  exposure="1.05"
                  loading="auto"
                  reveal="auto"
                  touch-action="none"
                  camera-orbit="0deg 68deg 145%"
                  camera-target="0m 0.015m 0m"
                  field-of-view="34deg"
                  min-camera-orbit="auto auto 65%"
                  max-camera-orbit="auto auto 175%"
                  className={`mx-auto block touch-none ${MODEL_VIEWER_CANVAS_CLASS}`}
                  style={{ "--ar-button-display": "none" } as CSSProperties}
                />
              ) : (
                <div className={MODEL_VIEWER_CANVAS_CLASS} aria-hidden />
              )}
              {shouldReserveArActionRail ? (
                <div className="relative z-30 flex min-h-[76px] items-center justify-center border-t border-white/10 bg-[#080706]/64 px-4 py-4">
                  {showAndroidSceneViewerButton ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 max-w-full items-center justify-center whitespace-nowrap rounded-full border border-champagne/55 bg-champagne px-6 text-center text-sm font-semibold text-[#17100a] shadow-[0_14px_40px_rgba(0,0,0,0.34)] transition hover:bg-[#e3c785] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-[#10100e]"
                      onClick={handleModelViewerArClick}
                    >
                      {copy.quickLookCta}
                    </button>
                  ) : null}
                  {showIosQuickLookButton ? (
                    <IosQuickLookArLink
                      href={directIosQuickLookHref}
                      label={copy.quickLookCta}
                      onClick={trackArIntent}
                      className="relative inline-flex min-h-11 max-w-full items-center justify-center whitespace-nowrap rounded-full border border-champagne/55 bg-champagne px-6 text-center text-sm font-semibold text-[#17100a] shadow-[0_14px_40px_rgba(0,0,0,0.34)] transition hover:bg-[#e3c785] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-[#10100e]"
                    />
                  ) : null}
                </div>
              ) : null}
              {showLoader ? (
                <PremiumLoadingState dish={dish} copy={copy} progress={modelProgress} />
              ) : null}
            </div>

            {!quietChrome ? (
              <div className="mt-3 space-y-1.5 px-1 text-center text-xs leading-relaxed text-[#bba88f] sm:text-sm">
                <p id={helpId}>{copy.arHelp}</p>
                {onReturnToDish ? (
                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-10 items-center justify-center rounded-full border border-white/18 bg-black/35 px-4 text-xs font-semibold text-cream transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                    onClick={onReturnToDish}
                  >
                    {copy.returnToDish}
                  </button>
                ) : null}
              </div>
            ) : null}
            {!quietChrome && showHandoff ? (
              <div
                className="mt-3 rounded-xl border border-champagne/25 bg-champagne/10 p-3 text-left"
                role="status"
                aria-live="polite"
              >
                <p className="font-display text-base leading-tight text-cream">
                  {copy.safariTitle}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#eadcc6]">
                  {copy.arIosHandoff}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="min-h-10 rounded-full border border-champagne/45 px-3 text-xs font-semibold text-champagne transition hover:bg-champagne/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                    onClick={() => {
                      void copyPageLink().then((ok) => {
                        setCopyConfirmed(ok);
                        if (ok) {
                          window.setTimeout(() => setCopyConfirmed(false), 1800);
                        }
                      });
                    }}
                  >
                    {copyConfirmed ? copy.linkCopied : copy.copyLink}
                  </button>
                  <button
                    type="button"
                    className="min-h-10 rounded-full border border-white/18 px-3 text-xs font-semibold text-cream transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                    onClick={() => {
                      void sharePageLink(dish.name, copy.shareText);
                    }}
                  >
                    {copy.share}
                  </button>
                </div>
              </div>
            ) : null}
            {!quietChrome && showAndroidFallback ? (
              <p className="mt-3 px-1 text-center text-xs leading-relaxed text-[#bba88f] sm:text-sm">
                {copy.arAndroidBrowser}
              </p>
            ) : null}
            {!quietChrome && showMissingIosAr ? (
              <p className="mt-3 px-1 text-center text-xs leading-relaxed text-[#bba88f] sm:text-sm">
                {copy.iosUsdzMissing}
              </p>
            ) : null}
            {!quietChrome && showDesktopArHint ? (
              <p className="mt-3 px-1 text-center text-xs leading-relaxed text-[#bba88f] sm:text-sm">
                {copy.desktopArHint}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
