import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const loadCreationCore = () => import("../lib/owner/qrCreationCore.ts");
const loadResolutionCore = () => import("../lib/owner/qrResolutionCore.ts");

test("admin QR creation rejects a blank restaurant before persistence or fallback", async () => {
  const { createOwnerQrCodeWithDependencies } = await loadCreationCore();
  let persistCalls = 0;
  let fallbackCalls = 0;

  const result = await createOwnerQrCodeWithDependencies(
    {
      restaurantId: " \t ",
      targetKind: "admin",
      targetPath: "/admin",
      label: "QR dashboard restaurant"
    },
    {
      persistQrCode: async () => {
        persistCalls += 1;
        return {
          ok: false,
          error: "storage unavailable",
          fallbackEligible: true
        };
      },
      createSignedMenuFallback: () => {
        fallbackCalls += 1;
        return "must-not-be-signed";
      }
    }
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /restaurant/i);
  assert.equal(persistCalls, 0);
  assert.equal(fallbackCalls, 0);
});

test("structured Supabase failures expose a stable code and incident reference", async () => {
  const { buildQrSupabaseFailure } = await loadCreationCore();
  const failure = buildQrSupabaseFailure({
    code: "QR_CREATE_INSERT_FAILED",
    incidentId: "incident-create-123"
  });

  assert.equal(failure.ok, false);
  assert.equal(failure.code, "QR_CREATE_INSERT_FAILED");
  assert.equal(failure.incidentId, "incident-create-123");
  assert.match(failure.error, /Reference incident : incident-create-123/);
  assert.doesNotMatch(failure.error, /duplicate key|supabase|token_hash/i);
  assert.equal("fallbackEligible" in failure, false);
});

test("QR creation maps actionable Supabase schema and ownership failures without exposing database text", async () => {
  const { classifyQrCreatePersistenceFailure } = await loadCreationCore();

  const cases = [
    [{ code: "42703", message: 'column "target_kind" does not exist' }, "QR_CREATE_TARGET_KIND_MISSING"],
    [{ code: "42P01", message: 'relation "qr_codes" does not exist' }, "QR_CREATE_SCHEMA_MIGRATION_REQUIRED"],
    [{ code: "23503", message: "foreign key violation" }, "QR_CREATE_RESTAURANT_NOT_FOUND"],
    [{ code: "42501", message: "permission denied" }, "QR_CREATE_SERVICE_ROLE_INCOMPATIBLE"],
    [{ code: "XX000", message: "unexpected database error" }, "QR_CREATE_INSERT_FAILED"]
  ];

  for (const [error, expected] of cases) {
    assert.equal(classifyQrCreatePersistenceFailure(error), expected);
  }
});

