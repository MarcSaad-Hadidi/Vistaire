import { dishes, experiences } from "../../../../content.js";
import { getDishDestination } from "../../../../dishDestinations.js";
import type { Locale } from "../i18n.ts";

export type LandingExperienceId = "maison-elyse" | "trouvable" | "sauge-noire";
export type LandingExperience = ReturnType<
  typeof getLandingExperiences
>[number];

// The isolated frontend uses the seven dishes already verified in the prototype.
// Restaurant menus remain on their canonical production routes.
export function getLandingExperiences(locale: Locale = "fr") {
  const ids = ["homard", "poutine", "huitres"];
  const english = locale === "en";
  const labels = english
    ? [
        "Editorial & fine dining",
        "Modern & interactive",
        "Signature & immersive",
      ]
    : experiences.map((item) => item.tag);
  const names: Record<string, string> = {
    homard: "Blue lobster, rich bisque & fennel",
    poutine: "Old Montreal poutine",
    huitres: "Warm kombu oysters",
  };
  return experiences.map((experience, index) => {
    const dish = dishes.find((item) => item.id === ids[index])!;
    const destination = getDishDestination(dish)!;
    const suffix = english ? "en-CA" : "fr-CA";
    return {
      ...experience,
      label: labels[index],
      menuSlug: experience.id,
      image: `/assets/ambience-${experience.id}.webp`,
      imagePosition: "50% 50%",
      imageAlt: english
        ? `${experience.name} restaurant atmosphere`
        : `Atmosphère du restaurant ${experience.name}`,
      publicMenuHref: `https://www.vistaire.ca/menu/${experience.id}?lang=${suffix}`,
      featuredDish: {
        id: dish.id,
        slug: destination.dishSlug,
        name: english ? names[dish.id] : dish.fullName,
        description: english
          ? "Discover this dish in its original restaurant menu."
          : dish.description,
        price: new Intl.NumberFormat(english ? "en-CA" : "fr-CA", {
          style: "currency",
          currency: "CAD",
        }).format(dish.price),
        href: destination.dishHref.replace("lang=fr-CA", `lang=${suffix}`),
        image: `/assets/${dish.image}.webp`,
        imageSource: "verified-prototype",
        imageAlt: english ? names[dish.id] : dish.fullName,
        imagePosition: "50% 50%",
      },
    };
  });
}
