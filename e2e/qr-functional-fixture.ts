import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";

type QrRow = {
  id: string;
  restaurant_id: string;
  label: string;
  target_kind: "menu" | "admin";
  purpose_key: string;
  is_canonical: boolean;
  token_hash: string;
  token_preview: string;
  token_ciphertext: string;
  token_nonce: string;
  token_key_version: string;
  target_path: string;
  status: "active" | "paused" | "archived";
  scan_count: number;
  last_scanned_at: string | null;
  style_json: Record<string, unknown>;
  supersedes_qr_code_id: string | null;
  rotated_at: string | null;
  created_at: string;
  updated_at: string;
};

type SafeQrSnapshot = {
  id: string;
  fingerprint: string;
  isCanonical: boolean;
  recoverable: boolean;
  restaurantId: string;
  status: QrRow["status"];
  targetKind: QrRow["target_kind"];
  style: Record<string, unknown>;
};

const RESTAURANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_RESTAURANT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MENU_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FIXTURE_HOST = "127.0.0.1";
const SUPABASE_PORT = 55433;
const APP_PORT = 3301;
const SUPABASE_ORIGIN = `http://${FIXTURE_HOST}:${SUPABASE_PORT}`;
export const QR_FUNCTIONAL_APP_ORIGIN = `http://localhost:${APP_PORT}`;

function json(
  response: import("node:http").ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(payload)),
    ...headers
  });
  response.end(payload);
}

async function readJson(request: import("node:http").IncomingMessage) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body ? (JSON.parse(body) as Record<string, unknown>) : {};
}

function eq(url: URL, key: string): string | null {
  const value = url.searchParams.get(key);
  return value?.startsWith("eq.") ? value.slice(3) : null;
}

function wantsObject(request: import("node:http").IncomingMessage): boolean {
  return String(request.headers.accept ?? "").includes(
    "application/vnd.pgrst.object+json"
  );
}

class LocalQrSupabase {
  postRequests = 0;
  patchRequests = 0;
  rotateRequests = 0;
  createdRecords = 0;
  createDelayMs = 0;
  liveQrReadMatches = 0;
  liveQrReads = 0;
  readonly postResultIds: string[] = [];

  private server: Server | null = null;
  private readonly rows: QrRow[] = [];
  private readonly scopedAdminTables = new Set<string>();

  async start() {
    if (this.server) return;
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch(() => {
        if (!response.headersSent) json(response, 500, { code: "fixture_failure" });
        else response.end();
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(SUPABASE_PORT, FIXTURE_HOST, resolve);
    });
  }

