import assert from "node:assert/strict";
import test from "node:test";
import { loadQrRenderer } from "./helpers/owner-qr-test-runtime.mjs";

const baseStyle = {
  foregroundColor: "#080706",
  backgroundColor: "#fff8ea",
  accentColor: "#e8cf9b",
  logoMode: "monogram",
  logoText: "S",
  logoSizePercent: 16,
  padding: 3,
  errorCorrectionLevel: "H"
};

function structuralSvg(svg) {
  return svg
    .replace(/data-qr-config-version="[^"]+"/g, "data-qr-config-version=VERSION")
    .replace(/#[0-9a-f]{3,8}/gi, "#COLOR");
}

test("owner QR renderer keeps the encoded payload geometry stable when style changes", async () => {
  const { renderOwnerQrSvg } = await loadQrRenderer();
  const url = "https://vistaire.ca/q/opaque-token";
  const before = await renderOwnerQrSvg({
    url,
    style: baseStyle,
    restaurantName: "Sauge Noire",
    targetKind: "menu",
    qrId: "qr-public-1",
    configVersion: 4,
    dimensions: 220,
    mode: "preview"
  });
  const after = await renderOwnerQrSvg({
    url,
    style: {
      ...baseStyle,
      foregroundColor: "#222222",
      accentColor: "#b7924e"
    },
    restaurantName: "Sauge Noire",
    targetKind: "menu",
    qrId: "qr-public-1",
    configVersion: 5,
    dimensions: 220,
    mode: "download"
  });

  assert.match(before, /data-qr-id="qr-public-1"/);
  assert.match(before, /data-qr-config-version="4"/);
  assert.match(after, /data-qr-config-version="5"/);
  assert.match(before, /#080706/i);
  assert.match(after, /#222222/i);
  assert.notEqual(before, after, "style and diagnostics must change the SVG");
  assert.equal(
    structuralSvg(before),
    structuralSvg(after),
    "the same URL must retain the same QR module geometry across style changes"
  );
});
