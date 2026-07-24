import type { PublicMenuDish } from "@/lib/menu/publicMenuCore";
import type { PublicMenuStyle } from "@/lib/menu/publicMenuSettings";
import {
  uniqueMenuDesignOwnerStatusLabel,
  type UniqueMenuDesignStatus
} from "@/lib/menu/uniqueMenuDesign";
import type { OwnerQrStatus, OwnerRestaurant } from "@/lib/owner/types";

export type OwnerPreparationTone = "ready" | "warn" | "danger" | "muted";

export type OwnerRestaurantRouteId =
  | "overview"
  | "menu"
  | "medias"
  | "3d"
  | "preview"
  | "qr"
  | "settings";

export type OwnerPreparationItem = {
  id: string;
  label: string;
  detail: string;
  status: string;
  tone: OwnerPreparationTone;
  href: string;
};

export type OwnerNextAction = {
  title: string;
  body: string;
  href: string;
  label: string;
};

export type OwnerIssue = {
  id: string;
  title: string;
  body: string;
  href: string;
  label: string;
  tone: OwnerPreparationTone;
};

export type OwnerPreparationSummary = {
  categoryCount: number;
  dishCount: number;
  pricedDishCount: number;
  missingPriceCount: number;
  describedDishCount: number;
  missingDescriptionCount: number;
  availableDishCount: number;
  photoDishCount: number;
  missingPhotoCount: number;
  webModelCount: number;
  arModelCount: number;
  immersiveDishCount: number;
};

export type OwnerRestaurantPreparation = {
  summary: OwnerPreparationSummary;
  checklist: OwnerPreparationItem[];
  nextAction: OwnerNextAction;
  issues: OwnerIssue[];
};

function restaurantBasePath(restaurant: OwnerRestaurant): string {
  return `/owner/restaurants/${encodeURIComponent(restaurant.id)}`;
}

export function ownerRestaurantRoute(
  restaurant: OwnerRestaurant,
  route: OwnerRestaurantRouteId = "overview"
): string {
  const base = restaurantBasePath(restaurant);
  return route === "overview" ? base : `${base}/${route}`;
}

export function qrTone(status: OwnerQrStatus): OwnerPreparationTone {
  if (status === "ready") return "ready";
  if (status === "generable") return "warn";
  return "danger";
}

export function statusTone(restaurant: OwnerRestaurant): OwnerPreparationTone {
  if (restaurant.status === "active" || restaurant.status === "demo") return "ready";
  if (restaurant.status === "setup_needed") return "warn";
  return "muted";
}

export function restaurantStatusLabel(restaurant: OwnerRestaurant): string {
  if (restaurant.status === "archived") return "Archivé";
  if (restaurant.status === "paused") return "Brouillon";
  if (restaurant.readinessScore >= 80 && restaurant.qrStatus === "ready") {
    return "Prêt";
  }
  if (restaurant.status === "active") return "Publié";
  return "À compléter";
}

function isMissingProfileValue(value: string): boolean {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return !normalized.trim() || normalized.includes("preciser");
}

function hasPrice(dish: PublicMenuDish): boolean {
  return Boolean(dish.priceLabel.trim());
}

function hasDescription(dish: PublicMenuDish): boolean {
  return Boolean(dish.description.trim());
}

export function buildOwnerPreparationSummary(
  restaurant: OwnerRestaurant,
  dishes: PublicMenuDish[] = []
): OwnerPreparationSummary {
  const dishCount = dishes.length || restaurant.dishCount;
  const categories = new Set(
    dishes.map((dish) => dish.category.trim()).filter(Boolean)
  );
  const pricedDishCount = dishes.length
    ? dishes.filter(hasPrice).length
    : restaurant.dishCount > 0
      ? restaurant.dishCount
      : 0;
  const describedDishCount = dishes.length
    ? dishes.filter(hasDescription).length
    : restaurant.dishCount > 0
      ? restaurant.dishCount
      : 0;
  const photoDishCount = dishes.length
    ? dishes.filter((dish) => dish.hasPhoto).length
    : restaurant.photoDishCount;
  const webModelCount = dishes.length
    ? dishes.filter((dish) => Boolean(dish.webModel3dUrl)).length
    : restaurant.immersiveDishCount;
  const arModelCount = dishes.length
    ? dishes.filter((dish) => Boolean(dish.arUsdzUrl || dish.arModel3dUrl)).length
    : restaurant.immersiveDishCount;
  const immersiveDishCount = dishes.length
    ? dishes.filter((dish) => dish.hasImmersive).length
    : restaurant.immersiveDishCount;

  return {
    categoryCount: categories.size,
    dishCount,
    pricedDishCount,
    missingPriceCount: Math.max(0, dishCount - pricedDishCount),
    describedDishCount,
    missingDescriptionCount: Math.max(0, dishCount - describedDishCount),
    availableDishCount: dishes.length
      ? dishes.filter((dish) => dish.available).length
      : dishCount,
    photoDishCount,
    missingPhotoCount: Math.max(0, dishCount - photoDishCount),
    webModelCount,
    arModelCount,
    immersiveDishCount
  };
}

