import test from "node:test";
import assert from "node:assert/strict";

const loadResolutionCore = () => import("../lib/owner/qrResolutionCore.ts");

test("persisted menu QR resolution allows a missing restaurant id", async () => {
  const { resolveQrRowMetadata } = await loadResolutionCore();
  assert.deepEqual(
    resolveQrRowMetadata({
      qrId: "qr-menu",
      restaurantId: "",
      status: "active",
      targetKind: "menu",
      targetPath: "/menu/maison"
    }),
    {
      ok: true,
      qrId: "qr-menu",
      restaurantId: "",
      targetKind: "menu",
      targetPath: "/menu/maison"
    }
  );
});

test("persisted admin QR resolution requires a restaurant id", async () => {
  const { resolveQrRowMetadata } = await loadResolutionCore();
  assert.deepEqual(
    resolveQrRowMetadata({
      qrId: "qr-admin",
      restaurantId: "",
      status: "active",
      targetKind: "admin",
      targetPath: "/admin"
    }),
    { ok: false }
  );
});

test("signed menu fallback resolution allows a missing restaurant id", async () => {
  const { resolveSignedMenuFallback } = await loadResolutionCore();
  assert.deepEqual(
    resolveSignedMenuFallback({ restaurantId: "", targetPath: "/menu/maison" }),
    {
      ok: true,
      qrId: "signed-menu-fallback",
      restaurantId: "",
      targetKind: "menu",
      targetPath: "/menu/maison"
    }
  );
});
