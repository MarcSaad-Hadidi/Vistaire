"use client";

import type { ReactNode } from "react";
import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";
import { AllergenWarning } from "./AllergenDisclosure";
import { PremiumDishCardOptionTags } from "./PremiumDishTags";
import type {
  TrouvableCopy,
  TrouvableLocale
} from "./trouvableMenuControls";
import styles from "./TrouvablePremiumMenuExperience.module.css";

type TrouvableDishDetailSurfaceProps = {
  actionContent?: ReactNode;
  children?: ReactNode;
  copy: TrouvableCopy;
  detailsExpanded: boolean;
  detailsId: string;
  dish: PublicMenuDish;
  hasModel: boolean;
  headingLevel: "h1" | "h2";
  locale: TrouvableLocale;
  menuName: string;
  modelControlsId: string;
  modelExpanded: boolean;
  onClose?: () => void;
  onOpenDetails: () => void;
  onOpenReview: () => void;
  onToggleModel: () => void;
  price: string;
  showImmersiveUnavailable?: boolean;
  textDirection: "ltr" | "rtl";
  titleId: string;
};

export function TrouvableDishDetailSurface({
  actionContent,
  children,
  copy,
  detailsExpanded,
  detailsId,
  dish,
  hasModel,
  headingLevel,
  locale,
  menuName,
  modelControlsId,
  modelExpanded,
  onClose,
  onOpenDetails,
  onOpenReview,
  onToggleModel,
  price,
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
            <p>{dish.category}</p>
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
        <button
          type="button"
          className={styles.reviewTrigger}
          aria-haspopup="dialog"
          onClick={onOpenReview}
        >
          <span aria-hidden="true">★</span>
          {copy.review}
        </button>
      </div>
    </>
  );
}
