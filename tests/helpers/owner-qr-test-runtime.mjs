import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

function dependencyRequire() {
  const localRequire = createRequire(import.meta.url);
  try {
    localRequire.resolve("typescript");
    return localRequire;
  } catch {
    const commonGitDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: process.cwd(), encoding: "utf8" }
    ).trim();
    return createRequire(path.join(path.dirname(commonGitDir), "package.json"));
  }
}

const requireDependency = dependencyRequire();
const ts = requireDependency("typescript");
const NEXT_SERVER_URL = pathToFileURL(requireDependency.resolve("next/server")).href;

const ROOT_URL = pathToFileURL(`${path.resolve(process.cwd())}${path.sep}`).href;
const ADMIN_STUB_URL = "qr-test:admin";
const AUTH_STUB_URL = "qr-test:owner-auth";
const ROWS_STUB_URL = "qr-test:rows";
const MENU_URLS_STUB_URL = "qr-test:menu-urls";

function localModuleUrl(url) {
  const parsed = new URL(url);
  if (path.extname(parsed.pathname)) return parsed.href;
  for (const extension of [".ts", ".tsx", ".mjs", ".js"]) {
    const candidate = new URL(`${parsed.href}${extension}`);
    if (existsSync(candidate)) return candidate.href;
  }
  return parsed.href;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export%20default%20%7B%7D", shortCircuit: true };
    }
    if (specifier === "@/utils/supabase/admin") {
      return { url: ADMIN_STUB_URL, shortCircuit: true };
    }
    if (specifier === "@/lib/auth/ownerApi") {
      return { url: AUTH_STUB_URL, shortCircuit: true };
    }
    if (specifier === "@/lib/analytics/serverRows") {
      return { url: ROWS_STUB_URL, shortCircuit: true };
    }
    if (specifier === "@/lib/owner/menuUrls") {
      return { url: MENU_URLS_STUB_URL, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return {
        url: localModuleUrl(new URL(specifier.slice(2), ROOT_URL).href),
        shortCircuit: true
      };
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      const candidate = localModuleUrl(new URL(specifier, context.parentURL).href);
      if (candidate !== new URL(specifier, context.parentURL).href) {
        return { url: candidate, shortCircuit: true };
      }
    }
    if (specifier === "next/server") {
      return {
        url: NEXT_SERVER_URL,
        shortCircuit: true
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === ADMIN_STUB_URL) {
      return {
        format: "module",
        source:
          "export const getSupabaseAdminClient = () => globalThis.__OWNER_QR_TEST_ADMIN__;",
        shortCircuit: true
      };
    }
    if (url === AUTH_STUB_URL) {
      return {
        format: "module",
        source: `
          export const requireVistaireOwnerApi = async () => ({
            ok: true,
            userId: "owner-fixture"
          });
          export const requireSameOriginOwnerMutation = () => null;
        `,
        shortCircuit: true
      };
    }
    if (url === ROWS_STUB_URL) {
      return {
        format: "module",
        source: `
          export const getSupabaseTableColumns = async () => new Set();
          export const pickColumn = (_columns, candidates) => candidates[0] ?? null;
          export const getString = (row, keys, fallback = "") => {
            for (const key of keys) {
              const value = row?.[key];
              if (typeof value === "string") return value;
            }
            return fallback;
          };
          export const getNumber = (row, keys, fallback = 0) => {
            for (const key of keys) {
              const value = row?.[key];
              if (typeof value === "number" && Number.isFinite(value)) return value;
            }
            return fallback;
          };
        `,
        shortCircuit: true
      };
    }
    if (url === MENU_URLS_STUB_URL) {
      return {
        format: "module",
        source:
          "export const buildQrRedirectUrl = token => `/q/${encodeURIComponent(token)}`;",
        shortCircuit: true
      };
    }
    if (url.endsWith(".ts") || url.endsWith(".tsx")) {
      const filename = new URL(url);
      const source = readFileSync(filename, "utf8");
      const output = ts.transpileModule(source, {
        fileName: filename.pathname,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX
        }
      });
      return { format: "module", source: output.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  }
});

export async function loadQrStore() {
  return import("../../lib/owner/qrStore.ts");
}

export async function loadQrPostRoute() {
  return import("../../app/api/owner/qr-codes/route.ts");
}

export async function loadQrPatchRoute() {
  return import("../../app/api/owner/qr-codes/[id]/route.ts");
}

