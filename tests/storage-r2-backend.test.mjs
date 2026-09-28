import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { storageBucket } from "../lib/storage/backend.ts";

async function fixture(t) {
  const requests = [];
  const objects = new Map();
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const key = new URL(req.url, "http://localhost").pathname;
    requests.push({ method: req.method, headers: req.headers, key, body });
    if (req.method === "PUT") {
      if (req.headers["if-none-match"] === "*" && objects.has(key)) {
        res.writeHead(412, { "Content-Type": "application/xml" });
        res.end("<Error><Code>PreconditionFailed</Code><Message>exists</Message></Error>");
      } else {
        objects.set(key, body);
        res.end();
      }
    } else if (req.method === "POST") {
      res.setHeader("Content-Type", "application/xml");
      res.end("<DeleteResult><Error><Key>dish</Key><Code>AccessDenied</Code><Message>denied</Message></Error></DeleteResult>");
    } else {
      res.writeHead(404, { "Content-Type": "application/xml" });
      res.end("<Error><Code>NoSuchKey</Code></Error>");
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const env = {
    R2_STORAGE_ENABLED: "true", R2_S3_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
    R2_S3_ACCESS_KEY_ID: "fixture-key", R2_S3_SECRET_ACCESS_KEY: "fixture-secret"
  };
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  t.after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    const closed = once(server, "close");
    server.closeAllConnections();
    server.close();
    await closed;
  });
  return { requests, objects, bucket: storageBucket({}, "vistaire-media") };
}

test("R2 uploads preserve bytes/cache policy and signed uploads cannot replace a published object", async (t) => {
  const { bucket, requests, objects } = await fixture(t);
  assert.equal((await bucket.upload("dish", new Blob(["original"]), { cacheControl: "3600" })).error, null);
  assert.equal(requests[0].headers["cache-control"], "max-age=3600");
  assert.equal(requests[0].body.toString(), "original");
  assert.equal((await bucket.upload("dish", Buffer.from("replacement"))).error.statusCode, 412);
  assert.equal((await bucket.upload("dish", Buffer.from("new"), { upsert: true, cacheControl: "0" })).error, null);
  assert.equal(requests.at(-1).headers["cache-control"], "max-age=0");
  assert.equal((await bucket.upload("explicit", Buffer.from("x"), { cacheControl: "public, max-age=60" })).error, null);
  assert.equal(requests.at(-1).headers["cache-control"], "public, max-age=60");

  const signed = await bucket.createSignedUploadUrl("runtime.usdz");
  assert.equal(signed.error, null);
  const url = new URL(signed.data.signedUrl);
  assert.ok(url.searchParams.get("X-Amz-SignedHeaders").split(";").includes("if-none-match"));
  assert.ok(![...url.searchParams.keys()].some((key) => /checksum/i.test(key)), "unknown upload bytes must not be signed as an empty payload");

  // Exercise the worker helper without starting its CLI server.
  const source = readFileSync("scripts/owner/usdz-local-worker.mjs", "utf8");
  const helper = source.slice(source.indexOf("async function uploadSigned("), source.indexOf("function absoluteApiUrl("));
  const uploadSigned = new Function("fetch", "URL", helper + "\nreturn uploadSigned;")(fetch, URL);
  await uploadSigned(signed.data, Buffer.from("runtime-bytes"), "model/vnd.usdz+zip");
  assert.equal(requests.at(-1).headers["if-none-match"], "*");
  await assert.rejects(uploadSigned(signed.data, Buffer.from("corrupt"), "model/vnd.usdz+zip"), /412/);
  assert.equal(objects.get("/vistaire-media/runtime.usdz").toString(), "runtime-bytes");
});

test("R2 reports partial delete failures and missing objects while preserving Supabase routing", async (t) => {
  const { bucket } = await fixture(t);
  const removed = await bucket.remove(["dish"]);
  assert.equal(removed.data, null);
  assert.match(removed.error.message, /AccessDenied/);
  assert.equal((await bucket.info("missing")).error.statusCode, 404);
  const original = {};
  const supabase = { from: () => original };
  assert.equal(storageBucket(supabase, "vistaire-3d-qa"), original);
  process.env.R2_STORAGE_ENABLED = "false";
  assert.equal(storageBucket(supabase, "vistaire-media"), original);
  process.env.R2_STORAGE_ENABLED = "true";
  delete process.env.R2_S3_SECRET_ACCESS_KEY;
  assert.equal((await bucket.upload("dish", Buffer.from("x"))).error.statusCode, 503);
});
