import { useMemo, useState } from "react";
import { dishes } from "../../../../../content.js";
import {
  VistairePreviewPdfCompareSlider,
  VistairePreviewMenuLayer,
} from "../../vistaire-preview/VistairePreviewPdfCompareSlider.tsx";
import { VistairePdfToDigitalHoverReveal } from "../../vistaire-preview/VistairePdfToDigitalHoverReveal.tsx";

export function LandingComparison({
  copy,
  experiences,
  locale,
  interaction = "slider",
}: any) {
  const [active, setActive] = useState(0);
  const experience = experiences[active];
  const english = locale === "en";
  const preview = useMemo(() => {
    const selected = dishes.filter(
      (dish) => dish.restaurant === experience.name,
    );
    const number = new Intl.NumberFormat(english ? "en-CA" : "fr-CA", {
      style: "currency",
      currency: "CAD",
    });
    const categories = [...new Set(selected.map((dish) => dish.category))];
    const translated: Record<string, string> = {
      "Plats signatures": "Signature dishes",
      Desserts: "Desserts",
      Entrées: "Starters",
      "Voyage à l’assiette": "A journey on the plate",
      "Classiques réinventés": "Classics reimagined",
    };
    const categoryName = (name: string) =>
      english ? (translated[name] ?? name) : name;
    return {
      restaurant: { name: experience.name },
      pdfSections: categories.map((category) => ({
        title: categoryName(category),
        rows: selected
          .filter((dish) => dish.category === category)
          .map((dish) => ({
            name: dish.fullName,
            price: number.format(dish.price),
          })),
      })),
      categoryCards: categories.map((category, index) => ({
        id: category,
        name: categoryName(category),
        description: english
          ? "Explore the restaurant menu"
          : "Découvrir la carte du restaurant",
        image: `/assets/${selected.find((dish) => dish.category === category)!.image}.webp`,
        imageObjectPosition: "50% 50%",
      })),
      vistaireDishes: selected.map((dish) => ({
        name: dish.fullName,
        shortDescription: english
          ? "Discover in the original menu"
          : dish.description,
        price: number.format(dish.price),
        image: `/assets/${dish.image}.webp`,
        imageObjectPosition: "50% 50%",
      })),
      presentation: {
        theme: experience.id,
        eyebrow: english ? "At your table" : "À votre table",
        title: experience.name,
        tagline: english
          ? "An overview of selected dishes. Open the original menu to explore every detail."
          : "Un aperçu de plats sélectionnés. Ouvrez la carte originale pour découvrir tous les détails.",
        featuredKicker: english ? "Selected dish" : "Plat sélectionné",
        featuredTitle: english ? "Discover" : "À découvrir",
        cta: english
          ? "Open the full menu below"
          : "Ouvrir la carte complète ci-dessous",
      },
    };
  }, [experience, english]);
  const digital = <VistairePreviewMenuLayer preview={preview as any} />;
  return (
    <div className="public-comparison">
      <div className="public-comparison-copy">
        <div role="tablist" aria-label={copy.tabLabel} className="public-tabs">
          {experiences.map((item: any, index: number) => (
            <button
              id={`compare-tab-${item.id}`}
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-controls="public-comparison-panel"
              onClick={() => setActive(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  const next =
                    (index +
                      (event.key === "ArrowRight"
                        ? 1
                        : experiences.length - 1)) %
                    experiences.length;
                  setActive(next);
                  document
                    .getElementById(`compare-tab-${experiences[next].id}`)
                    ?.focus();
                }
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <h3>{experience.name}</h3>
        <p>
          {english
            ? "Compare a paper-style view with a visual preview of the same selected dishes."
            : "Comparez une lecture de type papier et un aperçu visuel des mêmes plats sélectionnés."}
        </p>
        <a
          className="public-gold-button"
          href={experience.publicMenuHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.openCta} ↗
        </a>
      </div>
      <div
        id="public-comparison-panel"
        role="tabpanel"
        aria-labelledby={`compare-tab-${experience.id}`}
        key={experience.id}
      >
        {interaction === "reveal" ? (
          <VistairePdfToDigitalHoverReveal
            preview={preview as any}
            locale={locale}
            digitalLayer={digital}
          />
        ) : (
          <VistairePreviewPdfCompareSlider
            preview={preview as any}
            locale={locale}
            digitalLayer={digital}
          />
        )}
      </div>
    </div>
  );
}
