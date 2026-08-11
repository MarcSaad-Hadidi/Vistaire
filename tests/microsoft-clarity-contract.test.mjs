import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL(
  "../components/analytics/MicrosoftClarity.tsx",
  import.meta.url
);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);
const lockfilePath = new URL("../package-lock.json", import.meta.url);

async function readSource(path) {
  return readFile(path, "utf8").catch(() => "");
}

test("Microsoft Clarity uses the expected project and non-blocking Next.js script", async () => {
  const component = await readSource(componentPath);

  assert.match(component, /import Script from ["']next\/script["']/);
  assert.match(component, /CLARITY_PROJECT_ID\s*=\s*["']y0gra96318["']/);
  assert.match(component, /id=["']microsoft-clarity["']/);
  assert.match(component, /strategy=["']afterInteractive["']/);
  assert.match(component, /https:\/\/www\.clarity\.ms\/tag\//);
  assert.doesNotMatch(component, /beforeInteractive/);
});

test("Microsoft Clarity is enabled only for Vercel production", async () => {
  const component = await readSource(componentPath);

  assert.match(
    component,
    /if\s*\(process\.env\.VERCEL_ENV\s*!==\s*["']production["']\)\s*\{\s*return null;\s*\}/
  );
  assert.doesNotMatch(component, /NODE_ENV/);
});

test("the root layout loads Microsoft Clarity exactly once", async () => {
  const [component, layout] = await Promise.all([
    readSource(componentPath),
    readSource(layoutPath)
  ]);

  assert.equal(layout.match(/<MicrosoftClarity\s*\/>/g)?.length ?? 0, 1);
  assert.equal(component.match(/id=["']microsoft-clarity["']/g)?.length ?? 0, 1);
});

test("Microsoft Clarity requires no additional package", async () => {
  const [packageJson, lockfile] = await Promise.all([
    readFile(packagePath, "utf8").then(JSON.parse),
    readFile(lockfilePath, "utf8").then(JSON.parse)
  ]);
  const declaredPackages = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  assert.equal(Object.keys(declaredPackages).some((name) => /clarity/i.test(name)), false);
  assert.equal(Object.keys(lockfile.packages).some((name) => /clarity/i.test(name)), false);
});
