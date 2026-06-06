export type OwnerNavItem = {
  href: string;
  label: string;
  hint: string;
};

export const OWNER_NAV_ITEMS: OwnerNavItem[] = [
  { href: "/owner", label: "Overview", hint: "Synthèse & priorités" },
  { href: "/owner/restaurants", label: "Restaurants", hint: "Comptes & readiness" },
  { href: "/owner/qr-codes", label: "QR Codes", hint: "Générer & tester" },
  { href: "/owner/menus", label: "Menus", hint: "Cartes & statut" },
  {
    href: "/owner/menu-builder",
    label: "Menu Builder",
    hint: "UI menus & preview"
  },
  { href: "/owner/plats", label: "Plats", hint: "Qualité contenu" },
  { href: "/owner/medias", label: "Médias", hint: "Photos & assets" },
  { href: "/owner/3d-ar", label: "3D / AR", hint: "Pipeline immersif" },
  { href: "/owner/leads", label: "Leads / Clients", hint: "Contacts" },
  { href: "/owner/taches", label: "Tâches", hint: "Readiness & actions" },
  { href: "/owner/settings", label: "Settings", hint: "Config & statut" }
];

export function ownerNavTitle(pathname: string): { label: string; hint: string } {
  const exact = OWNER_NAV_ITEMS.find((item) => item.href === pathname);
  if (exact) return { label: exact.label, hint: exact.hint };
  const nested = [...OWNER_NAV_ITEMS]
    .filter((item) => item.href !== "/owner" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (nested) return { label: nested.label, hint: nested.hint };
  return { label: "Overview", hint: "Synthèse & priorités" };
}