test("structured failures survive the public creation boundaries", async () => {
  const { buildQrSupabaseFailure, createOwnerQrCodeWithDependencies } =
    await loadCreationCore();
  const failure = buildQrSupabaseFailure({
    code: "QR_CREATE_INSERT_FAILED",
    incidentId: "incident-boundary-123"
  });
  const result = await createOwnerQrCodeWithDependencies(
    {
      restaurantId: "rest-a",
      targetKind: "menu",
      targetPath: "/menu/restaurant-a",
      label: "QR menu"
    },
    {
      persistQrCode: async () => failure,
      createSignedMenuFallback: () => "must-not-be-signed"
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "QR_CREATE_INSERT_FAILED");
  assert.equal(result.incidentId, "incident-boundary-123");

  const creationSource = (
    await readFile("lib/owner/qrCreationCore.ts", "utf8")
  ).replace(/\r\n/g, "\n");
  const storeSource = (await readFile("lib/owner/qrStore.ts", "utf8")).replace(
    /\r\n/g,
    "\n"
  );
  assert.match(
    creationSource,
    /export async function createOwnerQrCodeWithDependencies\([\s\S]*?\): Promise<QrPersistenceResult> \{/
  );
  assert.match(
    storeSource,
    /export async function createOwnerQrCode\([\s\S]*?\): Promise<QrPersistenceResult> \{/
  );
});

test("QR incident redaction removes opaque 32-character tokens and hashes", async () => {
  const { redactQrIncidentLogText } = await loadCreationCore();
  const rawToken = randomBytes(24).toString("base64url");
  const rawHash = "a".repeat(64);
  const redacted = redactQrIncidentLogText(
    `Key (token_hash)=(${rawHash}); token=${rawToken}`
  );

  assert.equal(typeof redacted, "string");
  assert.equal(rawToken.length, 32);
  assert.doesNotMatch(redacted, new RegExp(rawToken));
  assert.doesNotMatch(redacted, new RegExp(rawHash));
  assert.doesNotMatch(redacted, /token_hash/i);
  assert.match(redacted, /\[redacted-(?:field|hash|token)\]/);
  assert.equal(redactQrIncidentLogText(null), null);
});

test("menu fallback runs only for a structured eligible persistence failure", async () => {
  const { buildQrSupabaseFailure, createOwnerQrCodeWithDependencies } =
    await loadCreationCore();
  let fallbackCalls = 0;
  const args = {
    restaurantId: "rest-a",
    targetKind: "menu",
    targetPath: "/menu/restaurant-a",
    label: "QR menu"
  };

  const eligible = await createOwnerQrCodeWithDependencies(args, {
    persistQrCode: async () =>
      buildQrSupabaseFailure({
        code: "QR_CREATE_CONFIG_UNAVAILABLE",
        incidentId: "incident-config-123",
        fallbackEligible: true
      }),
    createSignedMenuFallback: () => {
      fallbackCalls += 1;
      return "signed-menu-token";
    }
  });

  assert.equal(eligible.ok, true);
  assert.equal(eligible.persisted, false);
  assert.equal(fallbackCalls, 1);

  const ineligible = buildQrSupabaseFailure({
    code: "QR_CREATE_INSERT_FAILED",
    incidentId: "incident-insert-123"
  });
  const rejected = await createOwnerQrCodeWithDependencies(args, {
    persistQrCode: async () => ineligible,
    createSignedMenuFallback: () => {
      fallbackCalls += 1;
      return "must-not-be-signed";
    }
  });

  assert.deepEqual(rejected, ineligible);
  assert.equal(fallbackCalls, 1);
});

test("metadata resolution accepts only canonical admin paths with a restaurant", async () => {
  const { resolveQrRowMetadata } = await loadResolutionCore();
  const canonical = {
    qrId: "qr-admin",
    restaurantId: "rest-a",
    status: "active",
    targetKind: "admin",
    targetPath: "/admin"
  };

  assert.deepEqual(resolveQrRowMetadata(canonical), {
    ok: true,
    qrId: "qr-admin",
    restaurantId: "rest-a",
    targetKind: "admin",
    targetPath: "/admin"
  });

  for (const targetPath of [
    "/admin/settings",
    "/owner",
    "/owner/restaurants/rest-a"
  ]) {
    assert.deepEqual(resolveQrRowMetadata({ ...canonical, targetPath }), {
      ok: false
    });
  }
  assert.deepEqual(
    resolveQrRowMetadata({ ...canonical, restaurantId: "   " }),
    { ok: false }
  );
});

test("metadata RPC fallback recognizes only stable codes or the exact missing function", async () => {
  const { isQrMetadataRpcUnavailable } = await loadResolutionCore();

  for (const error of [
    { code: "42883", message: "generic database error" },
    { code: "PGRST202", message: "generic PostgREST error" },
    {
      message:
        "function public.resolve_qr_code_scan_metadata(text) does not exist"
    },
    {
      message:
        "Could not find the function public.resolve_qr_code_scan_metadata(p_token_hash) in the schema cache"
    }
  ]) {
    assert.equal(isQrMetadataRpcUnavailable(error), true, JSON.stringify(error));
  }

  for (const error of [
    null,
    { message: "schema cache is stale" },
    {
      message:
        "Could not find the function public.resolve_another_function in the schema cache"
    },
    {
      code: "XX000",
      message:
        "Could not find the function public.resolve_qr_code_scan_metadata in the schema cache"
    },
    {
      code: "23505",
      message:
        "function public.resolve_qr_code_scan_metadata(text) does not exist"
    }
  ]) {
    assert.equal(isQrMetadataRpcUnavailable(error), false, JSON.stringify(error));
  }
});

test("legacy scan resolution is strictly menu-only and forces menu metadata", async () => {
  const { resolveLegacyMenuQrScan } = await loadResolutionCore();

  for (const targetPath of ["/demo", "/menu/restaurant-a?table=12"]) {
    assert.deepEqual(
      resolveLegacyMenuQrScan(
        {
          qrId: "qr-menu",
          restaurantId: "rest-a",
          status: "active",
          targetPath
        },
        targetPath
      ),
      {
        ok: true,
        qrId: "qr-menu",
        restaurantId: "rest-a",
        targetKind: "menu",
        targetPath
      }
    );
  }
});

test("legacy scan resolution rejects admin, owner, mismatch, inactive, and missing id rows", async () => {
  const { resolveLegacyMenuQrScan } = await loadResolutionCore();
  const row = {
    qrId: "qr-menu",
    restaurantId: "rest-a",
    status: "active",
    targetPath: "/menu/restaurant-a"
  };

  for (const targetPath of [
    "/admin",
    "/admin/settings",
    "/owner",
    "/owner/restaurants/rest-a",
    "/demo?preview=1"
  ]) {
    assert.deepEqual(
      resolveLegacyMenuQrScan({ ...row, targetPath }, targetPath),
      { ok: false }
    );
  }
  assert.deepEqual(resolveLegacyMenuQrScan(row, "/menu/other"), { ok: false });
  assert.deepEqual(
    resolveLegacyMenuQrScan({ ...row, status: "paused" }, row.targetPath),
    { ok: false }
  );
  assert.deepEqual(
    resolveLegacyMenuQrScan({ ...row, qrId: "   " }, row.targetPath),
    { ok: false }
  );
});

test("qrStore uses structured incident logging for every Supabase QR error path", async () => {
  const source = (await readFile("lib/owner/qrStore.ts", "utf8")).replace(
    /\r\n/g,
    "\n"
  );

  assert.match(source, /import \{ randomUUID \} from "node:crypto";/);
  assert.match(
    source,
    /console\.error\(\s*"\[Vistaire owner\] QR Supabase incident",\s*\{[\s\S]*?incidentId,[\s\S]*?operation,[\s\S]*?code,/
  );
  assert.match(
    source,
    /supabase:\s*\{[\s\S]*?code:[\s\S]*?message:[\s\S]*?details:[\s\S]*?hint:/
  );
  assert.match(source, /config:\s*\{\s*reason:/);
  assert.match(source, /redactQrIncidentLogText/);
  for (const field of ["message", "details", "hint"]) {
    assert.match(
      source,
      new RegExp(
        `${field}:\\s*redactQrIncidentLogText\\(input\\.supabaseError\\.${field}\\)`
      ),
      `${field} is redacted before logging`
    );
  }

  for (const code of [
    "QR_CREATE_CONFIG_UNAVAILABLE",
    "QR_UPDATE_CONFIG_UNAVAILABLE",
    "QR_UPDATE_FAILED",
    "QR_MARK_RESTAURANT_READY_FAILED",
    "QR_RESOLVE_METADATA_FAILED",
    "QR_RESOLVE_LEGACY_RPC_FAILED",
    "QR_RESOLVE_LEGACY_SELECT_FAILED"
  ]) {
    assert.match(source, new RegExp(`code: "${code}"`), code);
  }
  assert.match(source, /classifyQrCreatePersistenceFailure\(error\)/);

  const incidentCalls = [
    ...source.matchAll(/logQrSupabaseIncident\(\{([\s\S]*?)\n\s*\}\);/g)
  ].map((match) => match[1]);
  assert.ok(incidentCalls.length >= 8);
  for (const call of incidentCalls) {
    assert.doesNotMatch(call, /token(?:_hash|Hash)?\s*:/i);
  }
  assert.doesNotMatch(
    source,
    /console\.(?:error|warn)\([\s\S]{0,160}?error\.message/
  );
  assert.match(
    source,
    /if \(error && !isSupabaseMiss\(error\)\) \{[\s\S]*?code: "QR_UPDATE_FAILED"/
  );
});

test("qrStore falls back to the legacy RPC only for metadata unavailability", async () => {
  const source = (await readFile("lib/owner/qrStore.ts", "utf8")).replace(
    /\r\n/g,
    "\n"
  );
  const metadataStart = source.indexOf(
    'client.rpc("resolve_qr_code_scan_metadata"'
  );
  const legacyStart = source.indexOf('client.rpc("resolve_qr_code_scan"');
  assert.notEqual(metadataStart, -1);
  assert.notEqual(legacyStart, -1);

  const metadataBranch = source.slice(metadataStart, legacyStart);
  assert.match(
    metadataBranch,
    /if \(!isQrMetadataRpcUnavailable\(error\)\) \{[\s\S]*?logQrSupabaseIncident\([\s\S]*?return \{ ok: false \};[\s\S]*?metadataRpcUnavailable = true;/
  );
  assert.match(metadataBranch, /if \(!row\) continue;/);

  const legacyBranch = source.slice(legacyStart);
  assert.match(
    legacyBranch,
    /\.select\("id, restaurant_id, target_path, status"\)/
  );
  assert.doesNotMatch(
    legacyBranch,
    /\.select\("[^"]*target_kind[^"]*"\)/
  );
  assert.match(legacyBranch, /return resolveLegacyMenuQrScan\(/);
  assert.match(
    legacyBranch,
    /if \(selectError\) \{[\s\S]*?logQrSupabaseIncident\([\s\S]*?return \{ ok: false \};[\s\S]*?if \(!row\) return \{ ok: false \};/
  );
});
