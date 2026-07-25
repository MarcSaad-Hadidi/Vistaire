import fs from "node:fs";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const TARGET_SLUG = "sauge-noire";
export const TARGET_NAME = "Sauge Noire";

export const CANONICAL_SECTIONS = [
  { name: "Premiers gestes", description: "Petites assiettes, bouchées et premières saveurs à partager." },
  { name: "Cru & frais", description: "Produits marins, préparations crues et compositions fraîches." },
  { name: "Du feu", description: "Viandes, poissons et légumes travaillés à la braise ou à la flamme." },
  { name: "Terre & grains", description: "Céréales, légumes, pâtes et plats végétaux généreux." },
  { name: "À côté & desserts", description: "Accompagnements de la maison et créations sucrées." },
  { name: "Cocktails signatures", description: "Cocktails originaux inspirés de la sauge, du feu et des saisons." },
  { name: "Sans alcool", description: "Créations fraîches et complexes sans alcool." }
];

const dish = (name, section, price, description, ingredients, options, chefNote, badges, allergensContains = [], allergensConfirmedFree = [], customAllergens = []) => ({
  name,
  section,
  price,
  description,
  ingredients,
  options,
  chefNote,
  badges,
  allergensContains,
  allergensConfirmedFree,
  customAllergens
});

export const CANONICAL_DISHES = [
  dish("Pain de seigle chaud", "Premiers gestes", 9, "Ce pain de seigle chaud est servi avec un beurre fouetté à la sauge, du miel brûlé et une touche de fleur de sel.", ["pain de seigle", "beurre", "sauge", "miel", "fleur de sel"], ["beurre à part", "portion de pain supplémentaire +4 $"], "Une ouverture chaleureuse où la sauge et le miel brûlé révèlent toute la profondeur du seigle.", ["Maison", "Populaire"], ["Gluten / céréales", "Produits laitiers"]),
  dish("Betterave sous la cendre", "Premiers gestes", 16, "La betterave cuite sous la cendre est accompagnée de labneh fumé, de cassis, de pistache et d’un vinaigre de framboise.", ["betterave", "labneh", "cassis", "pistache", "vinaigre de framboise"], ["labneh à part", "sans pistache"], "La cuisson sous la cendre concentre les saveurs de la betterave et lui apporte une délicate note fumée.", ["Signature", "Recommande", "Vegetarien", "Sans gluten"], ["Produits laitiers", "Fruits à coque"], ["Gluten / céréales"]),
  dish("Croquette de canard confit", "Premiers gestes", 18, "La croquette de canard confit est servie avec une prune acidulée, de la moutarde noire et un jus de volaille réduit.", ["canard confit", "prune", "moutarde noire", "jus de volaille", "chapelure"], ["moutarde noire à part", "jus réduit à part"], "Une bouchée croustillante au cœur fondant, équilibrée par l’acidité de la prune.", ["Populaire"], ["Gluten / céréales", "Moutarde"]),
  dish("Chou pointu braisé", "Premiers gestes", 15, "Le chou pointu braisé est garni d’une crème de tournesol, de citron noir et d’une chapelure croustillante aux herbes.", ["chou pointu", "graines de tournesol", "citron noir", "chapelure", "herbes fraîches"], ["crème de tournesol à part", "sans chapelure"], "Un plat végétal généreux où le braisage révèle la douceur naturelle du chou.", ["Recommande", "Vegetarien"], ["Gluten / céréales"]),
  dish("Huîtres tièdes au kombu", "Premiers gestes", 20, "Trois huîtres tièdes au kombu sont servies avec de la pomme verte, du beurre noisette et une huile de livèche.", ["huîtres", "kombu", "pomme verte", "beurre noisette", "livèche"], ["portion supplémentaire de trois huîtres +18 $", "beurre noisette à part"], "Le kombu et la pomme verte soulignent la salinité naturelle des huîtres sans masquer leur finesse.", ["Nouveau"], ["Mollusques", "Produits laitiers"]),

  dish("Truite des Laurentides", "Cru & frais", 22, "La truite des Laurentides est servie crue avec de la groseille, de la livèche, du concombre et une huile parfumée au pin.", ["truite", "groseille", "livèche", "concombre", "huile de pin"], ["sans groseille", "huile de pin à part"], "Une composition fraîche inspirée des paysages québécois, entre petits fruits, herbes et notes forestières.", ["Signature", "Recommande", "Sans gluten"], ["Poisson"], ["Gluten / céréales"]),
  dish("Hamachi à la verveine", "Cru & frais", 24, "Le hamachi cru est accompagné de raisin vert, de jalapeño doux, de verjus, de verveine et de basilic thaï.", ["hamachi", "raisin vert", "jalapeño doux", "verjus", "verveine", "basilic thaï"], ["sans jalapeño", "jalapeño supplémentaire", "verjus à part"], "La verveine, le raisin et le jalapeño apportent au hamachi un équilibre vif, floral et légèrement relevé.", ["Nouveau"], ["Poisson"]),
  dish("Bœuf cru au couteau", "Cru & frais", 23, "Le bœuf coupé au couteau est assaisonné de café, de câpres soufflées et de jaune d’œuf salé, puis servi avec du pain croustillant.", ["bœuf", "café", "câpres", "jaune d’œuf", "pain croustillant"], ["sans jaune d’œuf", "pain croustillant à part", "portion de pain supplémentaire +3 $"], "Le café et le jaune d’œuf salé donnent à ce tartare une profondeur subtile et une finale très gourmande.", ["Populaire"], ["Gluten / céréales", "Œufs"]),
  dish("Crabe des neiges", "Cru & frais", 25, "Le crabe des neiges est servi avec du céleri croquant, du yuzu, du shiso et un lait d’amande légèrement salé.", ["crabe des neiges", "céleri", "yuzu", "shiso", "lait d’amande"], ["sans lait d’amande", "yuzu à part"], "Une assiette délicate qui met en valeur la douceur du crabe grâce à l’acidité du yuzu et à la fraîcheur du shiso.", ["Recommande"], ["Crustacés", "Fruits à coque"], [], ["Céleri"]),

  dish("Canard à l’érable noir", "Du feu", 39, "Le canard rôti à l’érable noir est servi avec une carotte fermentée, de la chicorée grillée et un jus parfumé au thym.", ["canard", "érable noir", "carotte fermentée", "chicorée", "thym", "jus de volaille"], ["cuisson rosée", "cuisson à point", "jus au thym à part", "ajout de pommes de terre pressées +8 $"], "Notre plat signature marie la richesse du canard à la profondeur caramélisée de l’érable noir.", ["Signature", "Maison", "Populaire", "Sans gluten"], [], ["Gluten / céréales"]),
  dish("Flétan rôti au nori", "Du feu", 42, "Le flétan rôti au nori est accompagné de beurre brun, de poireau brûlé et de pommes de terre fondantes.", ["flétan", "nori", "beurre brun", "poireau", "pommes de terre"], ["beurre brun à part", "remplacer les pommes de terre par une salade d’herbes"], "Le nori et le beurre brun accompagnent la chair délicate du flétan avec des notes marines et noisettées.", ["Recommande"], ["Poisson", "Produits laitiers"]),
  dish("Côte de porc du Québec", "Du feu", 38, "La côte de porc du Québec est servie avec de la prune fumée, du chou rouge, un jus au poivre et de la moutarde ancienne.", ["porc du Québec", "prune", "chou rouge", "poivre", "moutarde ancienne"], ["cuisson à point", "cuisson bien cuite", "moutarde ancienne à part", "ajout de pommes de terre pressées +8 $"], "La prune fumée et la moutarde ancienne apportent une finale fruitée et légèrement épicée à cette côte généreuse.", ["Maison"], ["Moutarde"]),
  dish("Agneau grillé au sumac", "Du feu", 41, "L’agneau grillé au sumac est accompagné d’aubergine fumée, de yaourt au cumin et de menthe fraîche.", ["agneau", "sumac", "aubergine", "yaourt", "cumin", "menthe"], ["cuisson rosée", "cuisson à point", "yaourt au cumin à part", "sans menthe"], "Le sumac apporte une acidité lumineuse qui équilibre parfaitement le caractère de l’agneau grillé.", ["Nouveau"], ["Produits laitiers"]),
  dish("Poulet de grain au citron confit", "Du feu", 34, "Le poulet de grain rôti au citron confit est servi avec du fenouil rôti, des olives vertes et un jus de volaille corsé.", ["poulet de grain", "citron confit", "fenouil", "olive verte", "jus de volaille"], ["jus corsé à part", "sans olives", "ajout de pommes de terre pressées +8 $"], "Une interprétation lumineuse et méditerranéenne du poulet rôti, relevée par le citron confit et l’olive verte.", ["Populaire"]),
  dish("Courge au charbon", "Du feu", 29, "La courge rôtie au charbon est servie avec du tahini noir, des pois chiches croustillants, de la datte et de la coriandre.", ["courge", "tahini noir", "pois chiches", "datte", "coriandre"], ["tahini noir à part", "sans coriandre", "pois chiches supplémentaires +4 $"], "La cuisson au charbon transforme la courge en un plat végétal profond, fumé et naturellement sucré.", ["Recommande", "Vegetarien", "Sans gluten"], ["Sésame"], ["Gluten / céréales"]),

  dish("Orge perlé des sous-bois", "Terre & grains", 28, "L’orge perlé est cuisiné avec des champignons sauvages, un jus de cèpes et du vieux cheddar.", ["orge perlé", "champignons sauvages", "cèpes", "vieux cheddar"], ["sans vieux cheddar", "cheddar supplémentaire +4 $"], "Une assiette réconfortante inspirée des sous-bois québécois et de leurs saveurs terreuses.", ["Maison", "Vegetarien"], ["Gluten / céréales", "Produits laitiers"]),
  dish("Gnocchi de panais", "Terre & grains", 30, "Les gnocchis de panais sont servis avec de la sauge frite, de la noisette, une crème d’ail noir et du pecorino.", ["gnocchi", "panais", "sauge", "noisette", "ail noir", "pecorino"], ["sans noisette", "pecorino à part", "pecorino supplémentaire +3 $"], "Le panais, la noisette et l’ail noir donnent à ces gnocchis une personnalité douce, boisée et profondément gourmande.", ["Signature", "Populaire", "Vegetarien"], ["Gluten / céréales", "Produits laitiers", "Fruits à coque"]),
  dish("Polenta blanche fumée", "Terre & grains", 26, "La polenta blanche fumée est garnie de maïs rôti, de piment doux, de pecorino et d’une huile de ciboulette.", ["polenta blanche", "maïs", "piment doux", "pecorino", "ciboulette"], ["sans pecorino", "huile de ciboulette à part"], "Une polenta soyeuse aux notes fumées, réveillée par le maïs rôti et le piment doux.", ["Recommande", "Vegetarien", "Sans gluten"], ["Produits laitiers"], ["Gluten / céréales"]),
  dish("Épeautre crémeux", "Terre & grains", 27, "L’épeautre crémeux est servi avec de l’artichaut grillé, du citron confit, des épinards et du parmesan.", ["épeautre", "artichaut", "citron confit", "épinards", "parmesan"], ["sans parmesan", "parmesan supplémentaire +3 $"], "Une composition végétale où la mâche de l’épeautre rencontre la fraîcheur du citron confit.", ["Nouveau", "Vegetarien"], ["Gluten / céréales", "Produits laitiers"]),

  dish("Pommes de terre pressées", "À côté & desserts", 11, "Les pommes de terre pressées sont servies avec un aïoli fumé et une poudre d’oignon brûlé.", ["pommes de terre", "aïoli", "oignon brûlé"], ["aïoli fumé à part", "aïoli supplémentaire +2 $"], "Un accompagnement croustillant et réconfortant, relevé par les notes fumées de l’aïoli.", ["Maison", "Populaire", "Vegetarien", "Sans gluten"], ["Œufs"], ["Gluten / céréales"]),
  dish("Haricots verts à la flamme", "À côté & desserts", 12, "Les haricots verts saisis à la flamme sont assaisonnés de sésame, de gingembre et de vinaigre de riz.", ["haricots verts", "sésame", "gingembre", "vinaigre de riz"], ["sans sésame", "vinaigre de riz à part"], "La cuisson vive apporte aux haricots une légère note grillée tout en conservant leur fraîcheur.", ["Vegetarien", "Sans gluten"], ["Sésame"], ["Gluten / céréales"]),
  dish("Salade d’herbes fraîches", "À côté & desserts", 13, "La salade d’herbes fraîches est accompagnée de poire, de noix, de verjus et de fromage frais.", ["herbes fraîches", "poire", "noix", "verjus", "fromage frais"], ["sans noix", "sans fromage frais", "vinaigrette à part"], "Une salade légère et aromatique conçue pour rafraîchir le palais entre les plats.", ["Recommande", "Vegetarien", "Sans gluten"], ["Fruits à coque", "Produits laitiers"], ["Gluten / céréales"]),
  dish("Chocolat fumé", "À côté & desserts", 15, "Le chocolat noir à 70 % est servi avec de l’huile d’olive, du sel fumé et du grué de cacao.", ["chocolat noir 70 %", "huile d’olive", "sel fumé", "grué de cacao"], ["sans sel fumé", "huile d’olive à part"], "La fumée, l’huile d’olive et le sel prolongent les arômes intenses du chocolat noir.", ["Signature", "Populaire", "Vegetarien"]),
  dish("Pomme au poivre long", "À côté & desserts", 14, "La pomme rôtie au poivre long est accompagnée de crème crue, de sarrasin et d’un caramel blond.", ["pomme", "poivre long", "crème crue", "sarrasin", "caramel blond"], ["caramel à part", "sans crème crue"], "Le poivre long révèle les notes chaudes et caramélisées de la pomme rôtie.", ["Maison", "Vegetarien"], ["Produits laitiers"]),
  dish("Parfait de maïs", "À côté & desserts", 15, "Le parfait de maïs est servi avec un caramel au miso, du popcorn salé et une glace au lait.", ["maïs", "caramel au miso", "popcorn", "glace au lait"], ["caramel au miso à part", "sans popcorn"], "Une création ludique qui explore toutes les facettes du maïs, du crémeux au croustillant.", ["Nouveau", "Vegetarien"], ["Produits laitiers", "Soja"]),
  dish("Agrumes au basilic thaï", "À côté & desserts", 13, "Les agrumes frais sont accompagnés de basilic thaï, d’un granité au tonic, d’une huile verte et d’une meringue légère.", ["agrumes", "basilic thaï", "tonic", "huile verte", "meringue"], ["sans meringue", "granité au tonic à part"], "Une finale fraîche et acidulée, portée par les parfums anisés du basilic thaï.", ["Recommande", "Vegetarien", "Sans gluten"], ["Œufs"], ["Gluten / céréales"]),
  dish("Fromages du Québec", "À côté & desserts", 17, "Une sélection de fromages du Québec est servie avec du miel de sapin, un chutney de poire et du pain aux noix.", ["fromages du Québec", "miel de sapin", "chutney de poire", "pain", "noix"], ["pain aux noix à part", "portion supplémentaire de pain +3 $"], "Une sélection évolutive qui met en valeur le savoir-faire des fromageries québécoises.", ["Maison", "Recommande", "Vegetarien"], ["Produits laitiers", "Gluten / céréales", "Fruits à coque"]),

  dish("Sauge 75", "Cocktails signatures", 16, "Le Sauge 75 réunit du gin, du verjus, de la sauge, du citron et une mousse pétillante.", ["gin", "verjus", "sauge", "citron", "mousse pétillante"], ["moins sucré", "sans mousse", "version plus acidulée"], "Un cocktail frais et effervescent où la sauge apporte une élégante signature végétale.", ["Signature", "Populaire"]),
  dish("Écorce", "Cocktails signatures", 17, "Le cocktail Écorce associe un whisky canadien à de la poire, du thé fumé et une touche de noix.", ["whisky canadien", "poire", "thé fumé", "noix"], ["moins sucré", "servi sur glace", "servi sans glace"], "Une création boisée et enveloppante, inspirée des saveurs d’un verger à l’automne.", ["Maison"], ["Fruits à coque"]),
  dish("Cendre rose", "Cocktails signatures", 17, "Le Cendre rose combine du mezcal, de la rhubarbe, du pamplemousse et un sel parfumé à l’hibiscus.", ["mezcal", "rhubarbe", "pamplemousse", "sel à l’hibiscus"], ["moins fumé", "sans sel à l’hibiscus", "plus acidulé"], "La fumée du mezcal rencontre la fraîcheur acidulée de la rhubarbe et du pamplemousse.", ["Nouveau", "Recommande"]),
  dish("Lisière", "Cocktails signatures", 16, "Le cocktail Lisière est préparé avec de la vodka, du concombre, de l’estragon et du poivre vert.", ["vodka", "concombre", "estragon", "poivre vert"], ["sans poivre vert", "moins sucré", "concombre supplémentaire"], "Une création vive et herbacée qui évoque la fraîcheur d’un jardin après la pluie.", ["Recommande"]),
  dish("Nuit d’ambre", "Cocktails signatures", 17, "Le cocktail Nuit d’ambre marie du rhum brun, du café, du cacao et de l’orange brûlée.", ["rhum brun", "café", "cacao", "orange brûlée"], ["moins sucré", "sans café", "servi sur glace", "servi sans glace"], "Un cocktail profond et chaleureux, idéal pour prolonger la soirée après le dessert.", ["Populaire"]),

  dish("Verger froid", "Sans alcool", 9, "Le Verger froid associe de la pomme, du verjus, du thym et une eau délicatement pétillante.", ["pomme", "verjus", "thym", "eau pétillante"], ["moins sucré", "sans bulles", "sans thym"], "Une création pétillante et fruitée inspirée des vergers québécois.", ["Signature", "Populaire", "Vegetarien", "Sans gluten"], [], ["Gluten / céréales"]),
  dish("Jardin salin", "Sans alcool", 9, "Le Jardin salin est préparé avec du concombre, du basilic, de la lime et une légère solution saline.", ["concombre", "basilic", "lime", "solution saline"], ["sans solution saline", "moins sucré", "sans basilic"], "Une boisson fraîche et végétale, équilibrée par une subtile touche saline.", ["Recommande", "Vegetarien", "Sans gluten"], [], ["Gluten / céréales"]),
  dish("Thé des bois", "Sans alcool", 8, "Le Thé des bois réunit du thé noir, du bleuet, une infusion de sapin et du citron.", ["thé noir", "bleuet", "sapin", "citron"], ["moins sucré", "sans citron", "servi avec glace", "servi sans glace"], "Une infusion froide aux notes de bleuet et de sapin qui évoque les paysages forestiers du Québec.", ["Maison", "Vegetarien", "Sans gluten"], [], ["Gluten / céréales"]),
  dish("Citron brûlé", "Sans alcool", 9, "Le Citron brûlé est composé de citron grillé, de miel, de gingembre et de tonic.", ["citron grillé", "miel", "gingembre", "tonic"], ["moins sucré", "sans gingembre", "tonic à part"], "Le citron grillé apporte une légère amertume qui équilibre la douceur du miel et la chaleur du gingembre.", ["Nouveau", "Vegetarien", "Sans gluten"], [], ["Gluten / céréales"])
];

