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
        url: pathToFileURL(requireDependency.resolve(specifier)).href,
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
  let sequence = 0;
  const uniqueConstraints = [["token_hash"]];

  function seedQr({ token, ...row }) {
    const seeded = {
      id: row.id ?? `qr-seed-${++sequence}`,
      restaurant_id: row.restaurant_id ?? "restaurant-fixture",
      label: row.label ?? "QR fixture",
      token_hash: storedHash(token),
      token_preview: preview(token),
      target_kind: row.target_kind,
      target_path: row.target_path ?? "/admin",
      style_json: row.style_json ?? {},
      status: row.status ?? "active",
      scan_count: row.scan_count ?? 0,
      last_scanned_at: row.last_scanned_at ?? null,
      created_at: row.created_at ?? "2026-07-17T12:00:00.000Z",
      updated_at: row.updated_at ?? "2026-07-17T12:00:00.000Z"
    };
    if (row.omit_target_kind) delete seeded.target_kind;
    rows.push(seeded);
    return seeded.id;
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
        return { data: null, error: null };
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

  return {
    client,
    calls,
    rows,
    seedQr,
    install() {
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

export function createOwnerQrCustomizerHarness() {
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
  let cursor = 0;
  const react = {
    useCallback: (fn) => fn,
    useEffect: () => {},
    useMemo: (fn) => fn(),
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
    qrContrastRatio: () => 10
  };
  const module = { exports: {} };
  const requests = [];
  const context = vm.createContext({
    Blob,
    Date,
    Image: class {},
    JSON,
    URL,
    console,
    exports: module.exports,
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
          if (method === "PATCH") {
            return {
              ok: true,
              record: {
                id: "qr-observable-1",
                redirectUrl: "",
                targetPath: "/admin",
                targetKind: "admin"
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
              targetKind: "admin"
            }
          };
        }
      };
    },
    module,
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
  const Component = module.exports.OwnerQrCustomizer;
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
    return Component(props);
  }

  return {
    requests,
    renderedText() {
      return flattenText(render());
    },
    async save() {
      const tree = render();
      const button = findNode(
        tree,
        (node) =>
          node.type === "button" &&
          /Sauvegarder|Sauvegarde/.test(flattenText(node))
      );
      if (!button) throw new Error("Save button was not rendered.");
      await button.props.onClick();
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
