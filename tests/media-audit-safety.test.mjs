import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = () => readFile(new URL("../scripts/supabase-usage-audit.mjs", import.meta.url), "utf8");

async function loadMediaAuditModule() {
  try {
    return await import("../lib/owner/mediaAudit.ts");
  } catch (error) {
    assert.fail(`media audit module must load: ${error instanceof Error ? error.message : error}`);
  }
}

function analyticsClient(rows) {
  return {
    from(table) {
      assert.equal(table, "analytics_events");
      const filters = [];
      const query = {
        select() { return query; },
        eq(column, value) { filters.push((row) => row[column] === value); return query; },
        gte(column, value) { filters.push((row) => row[column] >= value); return query; },
        then(resolve) {
          resolve({
            count: rows.filter((row) => filters.every((filter) => filter(row))).length,
            error: null
          });
        }
      };
      return query;
    }
  };
}

test("hosted usage audit preflight requires the exact project ref and explicit opt-in", async () => {
  const { validateSupabaseUsageAuditTarget } = await loadMediaAuditModule();
  const target = {
    supabaseUrl: "https://project-a.supabase.co",
    auditTarget: "",
    allowProductionRead: true
  };

  assert.deepEqual(
    validateSupabaseUsageAuditTarget({ ...target, expectedProjectRef: "" }),
    { ok: false, error: "Expected Supabase project ref is required for hosted targets." }
  );
  assert.deepEqual(
    validateSupabaseUsageAuditTarget({ ...target, expectedProjectRef: "project-b" }),
    { ok: false, error: "Configured project ref is different from the Supabase target." }
  );
  assert.deepEqual(
    validateSupabaseUsageAuditTarget({
      ...target,
      expectedProjectRef: "project-a",
      allowProductionRead: false
    }),
    {
      ok: false,
      error: "Target matches the configured production project; add --allow-production-read for a read-only audit."
    }
  );
  assert.deepEqual(
    validateSupabaseUsageAuditTarget({ ...target, expectedProjectRef: "PROJECT-A" }),
    {
      ok: true,
      projectRef: "project-a",
      hosted: true,
      productionRead: true
    }
  );
});

test("usage audit preflight cannot bypass hosted pinning with DNS or URL variants", async () => {
  const { validateSupabaseUsageAuditTarget } = await loadMediaAuditModule();

  assert.deepEqual(
    validateSupabaseUsageAuditTarget({
      supabaseUrl: "https://project-a.supabase.co.",
      expectedProjectRef: "",
      auditTarget: "",
      allowProductionRead: false
    }),
    { ok: false, error: "Expected Supabase project ref is required for hosted targets." }
  );
  assert.deepEqual(
    validateSupabaseUsageAuditTarget({
      supabaseUrl: "https://custom-supabase.example.test",
      expectedProjectRef: "",
      auditTarget: "production",
      allowProductionRead: true
    }),
    {
      ok: false,
      error: "Remote Supabase targets must use a verifiable <project-ref>.supabase.co host."
    }
  );
  assert.deepEqual(
    validateSupabaseUsageAuditTarget({
      supabaseUrl: "ftp://project-a.supabase.co",
      expectedProjectRef: "project-a",
      auditTarget: "production",
      allowProductionRead: true
    }),
    { ok: false, error: "Supabase audit targets must use HTTPS, except local fixtures." }
  );
});

test("usage audit distinguishes all analytics events from production in every window", async () => {
  const { buildAnalyticsCounts } = await loadMediaAuditModule();
  const now = new Date("2026-08-19T12:00:00.000Z");
  const at = (daysAgo) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  const rows = [
    ...Array.from({ length: 10 }, () => ({ source: "production", created_at: at(0.5) })),
    ...Array.from({ length: 10 }, () => ({ source: "production", created_at: at(2) })),
    ...Array.from({ length: 10 }, () => ({ source: "production", created_at: at(10) })),
    ...Array.from({ length: 10 }, () => ({ source: "production", created_at: at(40) })),
    ...Array.from({ length: 10 }, () => ({ source: "preview", created_at: at(0.5) })),
    ...Array.from({ length: 10 }, () => ({ source: "preview", created_at: at(2) })),
    ...Array.from({ length: 10 }, () => ({ source: "preview", created_at: at(40) })),
    ...Array.from({ length: 5 }, () => ({ source: "other", created_at: at(0.5) })),
    ...Array.from({ length: 5 }, () => ({ source: "other", created_at: at(2) })),
    ...Array.from({ length: 10 }, () => ({ source: "other", created_at: at(10) })),
    ...Array.from({ length: 10 }, () => ({ source: "other", created_at: at(40) }))
  ];

  const analytics = await buildAnalyticsCounts(analyticsClient(rows), now);

  assert.deepEqual(analytics, {
    all: {
      total: { ok: true, count: 100 },
      last24h: { ok: true, count: 25 },
      last7d: { ok: true, count: 50 },
      last30d: { ok: true, count: 70 }
    },
    production: {
      total: { ok: true, count: 40 },
      last24h: { ok: true, count: 10 },
      last7d: { ok: true, count: 20 },
      last30d: { ok: true, count: 30 }
    }
  });
});

test("usage audit selects image_url and preserves invalid metadata as invalid", async () => {
  const script = await source();

  assert.match(script, /select\("id,restaurant_id,image_url,metadata"\)/);
  assert.match(script, /metadataValid/);
  assert.match(script, /imageUrl: row\.image_url/);
});

test("usage audit rejects absent object sizes and delegates strict V1 validation", async () => {
  const script = await source();

  assert.match(script, /requireStorageObjectBytes/);
  assert.match(script, /verifyLegacyDerivativeObject/);
  assert.doesNotMatch(script, /Number\(entry\.metadata\?\.size \?\? entry\.metadata\?\.size_bytes \?\? 0\) \|\| 0/);
});

test("usage audit publishes strict coverage counters and fails closed on partial coverage", async () => {
  const script = await source();

  assert.match(script, /buildStrictPhotoCoverageCounts\(photoAudit\)/);
  assert.match(script, /\.\.\.strictCoverage/);
  assert.match(script, /overallStatus !== "pass"/);
});
