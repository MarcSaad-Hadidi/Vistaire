"use client";

import type { RefObject } from "react";
import type { TransitionPresenceState } from "@/lib/useTransitionPresence";
import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";
import type { getTrouvableCopy } from "./trouvableMenuControls";
import { AllergenDisclosure } from "./AllergenDisclosure";
import {
  PremiumDishTagGroup,
  PremiumDishTagsFallback
} from "./PremiumDishTags";
import sheetStyles from "./PremiumDishDetailsSheet.module.css";
import tagStyles from "./PremiumDishTags.module.css";

type TrouvableCopy = ReturnType<typeof getTrouvableCopy>;

type PremiumDishDetailsSheetProps = {
  dish: PublicMenuDish;
  copy: TrouvableCopy;
  sheetId: string;
  titleId: string;
  onClose: () => void;
  panelRef?: RefObject<HTMLElement | null>;
  className?: string;
  userTheme?: "dark" | "light";
  dataState?: TransitionPresenceState;
  locale?: string;
};

export function PremiumDishDetailsSheet({
  dish,
  copy,
  sheetId,
  titleId,
  onClose,
  panelRef,
  className = "",
  userTheme = "dark",
  dataState = "open",
  locale = "fr"
}: PremiumDishDetailsSheetProps) {
  const compositionId = `${sheetId}-composition-label`;
  const optionsId = `${sheetId}-options-label`;
  const houseNoteId = `${sheetId}-house-note-label`;

  const hasDescription = Boolean(dish.description.trim());
  const hasHouseNote = Boolean(dish.houseNote.trim());
  const hasIngredients = dish.ingredients.some((item) => item.trim());
  const hasAllergens =
    dish.allergens.some((item) => item.trim()) ||
    (dish.allergenDeclarations?.length ?? 0) > 0;
  const hasOptions = dish.options.some((item) => item.trim());
  const hasStructuredContent =
    hasDescription ||
    hasHouseNote ||
    hasIngredients ||
    hasAllergens ||
    hasOptions;

  return (
    <div
      className={sheetStyles.overlay}
      data-sheet-state={dataState}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-user-theme={userTheme}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-no-dish-swipe="true"
      data-no-category-swipe="true"
    >
      <section
        ref={panelRef}
        id={sheetId}
        className={`${sheetStyles.sheet} ${className}`.trim()}
        tabIndex={-1}
      >
        <button
          type="button"
          className={sheetStyles.close}
          aria-label={copy.closeDetail}
          onClick={onClose}
        >
          x
        </button>
        <header className={sheetStyles.header}>
          <p className={sheetStyles.kicker}>{dish.name}</p>
          <h2 id={titleId} className={sheetStyles.title}>
            {copy.viewDetails}
          </h2>
        </header>

        {hasDescription ? (
          <p className={sheetStyles.description}>{dish.description}</p>
        ) : null}

        {hasHouseNote ? (
          <section className={sheetStyles.houseNote} aria-labelledby={houseNoteId}>
            <p id={houseNoteId} className={sheetStyles.houseNoteLabel}>
              {copy.detailHouseNoteLabel}
            </p>
            <p className={sheetStyles.houseNoteText}>{dish.houseNote}</p>
          </section>
        ) : null}

        <div className={sheetStyles.groups}>
          <PremiumDishTagGroup
            label={copy.detailCompositionLabel}
            items={dish.ingredients}
            kind="ingredient"
            labelledById={compositionId}
          />
          <AllergenDisclosure dish={dish} locale={locale} includeWarning={false} />
          <PremiumDishTagGroup
            label={copy.detailOptionsLabel}
            items={dish.options}
            kind="option"
            labelledById={optionsId}
          />
        </div>

        {!hasStructuredContent ? (
          <PremiumDishTagsFallback>
            <span className={tagStyles.label}>{copy.detailFallback}</span>
          </PremiumDishTagsFallback>
        ) : null}
      </section>
    </div>
  );
}
