// Code-rendered illustration of the pinned PR296 Studio overview. This is not
// a browser screenshot. The interactive preview uses the actual Studio source.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
const sharp = require(
  path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "sharp"),
);
const cache = path.resolve("node_modules/.cache/studio-preview-fixture.mjs");
await build({
  entryPoints: ["src/pages/source/lib/restaurateurPreview/studioFixture.ts"],
  outfile: cache,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "error",
});
const { createPublicStudioDemo } = await import(cache);
const data = createPublicStudioDemo("7d", "fr");
const ink = "#fafafa",
  muted = "#a7a7af",
  line = "#35353b",
  surface = "#18181b",
  soft = "#232326",
  blue = "#60a5fa";
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const text = (x, y, s, size = 16, color = ink, weight = 400) =>
  `<text x="${x}" y="${y}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}">${esc(s)}</text>`;
const rect = (x, y, w, h, fill = surface, r = 10, stroke = line) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const series = data.analytics.metricSeries.dishOpened;
const metric = (id) => data.analytics.metrics.find((m) => m.id === id);
const number = (n) => new Intl.NumberFormat("fr-CA").format(n);
const metrics = [
  ["menu-opens", "Ouvertures du menu"],
  ["dish-opens", "Consultations de plats"],
  ["three", "Clics 3D"],
  ["ar", "Clics AR"],
];
function kpi(x, y, w, id, label) {
  const m = metric(id);
  return (
    rect(x, y, w, 132) +
    text(x + 18, y + 30, label, 13, muted) +
    text(x + 18, y + 76, number(m.value), 34) +
    text(
      x + 18,
      y + 108,
      `+${Math.round(m.changeRate * 100)} %`,
      13,
      "#6ee7a0",
    ) +
    text(x + 76, y + 108, "vs période précédente", 10, muted)
  );
}
function trend(x, y, w, h) {
  const max =
    Math.ceil(
      Math.max(
        ...series.current.map((p) => p.value),
        ...series.previous.map((p) => p.value),
      ) / 100,
    ) * 100;
  const px = x + 48,
    py = y + 114,
    pw = w - 78,
    ph = h - 155;
  const points = (values) =>
    values.map((p, i) => [
      px + (i * pw) / (values.length - 1),
      py + ph - (p.value / max) * ph,
    ]);
  const current = points(series.current),
    previous = points(series.previous);
  let out =
    rect(x, y, w, h) +
    text(x + 22, y + 35, "L’activité de votre menu", 19) +
    text(x + 22, y + 58, "2 au 8 août 2026 · heures UTC", 12, muted) +
    text(x + 22, y + 93, number(metric("dish-opens").value), 27) +
    text(x + 110, y + 91, "consultations de plats", 12, muted);
  for (let i = 0; i < 5; i++) {
    let yy = py + (i * ph) / 4;
    out +=
      `<path d="M${px} ${yy}H${px + pw}" stroke="${line}"/>` +
      text(x + 12, yy + 4, Math.round(max * (1 - i / 4)), 10, muted);
  }
  out += `<path d="M${current[0].join(" ")} ${current
    .slice(1)
    .map((p) => "L" + p.join(" "))
    .join(
      " ",
    )} L${px + pw} ${py + ph} L${px} ${py + ph}Z" fill="${blue}" opacity=".08"/>`;
  for (const [ps, color, dash] of [
    [previous, "#fb923c", "5 5"],
    [current, blue, ""],
  ])
    out += `<polyline points="${ps.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}"/>`;
  for (const [i, p] of current.entries())
    out +=
      `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${blue}"/>` +
      text(p[0] - 13, py + ph + 22, `${i + 2} août`, 10, muted);
  return out;
}
function ranking(x, y, w, h) {
  let out =
    rect(x, y, w, h) +
    text(x + 20, y + 35, "Les plats les plus consultés", 17) +
    text(x + 20, y + 73, "Plat", 11, muted) +
    text(x + w - 72, y + 73, "Vues", 11, muted);
  const rows = data.analytics.panels.ranking.data.slice(0, 6);
  for (const [i, row] of rows.entries()) {
    const dish = data.menu.dishes.find((d) => d.slug === row.slug),
      yy = y + 108 + i * 44;
    const label =
      dish.name.length > 30 ? dish.name.slice(0, 28) + "…" : dish.name;
    out +=
      `<path d="M${x + 20} ${yy + 18}H${x + w - 20}" stroke="${line}"/>` +
      text(x + 20, yy, `${i + 1}. ${label}`, 12) +
      text(x + w - 72, yy, number(row.count), 13);
  }
  return out;
}
function heat(x, y, w, h) {
  let out =
    rect(x, y, w, h) +
    text(x + 20, y + 34, "Quand votre menu est consulté", 18) +
    text(
      x + 20,
      y + 56,
      "Événements enregistrés par jour et heure UTC",
      12,
      muted,
    );
  const cells = data.analytics.panels.hourWeekday.data,
    max = Math.max(...cells.map((c) => c.count));
  const days = [1, 2, 3, 4, 5, 6, 0];
  for (let dy = 0; dy < 7; dy++) {
    out += text(
      x + 20,
      y + 92 + dy * 14,
      ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][dy],
      9,
      muted,
    );
    for (let hh = 0; hh < 24; hh++) {
      const count =
        cells.find((c) => c.weekdayUtc === days[dy] && c.hourUtc === hh)
          ?.count ?? 0;
      const xx = x + 58 + (hh * (w - 83)) / 24;
      out += rect(
        xx,
        y + 83 + dy * 14,
        (w - 110) / 24,
        9,
        count ? blue : soft,
        2,
        "none",
      ).replace(
        'fill="' + blue + '"',
        'fill="' + blue + '" opacity="' + (0.25 + (0.75 * count) / max) + '"',
      );
    }
  }
  return out;
}
const width = 1440,
  height = 1000;
