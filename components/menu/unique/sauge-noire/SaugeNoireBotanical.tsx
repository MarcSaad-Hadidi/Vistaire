import styles from "./SaugeNoireBookMenu.module.css";

type BotanicalVariant =
  | "plant"
  | "branch"
  | "sprig"
  | "sideSprig"
  | "sansAlcoolBranch"
  | "cocktailStem"
  | "detailIngredients"
  | "detailAllergens"
  | "detailAccord"
  | "ornament";

type SaugeNoireBotanicalProps = {
  variant?: BotanicalVariant;
  className?: string;
};

const botanicalAssets: Record<Exclude<BotanicalVariant, "ornament">, string> = {
  plant: "/images/sauge-noire/botanicals/central-sage.png",
  branch: "/images/sauge-noire/botanicals/sans-alcool-branch.png",
  sprig: "/images/sauge-noire/botanicals/horizontal-sprig.png",
  sideSprig: "/images/sauge-noire/botanicals/side-sprig.png",
  sansAlcoolBranch: "/images/sauge-noire/botanicals/sans-alcool-branch.png",
  cocktailStem: "/images/sauge-noire/botanicals/cocktail-stem.png",
  detailIngredients: "/images/sauge-noire/botanicals/detail-ingredients.png",
  detailAllergens: "/images/sauge-noire/botanicals/detail-allergens.png",
  detailAccord: "/images/sauge-noire/botanicals/detail-accord.png"
};

/** Botanical assets extracted from the Sauge Noire reference plates. */
export function SaugeNoireBotanical({
  variant = "plant",
  className = ""
}: SaugeNoireBotanicalProps) {
  if (variant === "ornament") {
    return (
      <span className={`${styles.ornament} ${className}`} aria-hidden="true">
        <i />
        <b />
        <i />
      </span>
    );
  }

  const variantClass =
    variant === "plant"
      ? styles.botanicalPlant
      : variant === "sprig"
        ? styles.botanicalSprig
        : variant === "sideSprig"
          ? styles.botanicalSideSprig
          : variant === "cocktailStem"
            ? styles.botanicalCocktailStem
            : variant.startsWith("detail")
              ? styles.botanicalDetail
              : styles.botanicalBranch;

  return (
    <span className={`${styles.botanical} ${variantClass} ${className}`} role="img" aria-label="Illustration botanique de sauge">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={botanicalAssets[variant]} alt="Illustration botanique de sauge" loading="lazy" />
    </span>
  );
}