  async stop() {
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  reset() {
    this.rows.length = 0;
    this.postRequests = 0;
    this.patchRequests = 0;
    this.rotateRequests = 0;
    this.createdRecords = 0;
    this.createDelayMs = 0;
    this.liveQrReadMatches = 0;
    this.liveQrReads = 0;
    this.postResultIds.length = 0;
    this.scopedAdminTables.clear();
  }

  snapshot(): SafeQrSnapshot[] {
    return this.rows.map((row) => ({
      id: row.id,
      fingerprint: createHash("sha256")
        .update(row.token_hash)
        .digest("hex")
        .slice(0, 12),
      isCanonical: row.is_canonical,
      recoverable: Boolean(
        row.token_ciphertext && row.token_nonce && row.token_key_version
      ),
      restaurantId: row.restaurant_id,
      status: row.status,
      targetKind: row.target_kind,
      style: { ...row.style_json }
    }));
  }

  adminScopeVerified(): boolean {
    return [
      "restaurants",
      "menus",
      "menu_categories",
      "menu_dishes",
      "analytics_events"
    ].every((table) => this.scopedAdminTables.has(table));
  }

  private filteredRows(url: URL): QrRow[] {
    return this.rows.filter((row) => {
      const filters: Array<[keyof QrRow, string | null]> = [
        ["id", eq(url, "id")],
        ["restaurant_id", eq(url, "restaurant_id")],
        ["target_kind", eq(url, "target_kind")],
        ["purpose_key", eq(url, "purpose_key")],
        ["is_canonical", eq(url, "is_canonical")]
      ];
      return filters.every(([key, value]) => {
        if (value === null) return true;
        return String(row[key]) === value;
      });
    });
  }

  private async handle(
    request: import("node:http").IncomingMessage,
    response: import("node:http").ServerResponse
  ) {
    const url = new URL(request.url ?? "/", SUPABASE_ORIGIN);
    const method = request.method ?? "GET";

    if (method === "GET" && url.pathname === "/fixture/health") {
      return json(response, 200, { ok: true });
    }
    if (method === "GET" && url.pathname === "/rest/v1/restaurants") {
      const rows = [
        {
          id: RESTAURANT_ID,
          name: "Restaurant Fixture QR",
          slug: "restaurant-fixture-qr",
          status: "active",
          city: "Montreal",
          cuisine_type: "Fixture",
          menu_url: "/menu/restaurant-fixture-qr"
        },
        {
          id: OTHER_RESTAURANT_ID,
          name: "Restaurant Hors Scope",
          slug: "restaurant-hors-scope",
          status: "active",
          city: "Quebec",
          cuisine_type: "Fixture",
          menu_url: "/menu/restaurant-hors-scope"
        }
      ];
      const id = eq(url, "id");
      if (id === RESTAURANT_ID) this.scopedAdminTables.add("restaurants");
      return json(response, 200, id ? rows.filter((row) => row.id === id) : rows);
    }
    if (method === "GET" && url.pathname === "/rest/v1/menus") {
      const restaurantId = eq(url, "restaurant_id");
      if (restaurantId === RESTAURANT_ID) this.scopedAdminTables.add("menus");
      return json(
        response,
        200,
        restaurantId === RESTAURANT_ID
          ? [
              {
                id: MENU_ID,
                restaurant_id: RESTAURANT_ID,
                status: "published",
                is_primary: true,
                updated_at: "2026-07-18T12:00:00.000Z"
              }
            ]
          : []
      );
    }
    if (method === "GET" && url.pathname === "/rest/v1/menu_categories") {
      const restaurantId = eq(url, "restaurant_id");
      if (restaurantId === RESTAURANT_ID) {
        this.scopedAdminTables.add("menu_categories");
      }
      return json(
        response,
        200,
        restaurantId === RESTAURANT_ID
          ? [
              {
                id: "category-fixture",
                restaurant_id: RESTAURANT_ID,
                menu_id: MENU_ID,
                name: "Carte fixture",
                slug: "carte-fixture",
                display_order: 1
              }
            ]
          : []
      );
    }
    if (method === "GET" && url.pathname === "/rest/v1/menu_dishes") {
      const restaurantId = eq(url, "restaurant_id");
      if (restaurantId === RESTAURANT_ID) this.scopedAdminTables.add("menu_dishes");
      return json(response, 200, []);
    }
    if (method === "GET" && url.pathname === "/rest/v1/analytics_events") {
      const restaurantId = eq(url, "restaurant_id");
      if (restaurantId === RESTAURANT_ID) {
        this.scopedAdminTables.add("analytics_events");
      }
      return json(response, 200, []);
    }
    if (method === "GET" && url.pathname === "/rest/v1/qr_codes") {
      const rows = this.filteredRows(url);
      if (eq(url, "id")) {
        this.liveQrReads += 1;
        if (rows.length === 1) this.liveQrReadMatches += 1;
      }
      if (wantsObject(request)) {
        return rows[0]
          ? json(response, 200, rows[0])
          : json(response, 406, {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned"
            });
      }
      return json(response, 200, rows);
    }
    if (method === "PATCH" && url.pathname === "/rest/v1/qr_codes") {
      this.patchRequests += 1;
      const patch = await readJson(request);
      const rows = this.filteredRows(url);
      for (const row of rows) {
        if (patch.style_json && typeof patch.style_json === "object") {
          row.style_json = { ...(patch.style_json as Record<string, unknown>) };
        }
        if (typeof patch.label === "string") row.label = patch.label;
        row.updated_at = new Date().toISOString();
      }
      const result = rows[0] ?? null;
      return wantsObject(request)
        ? json(response, result ? 200 : 406, result ?? { code: "PGRST116" })
        : json(response, 200, rows);
    }
    if (
      method === "POST" &&
      url.pathname === "/rest/v1/rpc/owner_get_or_create_canonical_qr"
    ) {
      this.postRequests += 1;
      const body = await readJson(request);
      if (this.createDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, this.createDelayMs));
      }
      const restaurantId = String(body.p_restaurant_id ?? "");
      const targetKind = String(body.p_target_kind ?? "") as "menu" | "admin";
      const purposeKey = String(body.p_purpose_key ?? "default");
      let row = this.rows.find(
        (candidate) =>
          candidate.restaurant_id === restaurantId &&
          candidate.target_kind === targetKind &&
          candidate.purpose_key === purposeKey &&
          candidate.is_canonical
      );
      const created = !row;
      if (!row) {
        row = this.rowFromRpc(body);
        this.rows.push(row);
        this.createdRecords += 1;
      }
      this.postResultIds.push(row.id);
      return json(response, 200, [{ ...row, created }]);
    }
    if (
      method === "POST" &&
      url.pathname === "/rest/v1/rpc/resolve_qr_code_scan_metadata"
    ) {
      const body = await readJson(request);
      const row = this.rows.find(
        (candidate) =>
          candidate.token_hash === body.p_token_hash &&
          candidate.status === "active"
      );
      if (!row) return json(response, 200, []);
      row.scan_count += 1;
      row.last_scanned_at = new Date().toISOString();
      return json(response, 200, [
        {
          qr_id: row.id,
          restaurant_id: row.restaurant_id,
          target_kind: row.target_kind,
          target_path: row.target_path,
          status: row.status
        }
      ]);
    }
    if (
      method === "POST" &&
      url.pathname === "/rest/v1/rpc/owner_rotate_canonical_qr"
    ) {
      this.rotateRequests += 1;
      const body = await readJson(request);
      const previous = this.rows.find(
        (row) => row.id === body.p_previous_id && row.is_canonical
      );
      if (!previous) return json(response, 200, []);
      previous.is_canonical = false;
      previous.rotated_at = new Date().toISOString();
      const current = this.rowFromRpc(body, {
        idKey: "p_new_id",
        supersedesId: previous.id
      });
      this.rows.push(current);
      return json(response, 200, [previous, current]);
    }
    return json(response, 404, { code: "fixture_not_found" });
  }

  private rowFromRpc(
    body: Record<string, unknown>,
    options: { idKey?: string; supersedesId?: string } = {}
  ): QrRow {
    const now = new Date().toISOString();
    return {
      id: String(body[options.idKey ?? "p_id"] ?? ""),
      restaurant_id: String(body.p_restaurant_id ?? ""),
      label: String(body.p_label ?? "QR fixture"),
      target_kind: String(body.p_target_kind ?? "menu") as "menu" | "admin",
      purpose_key: String(body.p_purpose_key ?? "default"),
      is_canonical: true,
      token_hash: String(body.p_token_hash ?? ""),
      token_preview: String(body.p_token_preview ?? ""),
      token_ciphertext: String(body.p_token_ciphertext ?? ""),
      token_nonce: String(body.p_token_nonce ?? ""),
      token_key_version: String(body.p_token_key_version ?? ""),
      target_path: String(body.p_target_path ?? ""),
      status: "active",
      scan_count: 0,
      last_scanned_at: null,
      style_json:
        body.p_style_json && typeof body.p_style_json === "object"
          ? { ...(body.p_style_json as Record<string, unknown>) }
          : {},
      supersedes_qr_code_id: options.supersedesId ?? null,
      rotated_at: null,
      created_at: now,
      updated_at: now
    };
  }
}