let desktop =
  rect(0, 0, width, height, "#09090b", 0, "none") +
  rect(0, 0, 232, height, surface, 0) +
  text(28, 58, "vistaire", 32) +
  text(28, 81, "RESTAURANT STUDIO", 9, muted) +
  text(28, 141, data.restaurant.name, 16) +
  text(28, 164, "ESPACE RESTAURATEUR", 10, muted) +
  text(28, 215, "VOTRE RESTAURANT", 10, muted);
for (const [i, label] of [
  "Vue d’ensemble",
  "Analyses",
  "Les plats",
  "Planning",
].entries()) {
  const y = 243 + i * 54;
  if (!i)
    desktop +=
      rect(16, y, 200, 46, soft, 8, "none") +
      `<rect x="16" y="${y + 12}" width="3" height="22" rx="2" fill="${ink}"/>`;
  desktop +=
    rect(31, y + 15, 15, 15, "none", 3, muted) +
    text(61, y + 29, label, 14, i ? muted : ink);
}
desktop +=
  text(28, 948, "↗ Ouvrir le menu client", 13, muted) +
  rect(232, 0, 1208, 64, surface, 0) +
  text(266, 39, `${data.restaurant.name} /`, 13, muted) +
  text(470, 39, "Vue d’ensemble", 13) +
  text(1260, 39, "Démonstration", 12, muted);
desktop +=
  text(266, 111, "Vue d’ensemble", 25) +
  rect(1090, 81, 165, 42) +
  text(1104, 108, "7 jours exemple", 13) +
  rect(1268, 81, 135, 42) +
  text(1292, 108, "Exporter ↧", 13);
desktop +=
  rect(266, 143, 1138, 49, soft, 10) +
  text(
    283,
    173,
    "Démonstration · Données fictives. Aucun restaurant réel n’est connecté.",
    13,
    muted,
  ) +
  text(266, 220, "2 au 8 août 2026 · données du menu", 13, muted);
for (const [i, [id, label]] of metrics.entries())
  desktop += kpi(266 + i * 288, 241, 274, id, label);
desktop +=
  trend(266, 393, 664, 371) +
  ranking(948, 393, 456, 371) +
  heat(266, 782, 1138, 204);
let mobile =
  rect(0, 0, 600, 650, "#09090b", 0, "none") +
  text(28, 49, "vistaire", 29) +
  text(365, 44, "RESTAURANT STUDIO", 11, muted) +
  text(28, 107, "Vue d’ensemble", 28) +
  text(28, 136, "Démonstration · données fictives", 13, muted);
mobile +=
  kpi(28, 157, 265, ...metrics[0]) +
  kpi(307, 157, 265, ...metrics[1]) +
  trend(28, 309, 544, 314);
const wrap = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
for (const [name, w, h, body] of [
  ["studio-overview", width, height, desktop],
  ["studio-mobile-overview", 600, 650, mobile],
]) {
  const svg = wrap(w, h, body);
  await fs.writeFile(`qa/pricing-hand/${name}.svg`, svg);
  await sharp(Buffer.from(svg), { density: 144 })
    .resize(w, h)
    .webp({ quality: 95 })
    .toFile(`public/assets/dashboard/${name}.webp`);
  // A code-native palette variant follows the actual Studio's light tokens.
  let lightSvg = svg;
  for (const [dark, light] of [
    ["#09090b", "#f6f7f9"],
    ["#18181b", "#ffffff"],
    ["#232326", "#f0f1f3"],
    ["#fafafa", "#18181b"],
    ["#a7a7af", "#62626c"],
    ["#35353b", "#dedee3"],
    ["#60a5fa", "#2563eb"],
    ["#fb923c", "#ea580c"],
    ["#6ee7a0", "#16733d"],
  ])
    lightSvg = lightSvg.replaceAll(dark, light);
  await sharp(Buffer.from(lightSvg), { density: 144 })
    .resize(w, h)
    .webp({ quality: 95 })
    .toFile(`public/assets/dashboard/${name}-light.webp`);
}
console.log(
  "Studio previews: actual PR fixture, code-rendered desktop and mobile illustrations.",
);