export const BADGE_ALLOWLIST = ["Maison", "Signature", "Populaire", "Recommande", "Nouveau", "Vegetarien", "Sans gluten"];
export const ALLERGEN_IDS = ["gluten", "dairy", "eggs", "tree_nuts", "crustaceans", "shellfish", "molluscs", "peanuts", "sesame", "soy", "mustard", "fish", "sulfites"];

const CANONICAL_SLUG_OVERRIDES = new Map([
  ["Bœuf cru au couteau", "boeuf-cru-au-couteau"]
]);

const ALLERGEN_LABEL_TO_ID = new Map([
  ["Gluten / céréales", "gluten"],
  ["Produits laitiers", "dairy"],
  ["Œufs", "eggs"],
  ["Fruits à coque", "tree_nuts"],
  ["Crustacés", "crustaceans"],
  ["Mollusques", "molluscs"],
  ["Sésame", "sesame"],
  ["Soja", "soy"],
  ["Moutarde", "mustard"],
  ["Poisson", "fish"],
  ["Sulfites", "sulfites"]
]);

const LEGACY_ALLERGEN_VALUES = new Map([
  ["gluten", "gluten"],
  ["dairy", "dairy"],
  ["eggs", "eggs"],
  ["tree_nuts", "tree nuts"],
  ["crustaceans", "crustaceans"],
  ["molluscs", "molluscs"],
  ["sesame", "sesame"],
  ["soy", "soy"],
  ["mustard", "mustard"],
  ["fish", "fish"],
  ["sulfites", "sulfites"]
]);

