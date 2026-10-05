"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode
} from "react";
import type {
  ArFallbackReason,
  DishModelViewerProps
} from "@/components/dish/DishModelViewer";
import {
  getPublicMenuAnalyticsContext
} from "@/lib/analytics/client";
import {
  copyTextToClipboard,
  detectArHandoffPlatform,
  type ArHandoffPlatform
} from "@/lib/menu/arBrowserHandoff";
import { arFallbackUiMode } from "@/lib/ar/arExperience";
import type {
  PublicMenu,
  PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import { AllergenWarning } from "./AllergenDisclosure";
import { PremiumDishCardOptionTags } from "./PremiumDishTags";
import type {
  TrouvableCopy,
  TrouvableLocale
} from "./trouvableMenuControls";
import styles from "./TrouvablePremiumMenuExperience.module.css";

type DishModelViewerComponent = ComponentType<DishModelViewerProps>;
type ArCopyStatus = "idle" | "copying" | "success" | "error";

type TrouvableImmersivePanelBodyProps = {
  experience: ReturnType<typeof useTrouvableImmersiveExperience>;
  copy: TrouvableCopy;
  dish: PublicMenuDish;
  menu: PublicMenu;
  modelControlsId: string;
  onReturnToDish: () => void;
};

type TrouvableDishDetailSurfaceProps = {
  actionContent?: ReactNode;
  children?: ReactNode;
  copy: TrouvableCopy;
  detailsExpanded: boolean;
  detailsId: string;
  dish: PublicMenuDish;
  eyebrow: string;
  hasModel: boolean;
  headingLevel: "h1" | "h2";
  locale: TrouvableLocale;
  menuName: string;
  modelControlsId: string;
  modelExpanded: boolean;
  onClose?: () => void;
  onOpenDetails: () => void;
  onToggleModel: () => void;
  price: string;
  secondaryEyebrow?: string;
  showImmersiveUnavailable?: boolean;
  textDirection: "ltr" | "rtl";
  titleId: string;
};

export function useTrouvableImmersiveExperience(
  browserDishHref: string,
  requested: boolean
) {
  const [ModelViewerComponent, setModelViewerComponent] =
    useState<DishModelViewerComponent | null>(null);
  const [modelViewerLoadFailed, setModelViewerLoadFailed] = useState(false);
  const [fallbackMode, setFallbackMode] =
    useState<ReturnType<typeof arFallbackUiMode>>("none");
  const [arHandoffPlatform] = useState<ArHandoffPlatform>(() => {
    if (typeof navigator === "undefined") return "other";
    const navigatorWithData = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    return detectArHandoffPlatform({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      userAgentDataPlatform: navigatorWithData.userAgentData?.platform
    });
  });
  const [arCopyStatus, setArCopyStatus] = useState<ArCopyStatus>("idle");
  const [manualDishUrl, setManualDishUrl] = useState("");
  const manualDishUrlRef = useRef<HTMLInputElement | null>(null);
  const arCopyResetTimeoutRef = useRef<number | null>(null);

  const resetArHandoffState = useCallback(() => {
    if (arCopyResetTimeoutRef.current !== null) {
      window.clearTimeout(arCopyResetTimeoutRef.current);
      arCopyResetTimeoutRef.current = null;
    }
    setFallbackMode("none");
    setArCopyStatus("idle");
    setManualDishUrl("");
  }, []);

  const selectManualDishUrl = useCallback(() => {
    const input = manualDishUrlRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
  }, []);

  async function copyDishUrl() {
    if (arCopyStatus === "copying") return;
    if (arCopyResetTimeoutRef.current !== null) {
      window.clearTimeout(arCopyResetTimeoutRef.current);
      arCopyResetTimeoutRef.current = null;
    }
    const absoluteDishUrl = new URL(browserDishHref, window.location.origin).toString();
    setArCopyStatus("copying");
    const copied = await copyTextToClipboard(absoluteDishUrl);
    if (copied) {
      setManualDishUrl("");
      setArCopyStatus("success");
      arCopyResetTimeoutRef.current = window.setTimeout(() => {
        arCopyResetTimeoutRef.current = null;
        setArCopyStatus("idle");
      }, 4_000);
      return;
    }
    setManualDishUrl(absoluteDishUrl);
    setArCopyStatus("error");
  }

  function onArFallbackNeeded(reason: ArFallbackReason) {
    const mode = arFallbackUiMode(reason);
    if (mode === "none") resetArHandoffState();
    else setFallbackMode(mode);
  }

  useEffect(
    () => () => {
      if (arCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(arCopyResetTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (arCopyStatus !== "error" || !manualDishUrl) return;
    const frameId = window.requestAnimationFrame(selectManualDishUrl);
    return () => window.cancelAnimationFrame(frameId);
  }, [arCopyStatus, manualDishUrl, selectManualDishUrl]);

  useEffect(() => {
    if (!requested || ModelViewerComponent || modelViewerLoadFailed) return;
    let cancelled = false;
    import("@/components/dish/DishModelViewer")
      .then((mod) => {
        if (!cancelled) setModelViewerComponent(() => mod.DishModelViewer);
      })
      .catch(() => {
        if (!cancelled) setModelViewerLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ModelViewerComponent, modelViewerLoadFailed, requested]);

  return {
    ModelViewerComponent,
    modelViewerLoadFailed,
    fallbackMode,
    arHandoffPlatform,
    arCopyStatus,
    manualDishUrl,
    manualDishUrlRef,
    resetArHandoffState,
    onArFallbackNeeded,
    copyDishUrl,
    selectManualDishUrl
  };
}

function modelViewerDishFromPublicDish(
  dish: PublicMenuDish
): DishModelViewerProps["dish"] {
  return {
    slug: dish.slug,
    categorySlug: dish.category,
    name: dish.name,
    model3dUrl: dish.model3dUrl,
    webModel3dUrl: dish.webModel3dUrl,
    arModel3dUrl: dish.arModel3dUrl,
    arUsdzUrl: dish.arUsdzUrl || dish.usdzUrl,
    image: dish.imageUrl,
    imageObjectPosition: "center",
    imageObjectPositionDetail: "center"
  };
}

function BrowserHandoffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 8h17M7 6h.01M10 6h.01M13 6h.01" />
      <path d="m8 14 2.2 2.2L16 10.4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="11" height="12" rx="1.8" />
      <path d="M16 8V5.8A1.8 1.8 0 0 0 14.2 4H5.8A1.8 1.8 0 0 0 4 5.8v10.4A1.8 1.8 0 0 0 5.8 18H8" />
    </svg>
  );
}

export function TrouvableImmersivePanelBody({
  experience,
  copy,
  dish,
  menu,
  modelControlsId,
  onReturnToDish
}: TrouvableImmersivePanelBodyProps) {
  const {
    ModelViewerComponent,
    modelViewerLoadFailed,
    fallbackMode,
    arHandoffPlatform,
    arCopyStatus,
    manualDishUrl,
    manualDishUrlRef,
    resetArHandoffState,
    onArFallbackNeeded,
    copyDishUrl,
    selectManualDishUrl
  } = experience;
  const fallbackTitleId = `trouvable-ar-browser-fallback-${dish.slug}`;
  const manualDishUrlId = `trouvable-ar-manual-url-${dish.slug}`;
  const platformCopy = copy.arBrowserFallback[arHandoffPlatform];
  const deviceCopy = copy.arBrowserFallback.device;
  const assetCopy = {
    title: copy.modelViewer.arAssetUnavailableTitle,
    body: copy.modelViewer.arAssetUnavailableBody
  };

  return (
    <>
      <div
        className={styles.inlineModelViewer}
        id={modelControlsId}
        data-no-dish-swipe="true"
      >
        {ModelViewerComponent ? (
          <ModelViewerComponent
            dish={modelViewerDishFromPublicDish(dish)}
            analyticsContext={getPublicMenuAnalyticsContext(menu) ?? undefined}
            minimalChrome
            quietChrome
            copy={{
              loadingTitle: copy.modelPreparing,
              ...copy.modelViewer,
              modelAlt: copy.modelAlt
            }}
            onReturnToDish={onReturnToDish}
            onArFallbackNeeded={onArFallbackNeeded}
            onArFallbackCleared={resetArHandoffState}
            fallbackPresentation="external"
          />
        ) : modelViewerLoadFailed ? (
          <div className={styles.modelLoading} role="status">
            {copy.modelUnavailable}
          </div>
        ) : (
          <div className={styles.modelLoading} role="status">
            {copy.modelPreparing}
          </div>
        )}
      </div>
      {fallbackMode === "asset" ? (
        <aside
          className={styles.arBrowserFallback}
          aria-labelledby={`${fallbackTitleId}-asset`}
          data-ar-experience="asset-unavailable"
          role="status"
          aria-live="polite"
          dir="auto"
        >
          <span className={styles.arBrowserFallbackIcon} aria-hidden="true">
            <BrowserHandoffIcon />
          </span>
          <div className={styles.arBrowserFallbackContent}>
            <h3 id={`${fallbackTitleId}-asset`}>{assetCopy.title}</h3>
            <p>{assetCopy.body}</p>
          </div>
        </aside>
      ) : null}
      {fallbackMode === "device" ? (
        <aside
          className={styles.arBrowserFallback}
          aria-labelledby={`${fallbackTitleId}-device`}
          data-ar-experience="unsupported-device"
          role="alert"
          aria-live="assertive"
          dir="auto"
        >
          <span className={styles.arBrowserFallbackIcon} aria-hidden="true">
            <BrowserHandoffIcon />
          </span>
          <div className={styles.arBrowserFallbackContent}>
            <h3 id={`${fallbackTitleId}-device`}>{deviceCopy.title}</h3>
            <p>{deviceCopy.body}</p>
          </div>
        </aside>
      ) : null}
      {fallbackMode === "browser" ? (
        <aside
          className={styles.arBrowserFallback}
          aria-labelledby={fallbackTitleId}
          data-ar-experience="handoff"
          data-ar-recommended-browser={arHandoffPlatform === "other" ? undefined : arHandoffPlatform === "ios" ? "safari" : "chrome"}
          role="status"
          aria-live="polite"
          dir="auto"
        >
          <span className={styles.arBrowserFallbackIcon} aria-hidden="true">
            <BrowserHandoffIcon />
          </span>
          <div className={styles.arBrowserFallbackContent}>
            <h3 id={fallbackTitleId}>{platformCopy.title}</h3>
            <p>{platformCopy.body}</p>
          </div>
          <button
            type="button"
            className={styles.arCopyButton}
            onClick={() => void copyDishUrl()}
            disabled={arCopyStatus === "copying"}
          >
            <CopyIcon />
            {platformCopy.action}
          </button>
          {arCopyStatus === "success" ? (
            <p className={styles.arCopyStatus} role="status" aria-live="polite">
              {platformCopy.success}
            </p>
          ) : null}
          {arCopyStatus === "error" ? (
            <div className={styles.arManualCopy}>
              <p
                className={styles.arCopyStatus}
                role="alert"
                aria-live="assertive"
              >
                {copy.arBrowserFallback.copyError}
              </p>
              <label htmlFor={manualDishUrlId}>
                {copy.arBrowserFallback.manualCopyLabel}
              </label>
              <input
                ref={manualDishUrlRef}
                id={manualDishUrlId}
                type="url"
                readOnly
                value={manualDishUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className={styles.arSelectLinkButton}
                onClick={selectManualDishUrl}
              >
                {copy.arBrowserFallback.selectLink}
              </button>
            </div>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}

export function TrouvableDishDetailSurface({
  actionContent,
  children,
  copy,
  detailsExpanded,
  detailsId,
  dish,
  eyebrow,
  hasModel,
  headingLevel,
  locale,
  menuName,
  modelControlsId,
  modelExpanded,
  onClose,
  onOpenDetails,
  onToggleModel,
  price,
  secondaryEyebrow,
  showImmersiveUnavailable = false,
  textDirection,
  titleId
}: TrouvableDishDetailSurfaceProps) {
  const Heading = headingLevel;

  return (
    <>
      <div
        className={`${styles.detailVisual} ${
          dish.imageUrl ? styles.hasDishImage : ""
        }`}
      >
        {dish.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" loading="lazy" src={dish.imageUrl} />
        ) : (
          <span>{menuName.slice(0, 1)}</span>
        )}
      </div>
      <div
        className={styles.detailBody}
        aria-label={copy.moreDetails}
        dir={textDirection}
      >
        <header className={styles.sheetHeader}>
          <div>
            <p>{eyebrow}</p>
            {secondaryEyebrow ? (
              <span className={styles.detailEyebrowSecondary}>
                {secondaryEyebrow}
              </span>
            ) : null}
            <Heading id={titleId}>{dish.name}</Heading>
          </div>
          {onClose ? (
            <button
              type="button"
              className={styles.iconButton}
              aria-label={copy.closeDetail}
              onClick={onClose}
            >
              x
            </button>
          ) : null}
        </header>
        <AllergenWarning locale={locale} />
        {price ? <strong className={styles.detailPrice}>{price}</strong> : null}
        <button
          type="button"
          className={styles.moreDetailsButton}
          aria-expanded={detailsExpanded}
          aria-controls={detailsId}
          onClick={onOpenDetails}
        >
          <span aria-hidden="true">i</span>
          {copy.viewDetails}
        </button>
        <div className={styles.detailOptionTags} data-no-dish-swipe="true">
          <PremiumDishCardOptionTags
            items={dish.options}
            label={copy.cardOptionsLabel}
            variant="detail"
          />
        </div>
        <div className={styles.detailActions}>
          {actionContent}
          {hasModel ? (
            <button
              type="button"
              className={styles.modelCta}
              aria-controls={modelControlsId}
              aria-expanded={modelExpanded}
              onClick={onToggleModel}
            >
              {copy.threeD}
            </button>
          ) : null}
        </div>
        {!hasModel && showImmersiveUnavailable ? (
          <p className={styles.modelUnavailable}>{copy.immersiveUnavailable}</p>
        ) : null}
        {children}
      </div>
    </>
  );
}
