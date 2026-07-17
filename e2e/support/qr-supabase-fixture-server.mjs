import { createHash } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.VISTAIRE_QR_FIXTURE_PORT ?? 55432);
export const ACTIVE_ADMIN_TOKEN = "admin_fixture_token-1234567890ab";
export const INACTIVE_ADMIN_TOKEN = "archived_fixture_token-12345678";

function storageHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

const rows = new Map([
  [storageHash(ACTIVE_ADMIN_TOKEN), {
    id: "11111111-1111-4111-8111-111111111111",
    restaurant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    target_kind: "admin",
    target_path: "/admin",
    status: "active"
  }],
  [storageHash(INACTIVE_ADMIN_TOKEN), {
    id: "22222222-2222-4222-8222-222222222222",
    restaurant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    target_kind: "admin",
    target_path: "/admin",
    status: "archived"
  }]
]);
const scanCounts = new Map([...rows.keys()].map((hash) => [hash, 0]));

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  response.end(payload);
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/fixture/state") {
    return json(response, 200, Object.fromEntries(scanCounts));
  }
  if (url.pathname === "/rest/v1/rpc/resolve_qr_code_scan_metadata") {
    return json(response, 404, {
      code: "PGRST202",
      message:
        "Could not find the function public.resolve_qr_code_scan_metadata(p_token_hash) in the schema cache"
    });
  }
  if (request.method === "GET" && url.pathname === "/rest/v1/qr_codes") {
    const filter = url.searchParams.get("token_hash") ?? "";
    const hash = filter.startsWith("eq.") ? filter.slice(3) : "";
    const row = rows.get(hash);
    return json(response, 200, row ? [row] : []);
  }
  if (url.pathname === "/rest/v1/rpc/resolve_qr_code_scan") {
    const { p_token_hash: hash } = await readJson(request);
    const row = rows.get(hash);
    if (!row || row.status !== "active") return json(response, 200, null);
    scanCounts.set(hash, (scanCounts.get(hash) ?? 0) + 1);
    return json(response, 200, row.target_path);
  }
  return json(response, 404, { code: "fixture_not_found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[Vistaire QR fixture] listening on ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