export async function loadQrRotateRoute() {
  return import("../../app/api/owner/qr-codes/[id]/rotate/route.ts");
}

export async function loadQrRetargetRoute() {
  return import("../../app/api/owner/qr-codes/[id]/retarget/route.ts");
}

function storedHash(token) {
  return `sha256:${createHash("sha256").update(token, "utf8").digest("hex")}`;
}

function preview(token) {
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export function createPromiseBarrier(participants = 2) {
  let arrivals = 0;
  let release;
  const released = new Promise((resolve) => {
    release = resolve;
  });
  return {
    async arrive() {
      arrivals += 1;
      if (arrivals === participants) release();
      await released;
    },
    get arrivals() {
      return arrivals;
    }
  };
}

export function createQrSupabaseFixture(options = {}) {
  const rows = [];
  const calls = [];
  const recoveredUrls = new Map();
  const canonicalBatches = new Map();
  let sequence = 0;
  let beforeQrUpdateCalled = false;
  const uniqueConstraints = [["token_hash"]];

  function seedQr({ token, ...row }) {
    const tokenHash = row.token_hash ?? storedHash(token);
    const tokenPreview = row.token_preview ?? preview(token);
    const seeded = {
      id: row.id ?? `qr-seed-${++sequence}`,
      restaurant_id: row.restaurant_id ?? "restaurant-fixture",
      label: row.label ?? "QR fixture",
      token_hash: tokenHash,
      token_preview: tokenPreview,
      target_kind: row.target_kind,
      purpose_key: row.purpose_key ?? null,
      target_path: row.target_path ?? "/admin",
      style_json: row.style_json ?? {},
      status: row.status ?? "active",
      config_version: row.config_version ?? 1,
      is_canonical: row.is_canonical ?? false,
      token_ciphertext: row.token_ciphertext ?? null,
      token_nonce: row.token_nonce ?? null,
      token_key_version: row.token_key_version ?? null,
      scan_count: row.scan_count ?? 0,
      last_scanned_at: row.last_scanned_at ?? null,
      created_at: row.created_at ?? "2026-07-17T12:00:00.000Z",
      updated_at: row.updated_at ?? "2026-07-17T12:00:00.000Z"
    };
    if (row.omit_target_kind) delete seeded.target_kind;
    rows.push(seeded);
    if (typeof row.redirect_url === "string") {
      recoveredUrls.set(seeded.id, row.redirect_url);
    }
    return seeded.id;
  }

  function canonicalSlot(params) {
    return {
      restaurantId: params.p_restaurant_id,
      targetKind: String(params.p_target_kind ?? "").trim().toLowerCase(),
      purposeKey: String(params.p_purpose_key ?? "default").trim().toLowerCase()
    };
  }

  function canonicalForSlot(params) {
    const slot = canonicalSlot(params);
    return rows.find(
      (row) =>
        row.restaurant_id === slot.restaurantId &&
        row.target_kind === slot.targetKind &&
        row.purpose_key === slot.purposeKey &&
        row.is_canonical === true
    );
  }

  function hasCompleteEnvelope(row) {
    return (
      typeof row?.token_ciphertext === "string" &&
      row.token_ciphertext.trim().length > 0 &&
      typeof row?.token_nonce === "string" &&
      row.token_nonce.trim().length > 0 &&
      typeof row?.token_key_version === "string" &&
      row.token_key_version.trim().length > 0
    );
  }

  function canonicalRpcRow(row, created) {
    return {
      result_status: hasCompleteEnvelope(row)
        ? "canonical"
        : "canonical-unrecoverable",
      created,
      ...structuredClone(row)
    };
  }

  function canonicalCandidateError(params) {
    const requiredText = [
      params.p_id,
      params.p_restaurant_id,
      params.p_token_hash,
      params.p_token_ciphertext,
      params.p_token_nonce,
      params.p_token_key_version
    ];
    if (
      requiredText.some(
        (value) => typeof value !== "string" || value.trim().length === 0
      )
    ) {
      return {
        data: null,
        error: { code: "22023", message: "canonical QR candidate is incomplete" }
      };
    }
    return null;
  }

  function insertCanonicalCandidate(params) {
    const invalid = canonicalCandidateError(params);
    if (invalid) return invalid;
    if (rows.some((row) => row.id === params.p_id || row.token_hash === params.p_token_hash)) {
      return {
        data: null,
        error: { code: "23505", message: "canonical QR token collision" }
      };
    }
    const slot = canonicalSlot(params);
    const now = "2026-07-17T12:00:00.000Z";
    const row = {
      id: params.p_id,
      restaurant_id: slot.restaurantId,
      label: params.p_label,
      target_kind: slot.targetKind,
      purpose_key: slot.purposeKey,
      target_path: params.p_target_path,
      token_hash: params.p_token_hash,
      token_preview: params.p_token_preview,
      token_ciphertext: params.p_token_ciphertext,
      token_nonce: params.p_token_nonce,
      token_key_version: params.p_token_key_version,
      style_json: structuredClone(params.p_style_json ?? {}),
      status: "active",
      config_version: 1,
      is_canonical: true,
      scan_count: 0,
      last_scanned_at: null,
      created_at: now,
      updated_at: now
    };
    rows.push(row);
    if (typeof params.p_redirect_url === "string") {
      recoveredUrls.set(row.id, params.p_redirect_url);
    }
    return { data: [canonicalRpcRow(row, true)], error: null };
  }

  function handleCanonicalGetOrCreate(params) {
    const existing = canonicalForSlot(params);
    if (existing) {
      return Promise.resolve({
        data: [canonicalRpcRow(existing, false)],
        error: null
      });
    }

    const participants = options.canonicalConcurrencyParticipants ?? 1;
    if (participants === 1) {
      return Promise.resolve(insertCanonicalCandidate(params));
    }

    const slot = canonicalSlot(params);
    const key = `${slot.restaurantId}:${slot.targetKind}:${slot.purposeKey}`;
    const batch = canonicalBatches.get(key) ?? [];
    canonicalBatches.set(key, batch);
    return new Promise((resolve) => {
      batch.push({ params, resolve });
      if (batch.length !== participants) return;

      canonicalBatches.delete(key);
      const ordered = [...batch].sort((left, right) =>
        String(left.params.p_id).localeCompare(String(right.params.p_id))
      );
      const winner = ordered[0];
      const inserted = insertCanonicalCandidate(winner.params);
      if (inserted.error) {
        for (const entry of batch) entry.resolve(inserted);
        return;
      }
      const persisted = canonicalForSlot(winner.params);
      for (const entry of batch) {
        entry.resolve({
          data: [canonicalRpcRow(persisted, entry === winner)],
          error: null
        });
      }
    });
  }

  function handleCanonicalRotation(params) {
    if (params.p_confirm !== true) {
      return {
        data: null,
        error: { code: "22023", message: "rotation confirmation required" }
      };
    }
    const previous = canonicalForSlot(params);
    if (!previous || previous.id !== params.p_previous_id) {
      return {
        data: null,
        error: { code: "P0002", message: "canonical QR was not found" }
      };
    }
    const invalid = canonicalCandidateError({
      ...params,
      p_id: params.p_new_id
    });
    if (invalid) return invalid;
    if (
      rows.some(
        (row) => row.id === params.p_new_id || row.token_hash === params.p_token_hash
      )
    ) {
      return {
        data: null,
        error: { code: "23505", message: "canonical QR token collision" }
      };
    }

    if (typeof options.beforeCanonicalRotation === "function") {
      options.beforeCanonicalRotation(previous);
    }
    previous.is_canonical = false;
    const inserted = insertCanonicalCandidate({
      ...params,
      p_id: params.p_new_id,
      p_label: previous.label,
      p_target_path: previous.target_path,
      p_style_json: previous.style_json
    });
    if (inserted.error) return inserted;
    return {
      data: [
        {
          ...canonicalRpcRow(previous, false),
          result_status: "previous"
        },
        ...inserted.data
      ],
      error: null
    };
  }

  function matchingRows(filters) {
    return rows.filter((row) =>
      filters.every(({ column, value }) => row[column] === value)
    );
  }

  function projectRow(row, columns) {
    if (columns === "*") return { ...row };
    const projected = {};
    for (const column of columns.split(",").map((item) => item.trim())) {
      if (column && column in row) projected[column] = row[column];
    }
    return projected;
  }

  class Query {
    constructor(table) {
      this.table = table;
      this.operation = { kind: "select" };
      this.columns = "*";
      this.filters = [];
      this.limitCount = null;
    }

    insert(value) {
      this.operation = { kind: "insert", value };
      calls.push({ table: this.table, method: "insert", keys: Object.keys(value).sort() });
      return this;
    }

    upsert(value, config = {}) {
      this.operation = { kind: "upsert", value, config };
      calls.push({
        table: this.table,
        method: "upsert",
        keys: Object.keys(value).sort(),
        onConflict: config.onConflict ?? null
      });
      return this;
    }

    update(value) {
      this.operation = { kind: "update", value };
      calls.push({ table: this.table, method: "update", keys: Object.keys(value).sort() });
      return this;
    }

    select(columns = "*") {
      this.columns = columns;
      calls.push({ table: this.table, method: "select", columns });
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value });
      calls.push({
        table: this.table,
        method: "eq",
        column,
        value: column === "token_hash" ? "[fingerprint]" : value
      });
      return this;
    }

    limit(count) {
      this.limitCount = count;
      calls.push({ table: this.table, method: "limit", count });
      return this;
    }

    async execute() {
      if (this.table === "restaurants") {
        const id = this.filters.find((filter) => filter.column === "id")?.value;
        const restaurant = id
          ? { id, slug: options.restaurantSlug ?? "restaurant-fixture" }
          : null;
        return {
          data: restaurant ? [projectRow(restaurant, this.columns)] : [],
          error: null
        };
      }

      if (this.operation.kind === "insert") {
        const ordinal = ++sequence;
        const duplicate = rows.find(
          (row) => row.token_hash === this.operation.value.token_hash
        );
        if (duplicate) {
          return {
            data: null,
            error: { code: "23505", message: "unique constraint violation" }
          };
        }
        const now = "2026-07-17T12:00:00.000Z";
        const row = {
          id: `qr-${ordinal}`,
          ...this.operation.value,
          created_at: now,
          updated_at: now
        };
        rows.push(row);
        return { data: row, error: null };
      }

      if (this.operation.kind === "upsert") {
        const value = this.operation.value;
        const conflictColumns = String(this.operation.config.onConflict ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const hasBackingConstraint = uniqueConstraints.some(
          (constraint) =>
            constraint.length === conflictColumns.length &&
            constraint.every((column) => conflictColumns.includes(column))
        );
        if (!hasBackingConstraint) {
          return {
            data: null,
            error: {
              code: "42P10",
              message: "no unique or exclusion constraint matches ON CONFLICT"
            }
          };
        }
        const existing = rows.find((row) =>
          conflictColumns.length > 0 &&
          conflictColumns.every((column) => row[column] === value[column])
        );
        if (existing) {
          Object.assign(existing, value);
          return { data: existing, error: null };
        }
        const row = {
          id: `qr-${++sequence}`,
          ...value,
          created_at: "2026-07-17T12:00:00.000Z",
          updated_at: "2026-07-17T12:00:00.000Z"
        };
        rows.push(row);
        return { data: row, error: null };
      }

      if (this.operation.kind === "update") {
        if (options.qrUpdateError) {
          return { data: null, error: structuredClone(options.qrUpdateError) };
        }
        if (!beforeQrUpdateCalled && typeof options.beforeQrUpdate === "function") {
          beforeQrUpdateCalled = true;
          options.beforeQrUpdate(rows);
        }
        const row = matchingRows(this.filters)[0];
        if (!row) {
          return {
            data: null,
            error: { code: "PGRST116", details: "The result contains 0 rows" }
          };
        }
        Object.assign(row, this.operation.value);
        return { data: row, error: null };
      }

      if (
        options.oldSchemaWithoutTargetKind &&
        /\btarget_kind\b/.test(this.columns)
      ) {
        calls.push({
          table: this.table,
          method: "error",
          code: "42703",
          columns: this.columns
        });
        return {
          data: null,
          error: { code: "42703", message: 'column "target_kind" does not exist' }
        };
      }
      if (
        options.safeInventoryReadError &&
        this.table === "qr_codes" &&
        /\bconfig_version\b/.test(this.columns) &&
        !/\btoken_hash\b/.test(this.columns)
      ) {
        return {
          data: null,
          error: structuredClone(options.safeInventoryReadError)
        };
      }
      const found = matchingRows(this.filters);
      const limited = this.limitCount === null ? found : found.slice(0, this.limitCount);
      const data = limited.map((row) => projectRow(row, this.columns));
      return { data, error: null };
    }

    async single() {
      const result = await this.execute();
      if (result.error) return result;
      const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
      return data
        ? { data, error: null }
        : { data: null, error: { code: "PGRST116", details: "The result contains 0 rows" } };
    }

    async maybeSingle() {
      const result = await this.execute();
      if (result.error) return result;
      if (Array.isArray(result.data) && result.data.length > 1) {
        return {
          data: null,
          error: {
            code: "PGRST116",
            details: "The result contains more than 1 row"
          }
        };
      }
      const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
      return { data, error: null };
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }
  }

  const client = {
    from(table) {
      calls.push({ method: "from", table });
      return new Query(table);
    },
    async rpc(name, params) {
      calls.push({ method: "rpc", name });
      const row = rows.find((candidate) => candidate.token_hash === params.p_token_hash);

      if (name === "owner_get_or_create_canonical_qr") {
        return handleCanonicalGetOrCreate(params);
      }

      if (name === "owner_rotate_canonical_qr") {
        return handleCanonicalRotation(params);
      }

      if (name === "resolve_qr_code_scan_metadata") {
        if (options.metadataUnavailable) {
          return {
            data: null,
            error: {
              code: "PGRST202",
              message: "metadata function is unavailable in this fixture schema"
            }
          };
        }
        if (!row || row.status !== "active") return { data: [], error: null };
        row.scan_count += 1;
        row.last_scanned_at = "2026-07-17T12:00:01.000Z";
        return {
          data: [
            {
              qr_id: row.id,
              restaurant_id: row.restaurant_id,
              target_kind: row.target_kind,
              target_path: row.target_path,
              status: row.status
            }
          ],
          error: null
        };
      }

      if (name === "resolve_qr_code_scan") {
        if (!row || row.status !== "active") return { data: null, error: null };
        row.scan_count += 1;
        row.last_scanned_at = "2026-07-17T12:00:01.000Z";
        return { data: row.target_path, error: null };
      }

      return { data: null, error: { code: "42883", message: "unknown fixture RPC" } };
    }
  };

  function candidateParams(candidate) {
    return {
      p_id: candidate.id,
      p_restaurant_id: candidate.restaurantId,
      p_label: candidate.label ?? "QR dashboard restaurant",
      p_target_kind: candidate.targetKind ?? "admin",
      p_purpose_key: candidate.purposeKey ?? "default",
      p_target_path: candidate.targetPath ?? "/admin",
      p_token_hash: candidate.tokenHash,
      p_token_preview: candidate.tokenPreview,
      p_token_ciphertext: candidate.tokenCiphertext,
      p_token_nonce: candidate.tokenNonce,
      p_token_key_version: candidate.tokenKeyVersion,
      p_style_json: structuredClone(candidate.style ?? {}),
      p_redirect_url: candidate.redirectUrl
    };
  }

  function ownerResult(response) {
    if (response.error) {
      return {
        ok: false,
        error: response.error.message,
        code: response.error.code
      };
    }
    const row = response.data[0];
    return {
      ok: true,
      created: row.created,
      resultStatus: row.result_status,
      record: {
        id: row.id,
        restaurantId: row.restaurant_id,
        targetKind: row.target_kind,
        purposeKey: row.purpose_key,
        targetPath: row.target_path,
        status: row.status,
        isCanonical: row.is_canonical,
        fingerprint: row.token_hash,
        tokenPreview: row.token_preview,
        redirectUrl:
          row.result_status === "canonical"
            ? recoveredUrls.get(row.id) ?? ""
            : "",
        style: structuredClone(row.style_json)
      }
    };
  }

  return {
    client,
    calls,
    rows,
    seedQr,
    snapshotRows() {
      return structuredClone(rows);
    },
    readCanonical(slot) {
      calls.push({ method: "canonical-read" });
      const row = canonicalForSlot({
        p_restaurant_id: slot.restaurantId,
        p_target_kind: slot.targetKind,
        p_purpose_key: slot.purposeKey
      });
      if (!row) return { ok: true, record: null };
      return ownerResult({
        data: [canonicalRpcRow(row, false)],
        error: null
      });
    },
    async getOrCreateCanonical(candidate) {
      const response = await client.rpc(
        "owner_get_or_create_canonical_qr",
        candidateParams(candidate)
      );
      return ownerResult(response);
    },
    updateCanonicalStyle(id, style) {
      calls.push({
        method: "canonical-update",
        id,
        keys: ["style_json"]
      });
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return { ok: false, error: "canonical QR was not found" };
      row.style_json = structuredClone(style);
      row.updated_at = "2026-07-17T12:00:02.000Z";
      return ownerResult({
        data: [canonicalRpcRow(row, false)],
        error: null
      });
    },
    async rotateCanonical(previousId, candidate, confirm) {
      const response = await client.rpc("owner_rotate_canonical_qr", {
        p_previous_id: previousId,
        p_new_id: candidate.id,
        ...candidateParams(candidate),
        p_confirm: confirm
      });
      if (response.error) return ownerResult(response);
      return ownerResult({
        ...response,
        data: response.data.filter((row) => row.id === candidate.id)
      });
    },
    install() {
      process.env.VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION = "test-v1";
      process.env.VISTAIRE_QR_TOKEN_KEY_RING = JSON.stringify({
        "test-v1": Buffer.alloc(32, 7).toString("base64url")
      });
      globalThis.__OWNER_QR_TEST_ADMIN__ = { ok: true, client };
    },
    sanitizedRows() {
      return rows.map((row) => ({
        id: row.id,
        status: row.status,
        fingerprint: createHash("sha256")
          .update(row.token_hash, "utf8")
          .digest("hex")
          .slice(0, 12),
        tokenPreview: row.token_preview,
        count: row.scan_count,
        style: row.style_json
      }));
    },
    scanCount(id) {
      return rows.find((row) => row.id === id)?.scan_count ?? null;
    },
    rpcCallCount(name) {
      return calls.filter((call) => call.method === "rpc" && call.name === name).length;
    }
  };
}