async function waitForUrl(url: string, child?: ChildProcess, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`Dedicated Next fixture exited with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error("Fixture did not become ready.");
}

export async function startQrFunctionalEnvironment() {
  const fixture = new LocalQrSupabase();
  await fixture.start();

  const keyRing = JSON.stringify({
    "fixture-v1": Buffer.alloc(32, 7).toString("base64url")
  });
  const next = spawn(
    process.execPath,
    [
      "./node_modules/next/dist/bin/next",
      "start",
      "-H",
      FIXTURE_HOST,
      "-p",
      String(APP_PORT)
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_ORIGIN,
        SUPABASE_SERVICE_ROLE_KEY: "qr-functional-local-service-role",
        VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "",
        VISTAIRE_OWNER_E2E_AUTH_BYPASS: "1",
        VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN: "qr-functional-owner-bypass",
        VISTAIRE_OWNER_E2E_EMAIL: "qr-functional@localhost",
        VISTAIRE_ADMIN_SESSION_SECRET:
          "qr-functional-admin-session-secret-at-least-32-bytes",
        VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION: "fixture-v1",
        VISTAIRE_QR_TOKEN_KEY_RING: keyRing
      }
    }
  );
  let stderr = "";
  next.stderr?.on("data", (chunk) => {
    stderr = `${stderr}${String(chunk)}`.slice(-2_000);
  });

  try {
    await waitForUrl(`${SUPABASE_ORIGIN}/fixture/health`);
    await waitForUrl(QR_FUNCTIONAL_APP_ORIGIN, next);
  } catch (error) {
    next.kill();
    await fixture.stop();
    throw new Error(
      `Dedicated QR environment failed to start: ${
        error instanceof Error ? error.message : String(error)
      }. ${stderr.replace(/\s+/g, " ").trim()}`
    );
  }

  return {
    fixture,
    async stop() {
      if (!next.killed) next.kill();
      await fixture.stop();
    }
  };
}
