export type OwnerNavItem = {
  href: string;
  label: string;
  hint: string;
};

export const OWNER_NAV_ITEMS: OwnerNavItem[] = [
  { href: "/owner", label: "Restaurants", hint: "Portefeuille & actions" },
  {
    href: "/owner/restaurants/create",
    label: "Créer restaurant",
    hint: "Nouveau compte"
  },
  { href: "/owner/qr-codes", label: "QR Codes", hint: "Tables & tests" },
  { href: "/owner/3d-ar", label: "3D / AR", hint: "Pipeline immersif" },
  { href: "/owner/leads", label: "Leads", hint: "Contacts" },
  { href: "/owner/settings", label: "Settings", hint: "Compte owner" }
];

const OWNER_CONTEXT_ROUTES: OwnerNavItem[] = [
  { href: "/owner/restaurants", label: "Restaurants", hint: "Sélection avancée" },
  { href: "/owner/taches", label: "Tâches", hint: "Readiness & actions" },
  { href: "/owner/menus", label: "Menus", hint: "Cartes & statut" },
  {
    href: "/owner/menu-builder",
    label: "Atelier carte",
    hint: "UI menus & preview"
  },
  { href: "/owner/plats", label: "Plats", hint: "Qualite contenu" },
  { href: "/owner/medias", label: "Medias", hint: "Photos & assets" }
];

const OWNER_ROUTE_TITLES = [...OWNER_NAV_ITEMS, ...OWNER_CONTEXT_ROUTES];

export function ownerNavTitle(pathname: string): { label: string; hint: string } {
  const exact = OWNER_ROUTE_TITLES.find((item) => item.href === pathname);
  if (exact) return { label: exact.label, hint: exact.hint };
  if (/^\/owner\/restaurants\/[^/]+/.test(pathname)) {
    return { label: "Dashboard restaurant", hint: "Menu, QR et mise en ligne" };
  }
  const nested = [...OWNER_ROUTE_TITLES]
    .filter((item) => item.href !== "/owner" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (nested) return { label: nested.label, hint: nested.hint };
  return { label: "Restaurants", hint: "Portefeuille & actions" };
}
