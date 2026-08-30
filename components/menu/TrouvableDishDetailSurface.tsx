"use client";

import type {
  ComponentType,
  ReactNode,
  RefObject
} from "react";
import type {
  ArFallbackReason,
  DishModelViewerProps
} from "@/components/dish/DishModelViewer";
import {
  getPublicMenuAnalyticsContext,
  type PublicMenuAnalyticsContext
} from "@/lib/analytics/client";
import type { ArHandoffPlatform } from "@/lib/menu/arBrowserHandoff";
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
  arCopyStatus: ArCopyStatus;
  arHandoffPlatform: ArHandoffPlatform;
  copy: TrouvableCopy;
  dish: PublicMenuDish;
  fallbackTitleId: string;
  manualDishUrl: string;
  manualDishUrlId: string;
  manualDishUrlRef: RefObject<HTMLInputElement | null>;
  menu: PublicMenu;
  analyticsContext?: PublicMenuAnalyticsContext;
  modelControlsId: string;
  modelViewerComponent: DishModelViewerComponent | null;
  modelViewerLoadFailed: boolean;
  onArFallbackCleared: () => void;
  onArFallbackNeeded: (reason: ArFallbackReason) => void;
  onCopyDishUrl: () => void;
  onReturnToDish: () => void;
  onSelectManualDishUrl: () => void;
  showArBrowserHelp: boolean;
  showArDeviceHelp?: boolean;
  showArAssetHelp?: boolean;
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
  arCopyStatus,
  arHandoffPlatform,
  copy,
  dish,
  fallbackTitleId,
  manualDishUrl,
  manualDishUrlId,
  manualDishUrlRef,
  menu,
  analyticsContext,
  modelControlsId,
  modelViewerComponent: ModelViewerComponent,
  modelViewerLoadFailed,
  onArFallbackCleared,
  onArFallbackNeeded,
  onCopyDishUrl,
  onReturnToDish,
  onSelectManualDishUrl,
  showArBrowserHelp,
  showArDeviceHelp = false,
  showArAssetHelp = false
}: TrouvableImmersivePanelBodyProps) {
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
            analyticsContext={analyticsContext ?? getPublicMenuAnalyticsContext(menu) ?? undefined}
            minimalChrome
            quietChrome
            copy={{
              loadingTitle: copy.modelPreparing,
              ...copy.modelViewer,
              modelAlt: copy.modelAlt
            }}
            onReturnToDish={onReturnToDish}
            onArFallbackNeeded={onArFallbackNeeded}
            onArFallbackCleared={onArFallbackCleared}
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
      {showArAssetHelp ? (
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
      {showArDeviceHelp ? (
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
      {showArBrowserHelp ? (
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
            onClick={onCopyDishUrl}
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
                onClick={onSelectManualDishUrl}
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