export function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`/_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value) {
  return normalizeKey(value).replace(/ /g, "-");
}

export function canonicalDishSlug(item) {
  return CANONICAL_SLUG_OVERRIDES.get(item.name) ?? slugify(item.name);
}

const CANONICAL_DISH_DISPLAY_ORDER = new Map();
const sectionOrderCounters = new Map();
for (const item of CANONICAL_DISHES) {
  const sectionKey = normalizeKey(item.section);
  const nextOrder = (sectionOrderCounters.get(sectionKey) ?? 0) + 1;
  sectionOrderCounters.set(sectionKey, nextOrder);
  CANONICAL_DISH_DISPLAY_ORDER.set(`${sectionKey}:${normalizeKey(item.name)}`, nextOrder);
}

export function canonicalDishDisplayOrder(item) {
  return CANONICAL_DISH_DISPLAY_ORDER.get(
    `${normalizeKey(item.section)}:${normalizeKey(item.name)}`
  ) ?? 1;
}

function sentence(value) {
  return typeof value === "string" && value.trim().length > 0 && /[.!?…]$/u.test(value.trim());
}

export function validateCanonicalDataset(dataset = CANONICAL_DISHES) {
  const errors = [];
  const sectionKeys = new Set(CANONICAL_SECTIONS.map((section) => normalizeKey(section.name)));
  const names = new Set();
  const usedBadges = new Set();

  if (CANONICAL_SECTIONS.length !== 7) errors.push(`sections: expected 7, got ${CANONICAL_SECTIONS.length}`);
  if (dataset.length !== 36) errors.push(`dishes: expected 36, got ${dataset.length}`);

  for (const item of dataset) {
    const key = normalizeKey(item.name);
    if (!key || names.has(key)) errors.push(`duplicate or empty dish name: ${item.name}`);
    names.add(key);
    if (!sectionKeys.has(normalizeKey(item.section))) errors.push(`${item.name}: section is not canonical`);
    if (!Number.isInteger(item.price) || item.price <= 0) errors.push(`${item.name}: invalid price`);
    if (!sentence(item.description)) errors.push(`${item.name}: description must be a sentence`);
    if (!sentence(item.chefNote)) errors.push(`${item.name}: chef note must be a sentence`);
    if (!Array.isArray(item.ingredients) || item.ingredients.some((value) => typeof value !== "string" || !value.trim())) errors.push(`${item.name}: invalid ingredients`);
    if (!Array.isArray(item.options) || item.options.some((value) => typeof value !== "string" || !value.trim())) errors.push(`${item.name}: invalid options`);
    if (!Array.isArray(item.customAllergens) || item.customAllergens.some((value) => typeof value !== "string" || !value.trim())) errors.push(`${item.name}: invalid custom allergens`);
    if ((item.customAllergens ?? []).some((value) => ALLERGEN_LABEL_TO_ID.has(value))) errors.push(`${item.name}: known allergens must use the fixed registry`);

    for (const badge of item.badges ?? []) {
      usedBadges.add(badge);
      if (!BADGE_ALLOWLIST.includes(badge)) errors.push(`${item.name}: invalid badge ${badge}`);
    }
    const containsLabels = item.allergensContains ?? [];
    const freeLabels = item.allergensConfirmedFree ?? [];
    const containsIds = new Set();
    const freeIds = new Set();
    for (const label of containsLabels) {
      const id = ALLERGEN_LABEL_TO_ID.get(label);
      if (!id) errors.push(`${item.name}: allergen label is not in the repository registry: ${label}`);
      else containsIds.add(id);
    }
    for (const label of freeLabels) {
      const id = ALLERGEN_LABEL_TO_ID.get(label);
      if (!id) errors.push(`${item.name}: allergen label is not in the repository registry: ${label}`);
      else freeIds.add(id);
    }
    for (const id of containsIds) if (freeIds.has(id)) errors.push(`${item.name}: allergen ${id} is both contains and confirmed_free`);
    if (item.badges?.includes("Sans gluten") && !freeIds.has("gluten")) errors.push(`${item.name}: Sans gluten requires gluten confirmed_free`);
    if (containsIds.has("gluten") && item.badges?.includes("Sans gluten")) errors.push(`${item.name}: Sans gluten cannot contain gluten`);
    if (freeIds.size > 0 && [...freeIds].some((id) => id !== "gluten")) errors.push(`${item.name}: only gluten may be confirmed_free`);
  }
  for (const badge of BADGE_ALLOWLIST) if (!usedBadges.has(badge)) errors.push(`badge is unused: ${badge}`);
  return errors;
}

export function buildAllergenDeclarations(item) {
  const contains = new Set((item.allergensContains ?? []).map((label) => ALLERGEN_LABEL_TO_ID.get(label)).filter(Boolean));
  const confirmedFree = new Set((item.allergensConfirmedFree ?? []).map((label) => ALLERGEN_LABEL_TO_ID.get(label)).filter(Boolean));
  return ALLERGEN_IDS.map((allergenId) => ({
    allergenId,
    status: contains.has(allergenId) ? "contains" : confirmedFree.has(allergenId) ? "confirmed_free" : "unknown"
  }));
}

export function legacyAllergens(item) {
  return [...(item.allergensContains ?? [])
    .map((label) => ALLERGEN_LABEL_TO_ID.get(label))
    .filter(Boolean)
    .map((id) => LEGACY_ALLERGEN_VALUES.get(id)), ...(item.customAllergens ?? [])];
}

export function validateSnapshotIdentity(snapshot) {
  const errors = [];
  if (!snapshot.restaurant || snapshot.restaurant.name !== TARGET_NAME || snapshot.restaurant.slug !== TARGET_SLUG) {
    errors.push("restaurant identity does not match Sauge Noire");
  }
  if (snapshot.restaurantsMatchCount !== 1) errors.push(`expected one restaurant match, got ${snapshot.restaurantsMatchCount}`);
  if (!snapshot.menu || snapshot.menu.status === "archived") errors.push("primary menu is missing or archived");
  if (snapshot.publicMenuStyle !== "unique") errors.push(`publicMenuStyle must remain unique, got ${snapshot.publicMenuStyle || "missing"}`);
  if (snapshot.uiConfigs.length === 0) errors.push("unique UI configuration is missing");
  const identities = snapshot.uiConfigs
    .map((row) => row?.config_json?.uniqueDesign)
    .filter(Boolean)
    .map((design) => JSON.stringify({
      designId: design.designId ?? null,
      status: design.status ?? null,
      version: design.version ?? null,
      rendererKey: design.rendererKey ?? null,
      rendererVersion: design.rendererVersion ?? null
    }));
  if (new Set(identities).size > 1) errors.push("draft and published uniqueDesign identities differ");
  return errors;
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function capitalizeListItem(value) {
  const item = String(value ?? "").trim();
  if (!item) return "";
  const firstLetterIndex = item.search(/\p{L}/u);
  if (firstLetterIndex < 0) return item;
  return item.slice(0, firstLetterIndex) + item[firstLetterIndex].toLocaleUpperCase("fr-CA") + item.slice(firstLetterIndex + 1);
}

function capitalizeListItems(items) {
  return items.map(capitalizeListItem);
}

const MEDIA_METADATA_KEYS = [
  "imageUrl", "image_url", "thumbnailUrl", "thumbnail_url", "photoUrl", "photo_url",
  "model3dUrl", "model3d_url", "webModel3dUrl", "web_model_3d_url", "arModel3dUrl", "ar_model_3d_url",
  "usdzUrl", "usdz_url", "arUsdzUrl", "ar_usdz_url", "iosUsdzUrl", "ios_usdz_url", "posterUrl", "poster_url",
  "preparedGlbJobId", "preparedGlbStoragePath", "viewerGlbStatus", "viewerGlbBytes", "modelStatus"
];

export function dishPayload(item, categoryId, existingMetadata = {}) {
  const metadata = { ...jsonObject(existingMetadata) };
  for (const key of MEDIA_METADATA_KEYS) delete metadata[key];
  metadata.ingredients = capitalizeListItems(item.ingredients);
  metadata.options = capitalizeListItems(item.options);
  metadata.tags = [...item.badges];
  metadata.badges = [...item.badges];
  metadata.chefNote = item.chefNote;
  metadata.houseNote = item.chefNote;
  metadata.photoStatus = "planned";
  metadata.displayPriceMode = "auto";
  metadata.originalPriceInput = String(item.price);
  metadata.customAllergens = [...(item.customAllergens ?? [])];

  return {
    category_id: categoryId,
    slug: canonicalDishSlug(item),
    name: item.name,
    short_description: item.description,
    description: item.description,
    price_cents: item.price * 100,
    currency: "CAD",
    image_url: null,
    is_available: true,
    is_signature: item.badges.includes("Signature"),
    is_recommended: item.badges.includes("Recommande"),
    has_immersive_view: false,
    display_order: canonicalDishDisplayOrder(item),
    allergens: legacyAllergens(item),
    allergen_declarations: buildAllergenDeclarations(item),
    metadata
  };
}

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[line.slice(0, separator)] = value;
  }
  return values;
}

export function loadLocalEnv() {
  return { ...readEnvFile(".env"), ...readEnvFile(".env.local"), ...process.env };
}

function queryError(result, table) {
  if (result.error) throw new Error(`${table} read failed: ${result.error.message}`);
  return result.data ?? [];
}

async function readRows(client, table, filters = {}) {
  let query = client.from(table).select("*").limit(1_000);
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const result = await query;
  return queryError(result, table);
}

export async function readSnapshot(client) {
  const restaurantResult = await client
    .from("restaurants")
    .select("*")
    .or(`name.eq.${TARGET_NAME},slug.eq.${TARGET_SLUG}`)
    .limit(20);
  const restaurants = queryError(restaurantResult, "restaurants");
  const restaurant = restaurants.length === 1 ? restaurants[0] : null;
  if (!restaurant) return { restaurantsMatchCount: restaurants.length, restaurant: null, menu: null, categories: [], dishes: [], uiConfigs: [], publicMenuStyle: "" };

  const [menus, categories, dishes, uiConfigs] = await Promise.all([
    readRows(client, "menus", { restaurant_id: restaurant.id }),
    readRows(client, "menu_categories", { restaurant_id: restaurant.id }),
    readRows(client, "menu_dishes", { restaurant_id: restaurant.id }),
    readRows(client, "menu_ui_configs", { restaurant_id: restaurant.id })
  ]);
  const activeMenus = menus.filter((row) => row.status !== "archived");
  const menu = activeMenus.find((row) => row.is_primary === true && row.status === "published") ?? activeMenus.find((row) => row.is_primary === true) ?? activeMenus.find((row) => row.slug === "principal") ?? activeMenus[0] ?? null;
  const menuCategories = categories.filter((row) => !menu || row.menu_id === menu.id).sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0));
  const menuDishes = dishes.filter((row) => !menu || row.menu_id === menu.id).sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  const selectedUiConfigs = uiConfigs.filter((row) => row.status === "draft" || row.status === "published");
  const publicMenuStyle = jsonObject(menu?.settings_json).publicMenuStyle ?? selectedUiConfigs.find((row) => row.status === "published")?.config_json?.publicMenuStyle ?? "";
  return { restaurantsMatchCount: restaurants.length, restaurant, menu, categories: menuCategories, dishes: menuDishes, uiConfigs: selectedUiConfigs, publicMenuStyle };
}

export function buildPlan(snapshot) {
  const errors = [...validateSnapshotIdentity(snapshot)];
  const sectionsByKey = new Map(snapshot.categories.map((row) => [normalizeKey(row.name), row]));
  const dishesByKey = new Map();
  const duplicateDishes = [];
  for (const row of snapshot.dishes) {
    const key = normalizeKey(row.name);
    if (dishesByKey.has(key)) duplicateDishes.push(row.name);
    else dishesByKey.set(key, row);
  }
  if (duplicateDishes.length > 0) errors.push(`duplicate existing dishes: ${duplicateDishes.join(", ")}`);

  const sectionUpdates = [];
  const sectionCreates = [];
  for (const [index, canonical] of CANONICAL_SECTIONS.entries()) {
    const existing = sectionsByKey.get(normalizeKey(canonical.name));
    const planned = { ...canonical, slug: slugify(canonical.name), display_order: index + 1 };
    if (existing) sectionUpdates.push({ existing, planned });
    else sectionCreates.push(planned);
  }
  const extraSections = snapshot.categories.filter((row) => !CANONICAL_SECTIONS.some((item) => normalizeKey(item.name) === normalizeKey(row.name)));
  if (extraSections.length > 0) errors.push(`extra existing sections: ${extraSections.map((row) => row.name).join(", ")}`);

  const sectionIdByKey = new Map(sectionUpdates.map(({ existing, planned }) => [normalizeKey(planned.name), existing.id]));
  const knownSectionKeys = new Set([
    ...sectionUpdates.map(({ planned }) => normalizeKey(planned.name)),
    ...sectionCreates.map((planned) => normalizeKey(planned.name))
  ]);
  const dishUpdates = [];
  const dishCreates = [];
  for (const canonical of CANONICAL_DISHES) {
    const existing = dishesByKey.get(normalizeKey(canonical.name));
    const categoryKey = normalizeKey(canonical.section);
    if (!knownSectionKeys.has(categoryKey)) errors.push(`${canonical.name}: section id is missing`);
    const planned = { item: canonical, categoryKey, categoryId: sectionIdByKey.get(categoryKey) };
    if (existing) dishUpdates.push({ existing, planned });
    else dishCreates.push({ planned });
  }
  const canonicalKeys = new Set(CANONICAL_DISHES.map((item) => normalizeKey(item.name)));
  const extraDishes = snapshot.dishes.filter((row) => !canonicalKeys.has(normalizeKey(row.name)));
  if (extraDishes.length > 0) errors.push(`extra existing dishes: ${extraDishes.map((row) => row.name).join(", ")}`);
  return { errors, sectionUpdates, sectionCreates, dishUpdates, dishCreates, extraSections, extraDishes };
}

export function summarizePlan(plan) {
  return {
    sectionUpdates: plan.sectionUpdates.map(({ existing, planned }) => `${existing.name} -> ${planned.name}`),
    sectionCreates: plan.sectionCreates.map((section) => section.name),
    dishUpdates: plan.dishUpdates.map(({ existing, planned }) => `${existing.name} -> ${planned.item.name}`),
    dishCreates: plan.dishCreates.map(({ planned }) => planned.item.name),
    extraSections: plan.extraSections.map((row) => row.name),
    extraDishes: plan.extraDishes.map((row) => row.name),
    finalSectionCount: CANONICAL_SECTIONS.length,
    finalDishCount: CANONICAL_DISHES.length
  };
}

function comparableUniqueDesign(config) {
  const design = jsonObject(config?.config_json).uniqueDesign;
  return JSON.stringify({
    designId: design?.designId ?? null,
    status: design?.status ?? null,
    version: design?.version ?? null,
    rendererKey: design?.rendererKey ?? null,
    rendererVersion: design?.rendererVersion ?? null
  });
}

function assertNoDesignMutation(before, after) {
  const beforeIdentity = before.uiConfigs.map(comparableUniqueDesign).sort();
  const afterIdentity = after.uiConfigs.map(comparableUniqueDesign).sort();
  if (JSON.stringify(beforeIdentity) !== JSON.stringify(afterIdentity)) throw new Error("uniqueDesign identity changed during sync");
  if (before.publicMenuStyle !== after.publicMenuStyle) throw new Error("publicMenuStyle changed during sync");
}

function payloadForSection(planned) {
  return { name: planned.name, slug: planned.slug, description: planned.description, display_order: planned.display_order, updated_at: new Date().toISOString() };
}

async function writeOrThrow(result, label) {
  if (result.error) throw new Error(`${label} failed: ${result.error.message}`);
  return result.data;
}

async function rollback(client, applied, restaurantId) {
  const failures = [];
  for (const item of [...applied.dishes].reverse()) {
    try {
      if (item.kind === "insert") await writeOrThrow(await client.from("menu_dishes").delete().eq("id", item.id).eq("restaurant_id", restaurantId), `rollback dish ${item.id}`);
      else await writeOrThrow(await client.from("menu_dishes").update(item.before).eq("id", item.id).eq("restaurant_id", restaurantId), `rollback dish ${item.id}`);
    } catch (error) { failures.push(String(error.message ?? error)); }
  }
  for (const item of [...applied.categories].reverse()) {
    try {
      if (item.kind === "insert") await writeOrThrow(await client.from("menu_categories").delete().eq("id", item.id).eq("restaurant_id", restaurantId), `rollback category ${item.id}`);
      else await writeOrThrow(await client.from("menu_categories").update(item.before).eq("id", item.id).eq("restaurant_id", restaurantId), `rollback category ${item.id}`);
    } catch (error) { failures.push(String(error.message ?? error)); }
  }
  if (failures.length > 0) throw new Error(`rollback incomplete: ${failures.join(" | ")}`);
}

export async function applyPlan(client, snapshot, plan) {
  if (plan.errors.length > 0) throw new Error(`refusing to apply invalid plan: ${plan.errors.join(" | ")}`);
  const restaurantId = snapshot.restaurant.id;
  const current = await readSnapshot(client);
  assertNoDesignMutation(snapshot, current);
  if (current.restaurant?.id !== restaurantId || current.menu?.id !== snapshot.menu.id) throw new Error("restaurant or menu snapshot changed before apply");
  if (JSON.stringify(current.categories.map((row) => row.id).sort()) !== JSON.stringify(snapshot.categories.map((row) => row.id).sort())) throw new Error("section snapshot changed before apply");
  if (JSON.stringify(current.dishes.map((row) => row.id).sort()) !== JSON.stringify(snapshot.dishes.map((row) => row.id).sort())) throw new Error("dish snapshot changed before apply");

  const applied = { categories: [], dishes: [] };
  try {
    const sectionIds = new Map();
    for (const operation of plan.sectionUpdates) {
      await writeOrThrow(await client.from("menu_categories").update(payloadForSection(operation.planned)).eq("id", operation.existing.id).eq("restaurant_id", restaurantId), `update section ${operation.existing.name}`);
      applied.categories.push({ kind: "update", id: operation.existing.id, before: { name: operation.existing.name, slug: operation.existing.slug, description: operation.existing.description, display_order: operation.existing.display_order, updated_at: operation.existing.updated_at } });
      sectionIds.set(normalizeKey(operation.planned.name), operation.existing.id);
    }
    for (const planned of plan.sectionCreates) {
      const inserted = await writeOrThrow(await client.from("menu_categories").insert({ restaurant_id: restaurantId, menu_id: snapshot.menu.id, ...payloadForSection(planned) }).select("id").single(), `create section ${planned.name}`);
      sectionIds.set(normalizeKey(planned.name), inserted.id);
      applied.categories.push({ kind: "insert", id: inserted.id });
    }

    for (const operation of [...plan.dishUpdates, ...plan.dishCreates]) {
      const item = operation.planned.item;
      const categoryId = sectionIds.get(operation.planned.categoryKey ?? normalizeKey(item.section));
      if (!categoryId) throw new Error(`missing category for ${item.name}`);
      const payload = dishPayload(item, categoryId, operation.existing?.metadata);
      if (operation.existing) {
        const before = {
          category_id: operation.existing.category_id,
          slug: operation.existing.slug,
          name: operation.existing.name,
          short_description: operation.existing.short_description,
          description: operation.existing.description,
          price_cents: operation.existing.price_cents,
          currency: operation.existing.currency,
          display_order: operation.existing.display_order,
          image_url: operation.existing.image_url,
          is_available: operation.existing.is_available,
          is_signature: operation.existing.is_signature,
          is_recommended: operation.existing.is_recommended,
          has_immersive_view: operation.existing.has_immersive_view,
          allergens: operation.existing.allergens,
          allergen_declarations: operation.existing.allergen_declarations,
          metadata: operation.existing.metadata,
          updated_at: operation.existing.updated_at
        };
        await writeOrThrow(await client.from("menu_dishes").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", operation.existing.id).eq("restaurant_id", restaurantId).eq("menu_id", snapshot.menu.id), `update dish ${item.name}`);
        applied.dishes.push({ kind: "update", id: operation.existing.id, before });
      } else {
        const inserted = await writeOrThrow(await client.from("menu_dishes").insert({ restaurant_id: restaurantId, menu_id: snapshot.menu.id, ...payload }).select("id").single(), `create dish ${item.name}`);
        applied.dishes.push({ kind: "insert", id: inserted.id });
      }
    }
  } catch (error) {
    try { await rollback(client, applied, restaurantId); } catch (rollbackError) { throw new Error(`${error.message ?? error}; ${rollbackError.message ?? rollbackError}`); }
    throw error;
  }
  return readSnapshot(client);
}

function environmentStatus(env) {
  const explicit = String(env.VISTAIRE_QR_PREFLIGHT_ENVIRONMENT ?? env.VISTAIRE_SYNC_ENVIRONMENT ?? "").trim().toLowerCase();
  if (["local", "dev", "development", "preview", "staging"].includes(explicit)) return explicit;
  try {
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
    if (["localhost", "127.0.0.1"].includes(host)) return "local";
  } catch {
    // The client constructor will report a missing or invalid URL separately.
  }
  return "ambiguous";
}

export async function run({ apply = false, env = loadLocalEnv(), log = console.log } = {}) {
  const validationErrors = validateCanonicalDataset();
  log(JSON.stringify({ dataset: { sections: CANONICAL_SECTIONS.length, dishes: CANONICAL_DISHES.length }, validationErrors }, null, 2));
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, reason: "missing-supabase-env" };
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const snapshot = await readSnapshot(client);
  const identityErrors = validateSnapshotIdentity(snapshot);
  const plan = buildPlan(snapshot);
  log(JSON.stringify({
    target: { name: snapshot.restaurant?.name ?? null, slug: snapshot.restaurant?.slug ?? null, restaurantId: snapshot.restaurant?.id ?? null, menuId: snapshot.menu?.id ?? null },
    initial: { sections: snapshot.categories.length, dishes: snapshot.dishes.length, uiConfigs: snapshot.uiConfigs.length, publicMenuStyle: snapshot.publicMenuStyle },
    uniqueDesign: snapshot.uiConfigs.map((row) => row.config_json?.uniqueDesign ?? null),
    plan: summarizePlan(plan),
    identityErrors,
    planErrors: plan.errors
  }, null, 2));
  if (!apply || validationErrors.length > 0) {
    return {
      ok: validationErrors.length === 0 && identityErrors.length === 0 && plan.errors.length === 0,
      reason: validationErrors.length > 0 ? "dataset-invalid" : "dry-run",
      validationErrors,
      snapshot,
      plan
    };
  }
  if (environmentStatus(env) === "ambiguous") return { ok: false, reason: "ambiguous-environment", error: "Refusing --apply: set VISTAIRE_QR_PREFLIGHT_ENVIRONMENT to local, dev, preview or staging after explicit environment validation." };
  const finalSnapshot = await applyPlan(client, snapshot, plan);
  const finalErrors = validateSnapshotIdentity(finalSnapshot);
  if (finalErrors.length > 0 || finalSnapshot.categories.length !== 7 || finalSnapshot.dishes.length !== 36) throw new Error(`post-apply validation failed: ${[...finalErrors, `sections=${finalSnapshot.categories.length}`, `dishes=${finalSnapshot.dishes.length}`].join(" | ")}`);
  assertNoDesignMutation(snapshot, finalSnapshot);
  log(JSON.stringify({ final: { sections: finalSnapshot.categories.length, dishes: finalSnapshot.dishes.length, restaurantId: finalSnapshot.restaurant.id, publicMenuStyle: finalSnapshot.publicMenuStyle }, designUnchanged: true }, null, 2));
  return { ok: true, reason: "applied", snapshot: finalSnapshot, plan };
}

const invokedDirectly = process.argv[1] && pathToFileURL(fileURLToPath(import.meta.url)).href === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const apply = process.argv.includes("--apply");
  run({ apply }).then((result) => {
    if (!result.ok) {
      if (result.error) console.error(result.error);
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  });
}
