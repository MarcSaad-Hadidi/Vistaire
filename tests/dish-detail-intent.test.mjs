import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("components/dish/DishDetail.tsx", "utf8");
const modelViewerSource = readFileSync(
  "components/dish/DishModelViewer.tsx",
  "utf8"
);

test("legacy dish detail does not prefetch Quick Look USDZ from a mount effect", () => {
  assert.doesNotMatch(
    source,
    /useEffect\(\(\)\s*=>\s*\{[\s\S]*return\s+prefetchUsdzForQuickLook\(/m
  );
});

test("legacy dish detail prepares Quick Look only from explicit 3D intent", () => {
  assert.match(source, /handleVoir3dClick[\s\S]*prefetchUsdzForQuickLook\(/m);
});

test("model viewer keeps iOS Quick Look fallback available when 3D fails", () => {
  assert.match(
    modelViewerSource,
    /const canOpenDirectIosQuickLook =\s*iosNativeArEnabled && Boolean\(directIosQuickLookHref\);/
  );
  assert.match(
    modelViewerSource,
    /const showIosQuickLookButton = showArReady && canOpenDirectIosQuickLook;/
  );
  assert.match(
    modelViewerSource,
    /quickLookHref=\{\s*canOpenDirectIosQuickLook \? directIosQuickLookHref : undefined\s*\}/
  );
  assert.match(
    modelViewerSource,
    /onQuickLookClick=\{\s*canOpenDirectIosQuickLook \? trackArIntent : undefined\s*\}/
  );
});

test("model viewer shows a 3D size disclaimer inside the loaded viewer path", () => {
  assert.match(modelViewerSource, /sizeDisclaimer: string;/);
  assert.match(
    modelViewerSource,
    /Visuel indicatif : la taille affichée en 3D peut différer de la taille réelle du plat/
  );
  assert.match(
    modelViewerSource,
    /<p className="mt-2 px-1 text-center text-\[0\.72rem\][\s\S]*\{copy\.sizeDisclaimer\}/
  );
});

test("model viewer loading copy fills the full frame instead of clipping at mobile height", () => {
  assert.match(
    modelViewerSource,
    /className="pointer-events-none absolute inset-0 z-20 isolate flex flex-col justify-end overflow-hidden rounded-xl/
  );
  assert.doesNotMatch(
    modelViewerSource,
    /absolute inset-0 z-20 isolate flex \$\{MODEL_FRAME_CLASS\}/
  );
});
