import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { buildAdminAnalyticsState } from "../lib/admin/analyticsState.ts";
import { buildAdminMenuReadiness } from "../lib/admin/menuReadiness.ts";

const window = { range: "7d", startInclusive: "2026-10-04T12:00:00.000Z", endExclusive: "2026-10-11T12:00:00.000Z", comparisonStartInclusive: "2026-09-27T12:00:00.000Z", comparisonEndExclusive: "2026-10-04T12:00:00.000Z" };
const generatedAt = "2026-10-11T13:00:00.000Z";
const load = async () => {
  assert.ok(existsSync(new URL("../lib/admin/studioExport.ts", import.meta.url)), "The scoped dashboard export model must exist");
  return import("../lib/admin/studioExport.ts");
};
const engine = async () => {
  assert.ok(existsSync(new URL("../lib/admin/studioExportFiles.ts", import.meta.url)), "Local PDF and XLSX serializers must exist");
  return import("../lib/admin/studioExportFiles.ts");
};
const dataset = (report, id) => {
  const result = report.datasets.find((item) => item.id === id);
  assert.ok(result, id);
  return result;
};
function fixture() {
  const categories = [{ id: "c1", label: "Plats", slug: "plats" }];
  const dishes = Array.from({ length: 36 }, (_, index) => ({ id: `d${index}`, slug: `plat-${index}`, name: index === 0 ? "Œuf à l’érable, crème brûlée" : `Plat ${index}`, category: "Plats", categorySlug: "plats", description: "Description complète", priceLabel: "12,50 $", priceCents: 1250, imageUrl: "/dish.webp", thumbnailUrl: "/thumb.webp", hasPhoto: true, photoStatus: "ready", hasImmersive: false, has3d: false, hasAr: false, available: index !== 35 }));
  const events = Array.from({ length: 20 }, (_, index) => [
    { event_name: "menu_opened", created_at: "2026-10-10T13:00:00Z", session_id: `private-session-${index}` },
    { event_name: "dish_opened", created_at: "2026-10-10T13:01:00Z", session_id: `private-session-${index}`, dish_slug: "plat-0", category_slug: "plats" },
    { event_name: "search_used", created_at: "2026-10-10T13:02:00Z", session_id: `private-session-${index}`, search_query: index < 3 ? "crème" : "private@example.com" }
  ]).flat();
  const previousEvents = events.map((event) => ({ ...event, created_at: event.created_at.replace("10-10", "10-03") }));
  const analytics = buildAdminAnalyticsState({ observationWindow: window, events, previousEvents, analyticsScope: { restaurantId: "r1", menuId: "m1", source: "production", metricDefinition: "all-events-v1" }, availableDishCount: 35, observedAt: generatedAt });
  return { restaurant: { id: "r1", name: "Restaurant Érable", slug: "erable", location: "Montréal", cuisineType: null, timezone: null, publicMenuPath: "/menu/erable" }, menu: { id: "m1", status: "published", categories, dishes, readiness: buildAdminMenuReadiness(categories, dishes) }, analytics, dishStatistics: { d0: { views: 20, three: 0, ar: 0, previousViews: 20, changeRate: 0 } } };
}

test("exports every available menu row and real aggregate with the exact selected window", async () => {
  const { createStudioExport } = await load();
  const data = fixture();
  const report = createStudioExport(data, { generatedAt });
  assert.deepEqual(report.observationWindow, window);
  assert.equal(report.generatedAt, generatedAt);
  assert.equal(report.synthetic, false);
  assert.equal(report.comparison.available, true);
  assert.equal(report.analytics.freshness, data.analytics.freshness);
  assert.deepEqual(report.analytics.coverage, data.analytics.coverage);
  assert.equal(dataset(report, "dishes").rows.length, 36);
  assert.equal(dataset(report, "dishes").rows.at(-1).available, false);
  assert.equal(dataset(report, "dishes").rows[0].views, 20);
  assert.equal(dataset(report, "dishes").rows[1].views, null);
  assert.equal(dataset(report, "summary").rows.find((row) => row.id === "menu-opens").current, 20);
  assert.equal(dataset(report, "metric_daily").rows.length, 42);
  assert.equal(dataset(report, "previous_metric_daily").rows.length, 42);
  assert.equal(dataset(report, "metric_daily").rows.filter((row) => ["Ouvertures du menu", "Consultations de plats", "Recherches", "Clics 3D et AR"].includes(row.metric)).length, 28);
  assert.equal(dataset(report, "searches").rows[0].term, "crème");
  assert.equal(dataset(report, "search_daily").rows.length, 7);
  assert.equal(dataset(report, "funnel").rows[0].sessions, 20);
});

