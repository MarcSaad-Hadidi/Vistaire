import { deriveRestaurateurPreviewPeriod } from "./insights";
import type {
  LocalizedText,
  MetricSeries,
  MetricValues,
  PreviewCategoryCount,
  PreviewDishCount,
  PreviewHeatmapCell,
  PreviewSearchCount,
  PreviewServiceCount,
  RestaurateurPreviewFixture,
  RestaurateurPreviewPeriod,
  RestaurateurPreviewPeriodId
} from "./types";

export { deriveRestaurateurPreviewPeriod } from "./insights";

const text = (fr: string, en: string): LocalizedText => ({ fr, en });
const metrics = (
  menuOpens: number,
  dishOpens: number,
  searches: number,
  immersive: number
): MetricValues => ({ menuOpens, dishOpens, searches, immersive });
const series = (
  menuOpens: number[],
  dishOpens: number[],
  searches: number[],
  immersive: number[]
): MetricSeries => ({ menuOpens, dishOpens, searches, immersive });

const categories = [
  { id: "entrees", label: text("Entrées", "Starters") },
  { id: "signatures", label: text("Signatures", "Signatures") },
  { id: "desserts", label: text("Desserts", "Desserts") },
  { id: "cocktails", label: text("Cocktails", "Cocktails") }
] as const;

const dishes = [
  ["tartare-saumon-label-rouge", "entrees", "Tartare de saumon Label Rouge", "Label Rouge salmon tartare", 2400, true],
  ["ravioles-chevre-miel-monteregie", "entrees", "Ravioles chèvre et miel de Montérégie", "Goat cheese ravioli with Montérégie honey", 2200, true],
  ["homard-bleu-bisque-fenouil", "signatures", "Homard bleu, bisque et fenouil", "Blue lobster, bisque and fennel", 5800, true],
  ["pave-boeuf-mature-bordelaise", "signatures", "Pavé de bœuf maturé, bordelaise", "Dry-aged beef, Bordelaise sauce", 5200, true],
  ["canette-rotie-figues-epices", "signatures", "Canette rôtie, figues et épices", "Roasted duckling, figs and spices", 4600, true],
  ["bar-de-ligne-artichaut-citron", "signatures", "Bar de ligne, artichaut et citron", "Line-caught sea bass, artichoke and lemon", 4900, false],
  ["risotto-cepes-parmesan", "signatures", "Risotto aux cèpes et parmesan", "Porcini and Parmesan risotto", 3600, true],
  ["souffle-chocolat-grand-cru", "desserts", "Soufflé chocolat grand cru", "Grand cru chocolate soufflé", 1800, true],
  ["tarte-citron-basilic-pourpre", "desserts", "Tarte citron et basilic pourpre", "Lemon tart with purple basil", 1600, true],
  ["maison-elyse-n1", "cocktails", "Maison Élyse N°1", "Maison Élyse No. 1", 1900, true],
  ["elixir-bergamote-earl-grey", "cocktails", "Élixir bergamote et Earl Grey", "Bergamot and Earl Grey elixir", 1700, true],
  ["negroni-vieilli-fut", "cocktails", "Negroni vieilli en fût", "Barrel-aged Negroni", 2100, false]
].map(([id, categoryId, fr, en, priceCents, available]) => ({
  id: id as string,
  categoryId: categoryId as string,
  name: fr as string,
  nameEn: en as string,
  priceCents: priceCents as number,
  imageSrc: `/images/demo/dishes/${id}.png`,
  available: available as boolean
}));

const dishIds = dishes.map(({ id }) => id);
const topDishes = (counts: number[]): PreviewDishCount[] =>
  counts.map((count, index) => ({ dishId: dishIds[index], count }));
const categoryBreakdown = (counts: number[]): PreviewCategoryCount[] =>
  counts.map((count, index) => ({ categoryId: categories[index].id, count }));
const searchTerms = [
  text("homard", "lobster"),
  text("sans gluten", "gluten-free"),
  text("bœuf", "beef"),
  text("végétarien", "vegetarian"),
  text("chocolat", "chocolate"),
  text("cocktail maison", "house cocktail")
];
const searchBreakdown = (counts: number[]): PreviewSearchCount[] =>
  counts.map((count, index) => ({ term: searchTerms[index], count }));
const services = [
  ["night", text("Nuit", "Night")],
  ["morning", text("Matin", "Morning")],
  ["lunch", text("Midi", "Lunch")],
  ["afternoon", text("Après-midi", "Afternoon")],
  ["evening", text("Soirée", "Evening")]
] as const;
const serviceBreakdown = (counts: number[]): PreviewServiceCount[] =>
  counts.map((count, index) => ({ id: services[index][0], label: services[index][1], count }));
const heatmap = (coordinates: readonly (readonly [number, number])[], counts: number[]): PreviewHeatmapCell[] =>
  counts.map((count, index) => ({
    weekday: coordinates[index][0],
    hour: coordinates[index][1],
    count
  }));

