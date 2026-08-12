import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildAdminEvidenceBundle, projectEvidenceForAudience } from "../lib/admin/data/evidenceRegistry.ts";
import { buildAdminReport } from "../lib/admin/reports/buildReport.ts";
import { sanitizeCsvCell, serializeAdminReportCsv } from "../lib/admin/reports/csv.ts";
import { privateReportResponse } from "../lib/admin/reports/exportReport.ts";

const scope = { restaurantId: "r-private", menuId: "m-private", source: "production", timezone: "UTC" };
const window = { range: "today", timezone: "UTC", calendarDayCount: 1, observedAt: "2026-05-19T20:42:00.000Z", current: { from: "2026-05-19T00:00:00.000Z", to: "2026-05-19T20:42:00.000Z" }, previous: { from: "2026-05-18T00:00:00.000Z", to: "2026-05-18T20:42:00.000Z" }, alignment: "local-calendar-v1" };

function record(metricId, period, state, audiences = ["ui", "export"]) {
  return { metricId, period, state, definitionVersion: "admin-vnext-observed-v1", labelKey: `metrics.${metricId}`, provenance: { source: "production" }, freshness: { generatedAt: window.observedAt }, sample: { state: state.kind }, privacy: { classification: "aggregate", promptUnsafe: false }, audiences };
}

function fixture() {
  const bundle = buildAdminEvidenceBundle({ scope, window, generatedAt: window.observedAt, records: [
    record("observed-menu-opens", "current", { kind: "available", value: { count: 8 } }),
    record("observed-menu-opens", "previous", { kind: "available", value: { count: 4 } }),
    record("private-search-ranking", "current", { kind: "available", value: [{ term: "=SUM(A1:A2), café; \"menu\"\r\nligne", count: 3 }] })
  ] });
  return { bundle, report: buildAdminReport({ locale: "fr", range: "today", service: "all", bundle }) };
}

test("CSV formula prefixes are neutralized before escaping", () => {
  for (const input of ["=SUM(A1:A2)", "+cmd", "-1+2", "@import", "\tformula", "\rformula"]) {
    assert.equal(sanitizeCsvCell(input), `'${input}`);
  }
  for (const input of ["normal", "1", "café", " space", "a,b", "a;b", "a\"b", "a\nb"]) {
    assert.equal(sanitizeCsvCell(input), input);
  }
});

test("CSV is deterministic UTF-8 with BOM, CRLF and export-authorized evidence only", () => {
  const { bundle, report } = fixture();
  const bytes = serializeAdminReportCsv({ locale: "fr", report, evidence: projectEvidenceForAudience(bundle, "export") });
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  assert.match(csv, /^\uFEFF/);
  assert.match(csv, /\r\n/);
  assert.doesNotMatch(csv.replaceAll("\r\n", ""), /\n|\r/);
  assert.match(csv, /'=SUM\(A1:A2\), café; ""menu""/);
  assert.match(csv, /Ouvertures du menu observées/);
  assert.doesNotMatch(csv, /r-private|m-private/);
});

test("unknown and UI-only evidence references fail closed", () => {
  const { bundle, report } = fixture();
  const projection = projectEvidenceForAudience(bundle, "export");
  const firstId = report.metrics[0].current.evidenceIds[0];
  const records = { ...projection.records };
  delete records[firstId];
  assert.throws(() => serializeAdminReportCsv({ locale: "fr", report, evidence: { ...projection, records } }), /unauthorized/i);
});

test("private report responses apply cache and MIME hardening to success and errors", async () => {
  for (const [status, body] of [[200, new Uint8Array([1, 2])], [400, "invalid"], [401, "unauthorized"], [503, "unavailable"]]) {
    const response = privateReportResponse(body, { status, contentType: status === 200 ? "text/csv; charset=utf-8" : "application/json; charset=utf-8" });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Cookie");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    await response.arrayBuffer();
  }
});

test("export route rebuilds server evidence and never accepts client calculations", async () => {
  const route = await readFile(new URL("../app/admin/api/reports/export/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireAdminRestaurantAccess\(["']dashboard:read["']\)/);
  assert.match(route, /loadAdminDataBundle\(/);
  assert.match(route, /projectEvidenceForAudience\([^,]+,\s*["']export["']\)/);
  assert.match(route, /serializeAdminReportCsv\(/);
  assert.match(route, /privateReportResponse\(/);
  assert.match(route, /Content-Disposition/);
  assert.doesNotMatch(route, /request\.(json|formData)\(|body\s*:/);
  assert.doesNotMatch(route, /restaurantId|menuId|source|timezone/);
});
