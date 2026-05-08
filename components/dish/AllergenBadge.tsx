import type { Allergen } from "@/lib/demoMenuData";

const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten",
  dairy: "Laitiers",
  nuts: "Fruits à coque",
  shellfish: "Crustacés",
  eggs: "Œufs",
  sesame: "Sésame",
  soy: "Soja",
  fish: "Poisson"
};

type AllergenBadgeProps = {
  allergen: Allergen;
  /** Variante dense pour cartes mobile / mockup téléphone. */
  compact?: boolean;
};

export function AllergenBadge({ allergen, compact }: AllergenBadgeProps) {
  return (
    <span
      className={
        compact
          ? "inline-flex rounded border border-white/10 bg-black/45 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#c9b8a2]"
          : "inline-flex rounded-md border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[#d4c4aa]"
      }
    >
      {ALLERGEN_LABELS[allergen]}
    </span>
  );
}