const heatCoordinates24h = [
  [6, 0], [6, 3], [6, 6], [6, 9],
  [6, 12], [6, 15], [6, 18], [6, 21]
] as const;
const heatCoordinates7d = [
  [1, 19], [2, 19], [3, 19], [4, 19], [5, 19], [6, 19], [0, 19]
] as const;
const heatCoordinates30d = [
  [1, 12], [1, 19], [2, 12], [2, 19], [3, 12], [3, 19], [4, 12],
  [4, 19], [5, 12], [5, 19], [6, 12], [6, 19], [0, 12], [0, 19]
] as const;

const period = (
  id: RestaurateurPreviewPeriodId,
  current: MetricValues,
  previous: MetricValues,
  currentSeries: MetricSeries,
  previousSeries: MetricSeries,
  labels: LocalizedText[],
  dishCounts: number[],
  categoryCounts: number[],
  searchCounts: number[],
  serviceCounts: number[],
  heatCoordinates: readonly (readonly [number, number])[],
  heatCounts: number[]
): RestaurateurPreviewPeriod => ({
  id,
  metrics: current,
  previousMetrics: previous,
  series: currentSeries,
  previousSeries,
  seriesLabels: labels,
  topDishes: topDishes(dishCounts),
  categoryBreakdown: categoryBreakdown(categoryCounts),
  searchBreakdown: searchBreakdown(searchCounts),
  serviceBreakdown: serviceBreakdown(serviceCounts),
  heatmap: heatmap(heatCoordinates, heatCounts)
});

const label = (fr: string, en = fr) => text(fr, en);

export const RESTAURATEUR_PREVIEW_FIXTURE: RestaurateurPreviewFixture = {
  generatedAt: "2026-08-08T22:00:00.000Z",
  restaurant: { demo: true, name: text("Maison Élyse — Démo", "Maison Élyse — Demo") },
  categories: [...categories],
  dishes,
  periods: {
    "24h": period(
      "24h",
      metrics(184, 463, 57, 32),
      metrics(166, 428, 52, 28),
      series([12,18,22,31,27,36,24,14], [28,43,56,82,74,91,55,34], [3,5,8,12,9,11,6,3], [1,2,3,5,6,7,5,3]),
      series([10,16,20,28,25,33,22,12], [25,40,52,76,68,84,51,32], [3,4,7,11,8,10,6,3], [1,2,2,4,5,6,5,3]),
      [label("00 h"),label("03 h"),label("06 h"),label("09 h"),label("12 h"),label("15 h"),label("18 h"),label("21 h")],
      [78,38,96,66,61,48,30,20,12,7,4,3], [104,313,32,14], [15,11,10,8,7,6], [112,219,116,145,144], heatCoordinates24h, [44,68,89,130,116,145,90,54]
    ),
    "7d": period(
      "7d",
      metrics(1120,2860,372,204),
      metrics(1018,2650,340,180),
      series([132,148,156,171,184,176,153], [348,372,395,426,455,472,392], [44,49,51,56,62,59,51], [21,24,27,31,36,35,30]),
      series([121,135,143,155,166,160,138], [322,345,365,392,422,438,366], [40,45,47,51,56,54,47], [18,21,24,27,32,31,27]),
      [label("Lun", "Mon"),label("Mar", "Tue"),label("Mer", "Wed"),label("Jeu", "Thu"),label("Ven", "Fri"),label("Sam", "Sat"),label("Dim", "Sun")],
      [500,240,610,410,370,300,170,105,65,42,28,20], [650,1950,170,90], [96,74,62,51,47,42], [204,610,1304,895,1543], heatCoordinates7d, [545,593,629,684,737,742,626]
    ),
    "30d": period(
      "30d",
      metrics(4890,12640,1610,890),
      metrics(4540,11810,1490,760),
      series([420,445,462,478,501,520,538,524,506,496], [1080,1125,1180,1215,1260,1305,1360,1340,1390,1385], [128,135,142,149,155,162,170,178,190,201], [68,72,76,80,84,89,94,99,109,119]),
      series([390,410,430,445,462,478,493,490,476,466], [1010,1050,1100,1135,1175,1220,1270,1255,1300,1295], [120,125,132,138,144,150,158,165,175,183], [58,62,65,69,72,76,80,84,94,100]),
      [label("1–3"),label("4–6"),label("7–9"),label("10–12"),label("13–15"),label("16–18"),label("19–21"),label("22–24"),label("25–27"),label("28–30")],
      [2200,1050,2680,1810,1640,1310,760,480,300,190,125,95], [2860,8590,780,410], [420,315,270,230,205,170], [890,2740,5670,4020,6710], heatCoordinates30d, [700,1600,750,1700,800,1800,850,1900,900,2100,1000,2200,980,2750]
    )
  }
};

void deriveRestaurateurPreviewPeriod;