export function buildOwnerRestaurantPreparation(
  restaurant: OwnerRestaurant,
  dishes: PublicMenuDish[] = [],
  options?: {
    publicMenuStyle?: PublicMenuStyle | null;
    uniqueDesignStatus?: UniqueMenuDesignStatus | null;
  }
): OwnerRestaurantPreparation {
  const summary = buildOwnerPreparationSummary(restaurant, dishes);
  const infoComplete =
    !isMissingProfileValue(restaurant.name) &&
    !isMissingProfileValue(restaurant.location) &&
    !isMissingProfileValue(restaurant.cuisineType);
  const menuHref = ownerRestaurantRoute(restaurant, "menu");
  const mediasHref = ownerRestaurantRoute(restaurant, "medias");
  const modelsHref = ownerRestaurantRoute(restaurant, "3d");
  const previewHref = ownerRestaurantRoute(restaurant, "preview");
  const qrHref = ownerRestaurantRoute(restaurant, "qr");
  const settingsHref = ownerRestaurantRoute(restaurant, "settings");
  const uniqueUiHref = `/owner/restaurants/${encodeURIComponent(restaurant.id)}/unique-ui`;
  const isUnique = options?.publicMenuStyle === "unique";
  const uniqueStatusLabel = uniqueMenuDesignOwnerStatusLabel(
    options?.uniqueDesignStatus
  );

  const checklist: OwnerPreparationItem[] = [
    {
      id: "profile",
      label: "Infos restaurant complètes",
      detail: infoComplete
        ? `${restaurant.location} · ${restaurant.cuisineType}`
        : "Nom, lieu ou type de cuisine à compléter.",
      status: infoComplete ? "OK" : "À compléter",
      tone: infoComplete ? "ready" : "warn",
      href: settingsHref
    },
    {
      id: "categories",
      label: "Catégories créées",
      detail:
        summary.categoryCount > 0
          ? `${summary.categoryCount} catégorie(s) visibles.`
          : "Aucune catégorie visible dans la carte.",
      status: summary.categoryCount > 0 ? "OK" : "À créer",
      tone: summary.categoryCount > 0 ? "ready" : "danger",
      href: menuHref
    },
    {
      id: "dishes",
      label: "Plats ajoutés",
      detail:
        summary.dishCount > 0
          ? `${summary.dishCount} plat(s) dans le menu.`
          : "Ajoutez les premiers plats avant de publier.",
      status: summary.dishCount > 0 ? "OK" : "À ajouter",
      tone: summary.dishCount > 0 ? "ready" : "danger",
      href: menuHref
    },
    {
      id: "prices",
      label: "Prix complétés",
      detail:
        summary.dishCount > 0
          ? `${summary.pricedDishCount}/${summary.dishCount} prix visibles.`
          : "Aucun prix à vérifier tant que la carte est vide.",
      status: summary.missingPriceCount === 0 && summary.dishCount > 0 ? "OK" : "À vérifier",
      tone:
        summary.missingPriceCount === 0 && summary.dishCount > 0
          ? "ready"
          : "warn",
      href: menuHref
    },
    {
      id: "photos",
      label: "Photos ajoutées",
      detail:
        summary.dishCount > 0
          ? `${summary.photoDishCount}/${summary.dishCount} photos prêtes.`
          : "Les photos se préparent après les plats.",
      status: summary.missingPhotoCount === 0 && summary.dishCount > 0 ? "OK" : "À compléter",
      tone:
        summary.missingPhotoCount === 0 && summary.dishCount > 0
          ? "ready"
          : "warn",
      href: mediasHref
    },
    ...(isUnique
      ? [
          {
            id: "ui-unique",
            label: "Type de UI : Unique",
            detail:
              "Gérez le cycle de vie ici ; personnalisez le fallback dans le Design Studio.",
            status: uniqueStatusLabel,
            tone:
              options?.uniqueDesignStatus === "published"
                ? ("ready" as const)
                : ("warn" as const),
            href: uniqueUiHref
          }
        ]
      : []),
    {
      id: "media",
      label: "Médias 3D/AR prêts si inclus",
      detail:
        summary.immersiveDishCount > 0
          ? `${summary.webModelCount} GLB web · ${summary.arModelCount} AR/iOS.`
          : "Aucun modèle 3D/AR requis détecté.",
      status: summary.immersiveDishCount > 0 ? "OK" : "Optionnel",
      tone: summary.immersiveDishCount > 0 ? "ready" : "muted",
      href: modelsHref
    },
    {
      id: "qr",
      label: "QR généré",
      detail: restaurant.qrStatusLabel,
      status: restaurant.qrStatus === "ready" ? "OK" : "À préparer",
      tone: qrTone(restaurant.qrStatus),
      href: qrHref
    },
    {
      id: "preview",
      label: "Aperçu client vérifié",
      detail: isUnique
        ? "Vérifiez le menu public mobile avant impression ou publication."
        : "Ouvrez le rendu mobile avant impression ou publication.",
      status: "À vérifier",
      tone: "warn",
      href: previewHref
    }
  ];

  let nextAction: OwnerNextAction;
  if (isUnique && options?.uniqueDesignStatus !== "published") {
    nextAction = {
      title: "Créer le UI unique",
      body: "Une identité de design unique est en attente. Gérez son cycle de vie dans l'espace UI unique.",
      href: uniqueUiHref,
      label: "Créer le UI unique"
    };
  } else if (summary.dishCount === 0) {
    nextAction = {
      title: "Ajoutez les premiers plats.",
      body: "La carte client ne peut pas être validée tant qu’aucun plat n’est rattaché au restaurant.",
      href: menuHref,
      label: "Ouvrir Carte & plats"
    };
  } else if (summary.missingPriceCount > 0) {
    nextAction = {
      title: "Complétez les prix manquants.",
      body: `${summary.missingPriceCount} plat(s) n’ont pas encore de prix visible.`,
      href: menuHref,
      label: "Corriger les prix"
    };
  } else if (summary.missingDescriptionCount > 0) {
    nextAction = {
      title: "Ajoutez les descriptions manquantes.",
      body: `${summary.missingDescriptionCount} plat(s) méritent une description claire avant le scan QR.`,
      href: menuHref,
      label: "Corriger les descriptions"
    };
  } else if (summary.missingPhotoCount > 0) {
    nextAction = {
      title: "Ajoutez les photos des plats.",
      body: `${summary.missingPhotoCount} plat(s) restent sans photo dans l’expérience client.`,
      href: mediasHref,
      label: "Ouvrir Médias"
    };
  } else if (restaurant.qrStatus !== "ready") {
    nextAction = {
      title: "Préparez le QR du restaurant.",
      body: "Le lien public existe, mais le QR doit être généré ou validé avant impression.",
      href: qrHref,
      label: "Préparer le QR"
    };
  } else {
    nextAction = {
      title: "Vérifiez l’aperçu client avant publication.",
      body: "Le restaurant semble prêt; contrôlez le rendu mobile que les clients verront après scan.",
      href: previewHref,
      label: "Voir l’aperçu"
    };
  }

  const issues: OwnerIssue[] = [];
  if (!infoComplete) {
    issues.push({
      id: "profile",
      title: "Infos restaurant incomplètes",
      body: "Lieu ou type de cuisine à confirmer.",
      href: settingsHref,
      label: "Corriger",
      tone: "warn"
    });
  }
  if (summary.dishCount === 0) {
    issues.push({
      id: "dishes",
      title: "Aucun plat visible",
      body: "Ajoutez une première carte pour créer une expérience client.",
      href: menuHref,
      label: "Corriger",
      tone: "danger"
    });
  }
  if (summary.missingPriceCount > 0) {
    issues.push({
      id: "prices",
      title: "Prix manquants",
      body: `${summary.missingPriceCount} plat(s) sans prix visible.`,
      href: menuHref,
      label: "Corriger",
      tone: "warn"
    });
  }
  if (summary.missingDescriptionCount > 0) {
    issues.push({
      id: "descriptions",
      title: "Descriptions à compléter",
      body: `${summary.missingDescriptionCount} plat(s) sans description.`,
      href: menuHref,
      label: "Corriger",
      tone: "warn"
    });
  }
  if (summary.missingPhotoCount > 0) {
    issues.push({
      id: "photos",
      title: "Photos manquantes",
      body: `${summary.missingPhotoCount} plat(s) sans photo.`,
      href: mediasHref,
      label: "Corriger",
      tone: "warn"
    });
  }
  if (restaurant.qrStatus !== "ready") {
    issues.push({
      id: "qr",
      title: "QR à préparer",
      body: restaurant.qrStatusLabel,
      href: qrHref,
      label: "Corriger",
      tone: qrTone(restaurant.qrStatus)
    });
  }

  return {
    summary,
    checklist,
    nextAction,
    issues: issues.slice(0, 5)
  };
}

export function previewAvailabilityLabel(restaurant: OwnerRestaurant): string {
  if (restaurant.menuUrlSource === "column") return "Lien public configuré";
  if (restaurant.menuUrlSource === "demo") return "Menu démo";
  return "Aperçu public dérivé du slug";
}
