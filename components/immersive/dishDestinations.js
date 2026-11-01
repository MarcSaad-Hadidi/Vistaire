// Routes verified against the published menus and their dish-page H1s.
// Android previews remain WebXR: compressed web GLBs are not Scene Viewer assets.
const ORIGIN = "https://www.vistaire.ca";

const entries = [
  ["homard", "maison-elyse", "homard-bleu-bisque-corsee-fenouil"],
  ["souffle", "maison-elyse", "souffle-tiede-au-chocolat-grand-cru"],
  ["huitres", "sauge-noire", "huitres-tiedes-au-kombu"],
  ["sushi", "trouvable", "plateau-sushi-horizon"],
  ["chocolat-fume", "sauge-noire", "chocolat-fume"],
  ["poutine", "trouvable", "poutine-du-vieux-montreal"],
  ["burger", "trouvable", "burger-signature-maison"],
];

export const dishDestinations = Object.freeze(
  Object.fromEntries(
    entries.map(([id, menuSlug, dishSlug]) => [
      id,
      Object.freeze({
        id,
        menuSlug,
        dishSlug,
        menuHref: `${ORIGIN}/menu/${menuSlug}?lang=fr-CA`,
        dishHref: `${ORIGIN}/menu/${menuSlug}/dishes/${dishSlug}?lang=fr-CA`,
      }),
    ]),
  ),
);

export function getDishDestination(itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  return Object.hasOwn(dishDestinations, id) ? dishDestinations[id] : null;
}

export function getDishHref(itemOrId) {
  return getDishDestination(itemOrId)?.dishHref ?? null;
}
