export type OwnerNavItem = {
  href: string;
  label: string;
  hint: string;
};

export type OwnerShellRestaurant = {
  id: string;
  name: string;
  slug: string;
  dashboardHref: string;
  readinessScore: number;
  statusLabel: string;
};

export const OWNER_PORTFOLIO_NAV_ITEMS: OwnerNavItem[] = [
  { href: "/owner", label: "Restaurants", hint: "Portefeuille & actions" },
  { href: "/owner/model-lab", label: "Model Lab", hint: "GLB local" },
  {
    href: "/owner/restaurants/create",
    label: "Créer restaurant",
    hint: "Nouveau compte"
  }
];

export const OWNER_ACCOUNT_NAV_ITEMS: OwnerNavItem[] = [
  { href: "/owner/settings", label: "Paramètres", hint: "Compte owner" }
];

export const OWNER_LEGACY_NAV_ITEMS: OwnerNavItem[] = [
  { href: "/owner/qr-codes", label: "QR Codes", hint: "Tables & tests" },
  { href: "/owner/3d-ar", label: "3D / AR", hint: "Pipeline immersif" },
  { href: "/owner/leads", label: "Leads", hint: "Contacts" }
];

export function ownerRestaurantNavItems(restaurantId: string): OwnerNavItem[] {
  const safeId = encodeURIComponent(restaurantId);
  const base = `/owner/restaurants/${safeId}`;

  return [
    { href: base, label: "Vue d’ensemble", hint: "Priorité & readiness" },
    { href: `${base}/menu`, label: "Carte & plats", hint: "Prix, descriptions" },
    { href: `${base}/medias`, label: "Médias", hint: "Photos & modèles" },
    { href: `${base}/3d`, label: "3D / AR", hint: "GLB -> USDZ" },
    { href: `${base}/preview`, label: "Aperçu du menu", hint: "Vue client QR" },
    { href: `${base}/qr`, label: "QR & publication", hint: "Lien public" },
    { href: `${base}/settings`, label: "Paramètres", hint: "Restaurant" }
  ];
}

const OWNER_CONTEXT_ROUTES: OwnerNavItem[] = [
  { href: "/owner/restaurants", label: "Restaurants", hint: "Sélection avancée" },
  { href: "/owner/taches", label: "Tâches", hint: "Readiness & actions" },
  { href: "/owner/menus", label: "Menus", hint: "Cartes & statut" },
  {
    href: "/owner/menu-builder",
    label: "Atelier carte",
    hint: "UI menus & preview"
  },
  { href: "/owner/plats", label: "Plats", hint: "Qualité contenu" },
  { href: "/owner/medias", label: "Médias", hint: "Photos & assets" }
];

const OWNER_RESTAURANT_ROUTE_TITLES: Array<{
  pattern: RegExp;
  label: string;
  hint: string;
}> = [
  {
    pattern: /^\/owner\/restaurants\/[^/]+\/menu\/?$/,
    label: "Carte & plats",
    hint: "Prix, descriptions et disponibilité"
  },
  {
    pattern: /^\/owner\/restaurants\/[^/]+\/medias\/?$/,
    label: "Médias",
    hint: "Photos, GLB, modèles et AR"
  },
  {
    pattern: /^\/owner\/restaurants\/[^/]+\/preview\/?$/,
    label: "Aperçu du menu",
    hint: "Ce que verra le client après scan"
  },
  {
    pattern: /^\/owner\/restaurants\/[^/]+\/qr\/?$/,
    label: "QR & publication",
    hint: "Lien public, QR et mise en ligne"
  },
  {
    pattern: /^\/owner\/restaurants\/[^/]+\/settings\/?$/,
    label: "Paramètres",
    hint: "Informations du restaurant"
  },
  {
    pattern: /^\/owner\/restaurants\/[^/]+\/3d\/?$/,
    label: "3D / AR",
    hint: "GLB, USDZ et comparaison visuelle"
  }
];

const OWNER_ROUTE_TITLES = [
  ...OWNER_PORTFOLIO_NAV_ITEMS,
  ...OWNER_ACCOUNT_NAV_ITEMS,
  ...OWNER_LEGACY_NAV_ITEMS,
  ...OWNER_CONTEXT_ROUTES
];

export function ownerNavTitle(pathname: string): { label: string; hint: string } {
  const exact = OWNER_ROUTE_TITLES.find((item) => item.href === pathname);
  if (exact) return { label: exact.label, hint: exact.hint };

  const restaurantRoute = OWNER_RESTAURANT_ROUTE_TITLES.find((item) =>
    item.pattern.test(pathname)
  );
  if (restaurantRoute) {
    return { label: restaurantRoute.label, hint: restaurantRoute.hint };
  }

  if (/^\/owner\/restaurants\/[^/]+/.test(pathname)) {
    return { label: "Dashboard restaurant", hint: "Menu, QR et mise en ligne" };
  }

  const nested = [...OWNER_ROUTE_TITLES]
    .filter((item) => item.href !== "/owner" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (nested) return { label: nested.label, hint: nested.hint };
  return { label: "Restaurants", hint: "Portefeuille & actions" };
}