test("suppressed panels and incomplete sources never reveal hidden analytics or private payloads", async () => {
  const { createStudioExport, reportJSON } = await load();
  const data = fixture();
  data.analytics.panels.searches = { kind: "insufficient", reason: "no-search-evidence", data: [{ term: "suppressed-secret", count: 99 }] };
  data.analytics.panels.ranking = { kind: "unavailable", reason: "source-incomplete", data: [{ slug: "hidden-ranking", count: 99 }] };
  data.analytics.panels.dailyComparison = { kind: "insufficient", reason: "incompatible-or-empty-period" };
  data.analytics.rawEvents = [{ session_id: "private-session-0", search_query: "private@example.com" }];
  data.analytics.searches = [{ term: "legacy-private-search", count: 99 }];
  let report = createStudioExport(data, { generatedAt });
  assert.equal(dataset(report, "searches").status, "insufficient");
  assert.deepEqual(dataset(report, "searches").rows, []);
  assert.deepEqual(dataset(report, "ranking").rows, []);
  assert.deepEqual(dataset(report, "previous_metric_daily").rows, []);
  assert.equal(dataset(report, "summary").rows[0].previous, null);
  assert.equal(dataset(report, "dishes").rows[0].previousViews, null);
  assert.doesNotMatch(reportJSON(report), /private-session|private@example|suppressed-secret|hidden-ranking|legacy-private-search/);
  for (const kind of ["insufficient", "unavailable"]) {
    data.analytics = kind === "insufficient" ? { kind, reason: "sample-too-small", completeness: "limited-sample", observationWindow: window, availableEvidence: [], missingEvidence: [], metrics: [{ value: 999 }] } : { kind, reason: "database", completeness: "partial-source", title: "Données indisponibles", explanation: "La lecture est incomplète.", retryable: true, metrics: [{ value: 999 }] };
    report = createStudioExport(data, { generatedAt });
    assert.equal(dataset(report, "summary").status, kind);
    assert.deepEqual(dataset(report, "summary").rows, []);
    assert.equal(dataset(report, "dishes").rows[0].views, null);
    assert.equal(report.analytics.coverage, null);
    assert.deepEqual(report.observationWindow, kind === "unavailable" ? null : window);
    assert.doesNotMatch(reportJSON(report), /999|private-session|private@example/);
  }
});

test("CSV neutralizes formula text while JSON preserves Unicode and exact values", async () => {
  const { createStudioExport, reportCSV, reportJSON, safeExportText } = await load();
  const data = fixture();
  data.menu.dishes[0].name = '=HYPERLINK("https://example.invalid")';
  data.menu.dishes[1].description = "\t+SUM(1;2)\n\"quoted\"";
  const report = createStudioExport(data, { generatedAt });
  for (const unsafe of ["=1", "+1", "-1", "@SUM(1)", " \t=1", "\rtext", "\ntext"]) assert.equal(safeExportText(unsafe), `'${unsafe}`);
  assert.equal(safeExportText("Œuf à l’érable"), "Œuf à l’érable");
  const csv = reportCSV(report);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("'=HYPERLINK("));
  assert.ok(csv.includes('""quoted""'));
  assert.ok(csv.includes(window.startInclusive));
  assert.deepEqual(JSON.parse(reportJSON(report)), report);
});

test("XLSX preserves complete typed tables, nulls and neutralized non-formula cells", async () => {
  const { createStudioExport } = await load();
  const { buildXlsx } = await engine();
  const ExcelJS = (await import("exceljs")).default;
  const data = fixture();
  data.menu.dishes[0].name = "=1+1";
  const report = createStudioExport(data, { generatedAt });
  const bytes = await buildXlsx(report);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  assert.equal(workbook.worksheets.length, report.datasets.length + 1);
  for (const item of report.datasets) {
    const sheet = workbook.getWorksheet(item.title);
    assert.equal(sheet.rowCount, Math.max(1, item.rows.length) + 1, item.id);
    assert.equal(sheet.views[0].state, "frozen");
    assert.ok(sheet.autoFilter);
    for (const [index, row] of item.rows.entries()) for (const [colIndex, column] of item.columns.entries()) {
      const value = sheet.getCell(index + 2, colIndex + 1).value;
      if (row[column.key] == null) assert.equal(value, "N/A");
      else if (["number", "percent", "boolean"].includes(column.type)) assert.equal(value, row[column.key]);
    }
  }
  const dishes = dataset(report, "dishes");
  assert.equal(workbook.getWorksheet(dishes.title).getCell(2, dishes.columns.findIndex((column) => column.key === "name") + 1).value, "'=1+1");
  for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)));
});

test("PDF emits a real document with an embedded Unicode font", async () => {
  const { createStudioExport } = await load();
  const { buildPdf } = await engine();
  const report = createStudioExport(fixture(), { generatedAt });
  const bytes = await buildPdf(report);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const structure = Buffer.from(bytes).toString("latin1");
  assert.match(structure, /\/ToUnicode\b/);
  assert.match(structure, /\/FontFile2\b/);
  assert.match(structure, /%%EOF\s*$/);
});

test("PDF text extraction keeps French Unicode, all datasets and last menu row", { skip: spawnSync("pdftotext", ["-v"]).status === 0 ? false : "Optional PDF text QA requires Poppler pdftotext; binary/font checks still run" }, async () => {
  const { createStudioExport } = await load();
  const { buildPdf } = await engine();
  const report = createStudioExport(fixture(), { generatedAt });
  const bytes = await buildPdf(report);
  const dir = mkdtempSync(join(tmpdir(), "vistaire-export-"));
  try {
    const path = join(dir, "report.pdf");
    writeFileSync(path, bytes);
    const text = execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8" });
    for (const item of report.datasets) assert.ok(text.includes(item.title), item.title);
    for (const value of ["Œuf", "l’érable,", "crème", "brûlée", "Plat 35", "N/A", "Page 1 /", window.startInclusive, window.endExclusive]) assert.ok(text.includes(value), value);
    assert.doesNotMatch(text, /Données de démonstration|private-session|private@example/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("export dialog uses current scope, local lazy formats and an accessible cancellable form", () => {
  const path = new URL("../components/admin/studio/StudioExportDialog.tsx", import.meta.url);
  assert.ok(existsSync(path), "The production export dialog must exist");
  const source = readFileSync(path, "utf8");
  assert.match(source, /StudioDialog/);
  assert.match(source, /role="alert"/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-busy=/);
  assert.match(source, /import\("@\/lib\/admin\/studioExportFiles"\)/);
  assert.match(source, /alive\.current/);
  assert.match(source, /locked\.current/);
  assert.doesNotMatch(source, /Tout l.historique|fetch\(|supabase|\/api\//);
});
