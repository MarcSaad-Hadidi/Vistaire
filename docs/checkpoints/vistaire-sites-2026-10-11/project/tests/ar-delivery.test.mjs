import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

test("Quick Look receives the original USDZ bytes and native MIME", async () => {
  const bytes = new Uint8Array([80, 75, 3, 4, 0, 255]);
  const response = await worker.fetch(
    new Request("https://example.test/assets/ar/burger.usdz"),
    {
      ASSETS: {
        fetch: async () =>
          new Response(bytes, {
            headers: {
              "content-type": "application/octet-stream",
              etag: "source-hash",
              "content-length": String(bytes.length),
              "cache-control": "public, max-age=0",
            },
          }),
      },
    },
  );
  assert.equal(response.headers.get("content-type"), "model/vnd.usdz+zip");
  assert.equal(response.headers.get("etag"), "source-hash");
  assert.equal(response.headers.get("content-length"), String(bytes.length));
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("range and HEAD responses retain their status and metadata", async () => {
  for (const method of ["GET", "HEAD"]) {
    const response = await worker.fetch(
      new Request("https://example.test/assets/ar/homard.usdz", { method }),
      {
        ASSETS: {
          fetch: async () =>
            new Response(method === "HEAD" ? null : "PK", {
              status: 206,
              headers: {
                "content-range": "bytes 0-1/7569119",
                "accept-ranges": "bytes",
                "content-length": "2",
              },
            }),
        },
      },
    );
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-type"), "model/vnd.usdz+zip");
    assert.equal(response.headers.get("content-range"), "bytes 0-1/7569119");
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    if (method === "HEAD") assert.equal(await response.text(), "");
  }
});

test("missing USDZ and unrelated assets keep their existing response type", async () => {
  for (const [path, status] of [
    ["/assets/ar/missing.usdz", 404],
    ["/assets/data.json", 200],
  ]) {
    const response = await worker.fetch(
      new Request(`https://example.test${path}`),
      {
        ASSETS: {
          fetch: async () =>
            new Response("{}", {
              status,
              headers: { "content-type": "application/json" },
            }),
        },
      },
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get("content-type"), "application/json");
  }
});