function flattenText(value) {
  if (value === null || value === undefined || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join("");
  return flattenText(value.props?.children);
}

function findNode(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (typeof node.type === "function") {
    return findNode(node.type(node.props ?? {}), predicate);
  }
  if (predicate(node)) return node;
  const children = Array.isArray(node.props?.children)
    ? node.props.children
    : [node.props?.children];
  for (const child of children) {
    const match = findNode(child, predicate);
    if (match) return match;
  }
  return null;
}

export function createOwnerQrCustomizerHarness(options = {}) {
  const source = readFileSync(
    new URL("../../components/owner/OwnerQrCustomizer.tsx", import.meta.url),
    "utf8"
  );
  const compiled = ts.transpileModule(source, {
    fileName: "OwnerQrCustomizer.tsx",
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    }
  }).outputText;

  const states = [];
  const refs = [];
  const effects = [];
  let cursor = 0;
  let refCursor = 0;
  let effectCursor = 0;
  const react = {
    useCallback: (fn) => fn,
    useEffect(fn, dependencies) {
      const index = effectCursor++;
      const previous = effects[index];
      const changed =
        !previous ||
        !dependencies ||
        !previous.dependencies ||
        dependencies.length !== previous.dependencies.length ||
        dependencies.some(
          (dependency, dependencyIndex) =>
            !Object.is(dependency, previous.dependencies[dependencyIndex])
        );
      effects[index] = {
        callback: fn,
        cleanup: previous?.cleanup,
        dependencies,
        pending: changed || previous?.pending === true
      };
    },
    useMemo: (fn) => fn(),
    useRef(initial) {
      const index = refCursor++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) {
        states[index] = typeof initial === "function" ? initial() : initial;
      }
      return [
        states[index],
        (next) => {
          states[index] =
            typeof next === "function" ? next(states[index]) : next;
        }
      ];
    }
  };
  const jsxRuntime = {
    Fragment: Symbol("Fragment"),
    jsx: (type, props, key) => ({ type, props: props ?? {}, key }),
    jsxs: (type, props, key) => ({ type, props: props ?? {}, key })
  };
  const defaultStyle = {
    foregroundColor: "#111111",
    backgroundColor: "#ffffff",
    accentColor: "#c9a96e",
    logoMode: "none",
    logoText: "V",
    logoImageUrl: "",
    logoSizePercent: 18,
    padding: 2,
    errorCorrectionLevel: "H"
  };
  const styleModule = {
    DEFAULT_OWNER_QR_STYLE: defaultStyle,
    OWNER_QR_LOGO_MAX_PERCENT: 25,
    OWNER_QR_LOGO_MIN_PERCENT: 10,
    OWNER_QR_PADDING_MAX: 8,
    OWNER_QR_PADDING_MIN: 0,
    OWNER_QR_PRESETS: [],
    QR_MIN_SAFE_CONTRAST: 4.5,
    monogramFromName: () => "V",
    normalizeOwnerQrStyle: (value) => ({ ...defaultStyle, ...value }),
    qrContrastRatio: () => 10
  };
  const compiledModule = { exports: {} };
  const requests = [];
  const context = vm.createContext({
    Blob,
    Date,
    Image: class {},
    JSON,
    URL,
    URLSearchParams,
    console,
    exports: compiledModule.exports,
    fetch: async (url, init) => {
      const method = init?.method ?? "GET";
      requests.push({
        url,
        method,
        body: init?.body ? JSON.parse(init.body) : null
      });
      return {
        ok: true,
        async json() {
          if (method === "GET") {
            const record = options.canonicalRecord ?? null;
            return {
              ok: true,
              found: Boolean(record),
              recoverable: Boolean(record),
              record
            };
          }
          if (method === "PATCH") {
            return {
              ok: true,
              record: {
                id: "qr-observable-1",
                redirectUrl: "/q/opaque-fixture-token",
                targetPath: "/admin",
                targetKind: "admin",
                purposeKey: "default",
                persisted: true,
                recoverable: true,
                tokenPreview: "…token",
                style: {
                  ...defaultStyle,
                  foregroundColor: "#222222"
                }
              }
            };
          }
          return {
            ok: true,
            token: "opaque-fixture-token",
            redirectUrl: "/q/opaque-fixture-token",
            targetPath: "/admin",
            targetKind: "admin",
            persisted: true,
            record: {
              id: "qr-observable-1",
              redirectUrl: "/q/opaque-fixture-token",
              targetPath: "/admin",
              targetKind: "admin",
              purposeKey: "default",
              persisted: true,
              recoverable: true,
              tokenPreview: "…token",
              style: defaultStyle
            }
          };
        }
      };
    },
    module: compiledModule,
    navigator: { clipboard: { writeText: async () => {} } },
    require(specifier) {
      if (specifier === "react") return react;
      if (specifier === "react/jsx-runtime") return jsxRuntime;
      if (specifier.includes("OwnerCockpit.module.css")) {
        return new Proxy({}, { get: (_target, property) => String(property) });
      }
      if (specifier === "@/lib/owner/qrStyle") return styleModule;
      throw new Error(`Unexpected customizer dependency: ${specifier}`);
    },
    setTimeout,
    window: { location: { origin: "https://fixture.invalid" } }
  });
  vm.runInContext(compiled, context, { filename: "OwnerQrCustomizer.compiled.cjs" });
  const Component = compiledModule.exports.OwnerQrCustomizer;
  const props = {
    restaurantId: "restaurant-fixture",
    restaurantName: "Restaurant Fixture",
    restaurantSlug: "restaurant-fixture",
    targetKind: "admin",
    targetLabel: "QR dashboard restaurant",
    targetUsage: "le dashboard restaurant.",
    targetBadgeLabel: "Interne restaurant",
    targetPath: "/admin",
    targetDisplayUrl: "/admin"
  };

  function render() {
    cursor = 0;
    refCursor = 0;
    effectCursor = 0;
    return Component(props);
  }

  async function flushEffects() {
    render();
    for (const effect of effects) {
      if (!effect?.pending) continue;
      if (typeof effect.cleanup === "function") effect.cleanup();
      effect.pending = false;
      effect.cleanup = effect.callback();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    render();
  }

  return {
    requests,
    renderedText() {
      return flattenText(render());
    },
    async load() {
      await flushEffects();
    },
    async save() {
      const tree = render();
      const button = findNode(
        tree,
        (node) =>
          node.type === "button" &&
          /Sauvegarder|Sauvegarde|Chargement du QR/.test(flattenText(node))
      );
      if (!button) throw new Error("Save button was not rendered.");
      if (button.props.disabled) return false;
      await button.props.onClick();
      return true;
    },
    changeForeground(value) {
      const tree = render();
      const input = findNode(
        tree,
        (node) =>
          node.type === "input" && node.props?.["aria-label"] === "Premier plan"
      );
      if (!input) throw new Error("Foreground input was not rendered.");
      input.props.onChange({ target: { value } });
    }
  };
}
