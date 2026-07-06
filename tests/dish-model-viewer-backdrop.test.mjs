import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const viewerPath = "components/dish/DishModelViewer.tsx";
const maisonElyseDetailPath = "components/menu/MaisonElyseDishDetail.tsx";

test("model viewer backdrop renders dynamic dish photo routes without Next image optimization", async () => {
  const source = await readFile(viewerPath, "utf8");

  assert.match(source, /function isDynamicPublicDishPhoto\(src: string\): boolean/);
  assert.match(source, /function DishBackdropImage\(/);
  assert.match(source, /isDynamicPublicDishPhoto\(src\)/);
  assert.match(source, /<img[\s\S]*src=\{src\}/);
  assert.doesNotMatch(
    source,
    /function PremiumDishBackdrop[\s\S]*<Image[\s\S]*src=\{dish\.image\}/
  );
});

test("model viewer backdrop hides failed images so the premium fallback remains visible", async () => {
  const source = await readFile(viewerPath, "utf8");

  assert.match(source, /const \[imageFailed, setImageFailed\] = useState\(false\)/);
  assert.match(source, /key=\{dish\.image\}/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{/);
  assert.match(source, /node\.complete && node\.naturalWidth === 0/);
  assert.match(source, /onError=\{\(\) => setImageFailed\(true\)\}/);
  assert.match(source, /if \(imageFailed\) return null/);
  assert.match(source, /bg-gradient-to-br from-\[#2a1f18\] via-\[#16100c\] to-\[#080706\]/);
});

test("Maison Elyse dish detail passes the public dish imageUrl into the model viewer", async () => {
  const source = await readFile(maisonElyseDetailPath, "utf8");

  assert.match(
    source,
    /function modelViewerDishFromPublicDish\([\s\S]*image:\s*dish\.imageUrl/
  );
});
