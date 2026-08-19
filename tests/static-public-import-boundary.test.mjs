import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

import {
  STATIC_PUBLIC_ENTRY_FILES,
  STATIC_PUBLIC_NAMED_PAGE_ENTRIES,
  inspectStaticPublicImportBoundary
} from "../scripts/ci/check-static-public-import-boundary.mjs";

async function makeGraph(t) {
  const root = await mkdtemp(join(tmpdir(), "vistaire-static-imports-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function moduleFile(root, relativePath, source) {
  const target = join(root, ...relativePath.split("/"));
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, source);
}

test("relative, alias, index and literal dynamic imports are all traversed", async (t) => {
  const root = await makeGraph(t);
  await moduleFile(
    root,
    "entry.tsx",
    [
      'import "./relative";',
      'import "@/alias";',
      'import "./folder";',
      'void import("./lazy");'
    ].join("\n")
  );
  await moduleFile(root, "relative.ts", 'import { headers } from "next/headers";');
  await moduleFile(root, "alias.tsx", 'import { cookies } from "next/cookies";');
  await moduleFile(
    root,
    "folder/index.ts",
    'import { auth } from "@clerk/nextjs/server";'
  );
  await moduleFile(
    root,
    "lazy.ts",
    "export async function load(storage) { return storage.createSignedUrl('private'); }"
  );

  const findings = await inspectStaticPublicImportBoundary(["entry.tsx"], {
    root
  });
  for (const [file, rule] of [
    ["relative.ts", "forbidden-package"],
    ["alias.tsx", "forbidden-package"],
    ["index.ts", "forbidden-package"],
    ["lazy.ts", "signed-url-capability"]
  ]) {
    assert.ok(
      findings.some(
        (finding) => basename(finding.file) === file && finding.rule === rule
      ),
      `${file} must prove ${rule}`
    );
  }
});

test("Google font loaders are rejected from static public import graphs", async (t) => {
  const root = await makeGraph(t);
  await moduleFile(root, "entry.ts", 'import "./typography";');
  await moduleFile(
    root,
    "typography.ts",
    'import { Inter } from "next/font/google"; export const font = Inter;'
  );

  const findings = await inspectStaticPublicImportBoundary(["entry.ts"], {
    root
  });

  assert.ok(
    findings.some(
      (finding) =>
        finding.file === "typography.ts" &&
        finding.rule === "forbidden-package" &&
        finding.detail === "next/font/google"
    ),
    "the static graph must reject the build-time Google font loader"
  );
});

test("private server paths and non-public environment reads fail closed", async (t) => {
  const root = await makeGraph(t);
  const privateModules = [
    "utils/supabase/admin.ts",
    "utils/supabase/server.ts",
    "lib/admin/private.ts",
    "lib/owner/private.ts",
    "app/(fr)/admin/private.ts",
    "app/(fr)/owner/private.ts",
    "app/api/private.ts"
  ];
  await moduleFile(
    root,
    "entry.ts",
    [
      ...privateModules.map((path, index) =>
        `import private${index} from "@/${path.replace(/\.ts$/, "")}";`
      ),
      'import "./secret";',
      "void [" + privateModules.map((_, index) => `private${index}`).join(",") + "];"
    ].join("\n")
  );
  for (const path of privateModules) {
    await moduleFile(root, path, "export default {};\n");
  }
  await moduleFile(
    root,
    "secret.ts",
    [
      "export const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL;",
      "export const privateSecret = process.env.INTERNAL_SECRET;"
    ].join("\n")
  );

  const findings = await inspectStaticPublicImportBoundary(["entry.ts"], {
    root
  });
  for (const path of privateModules) {
    assert.ok(
      findings.some(
        (finding) =>
          finding.rule === "forbidden-path" &&
          finding.detail.includes(path.replace(/\.ts$/, ""))
      ),
      path
    );
  }
  assert.ok(
    findings.some(
      (finding) =>
        finding.rule === "non-public-environment" &&
        finding.detail === "INTERNAL_SECRET"
    )
  );
  assert.equal(
    findings.some((finding) => finding.detail === "NEXT_PUBLIC_SITE_URL"),
    false
  );
});

test("the landing loader is traversed behind one exact external-data facade", async (t) => {
  const root = await makeGraph(t);
  for (const entry of ["app/(fr)/page.tsx", "app/(fr)/contact/page.tsx"]) {
    await moduleFile(
      root,
      entry,
      'import { VistairePreviewLanding } from "@/components/vistaire-preview/VistairePreviewLanding"; void VistairePreviewLanding;'
    );
  }
  await moduleFile(
    root,
    "components/vistaire-preview/VistairePreviewLanding.tsx",
    'import { VistaireLanding } from "@/components/landing/VistaireLanding"; export const VistairePreviewLanding = VistaireLanding;'
  );
  await moduleFile(
    root,
    "components/landing/VistaireLanding.tsx",
    'import { getLandingExperiences } from "@/lib/landing/menuExperiences"; export const VistaireLanding = getLandingExperiences;'
  );
  await moduleFile(
    root,
    "lib/landing/menuExperiences.ts",
    'import { resolveLandingPublicMenuRenderContext } from "@/lib/landing/publicLandingMenuData"; export const getLandingExperiences = resolveLandingPublicMenuRenderContext;'
  );
  await moduleFile(
    root,
    "lib/landing/publicLandingMenuData.ts",
    'import { resolvePublicMenuRenderContext } from "@/lib/menu/publicMenuRenderContext"; export const resolveLandingPublicMenuRenderContext = resolvePublicMenuRenderContext;'
  );
  await moduleFile(
    root,
    "lib/menu/publicMenuRenderContext.ts",
    'import admin from "@/utils/supabase/admin"; export const resolvePublicMenuRenderContext = admin;'
  );
  await moduleFile(root, "utils/supabase/admin.ts", "export default {};\n");

  assert.deepEqual(
    await inspectStaticPublicImportBoundary(["app/(fr)/page.tsx"], { root }),
    []
  );

  await moduleFile(
    root,
    "lib/landing/menuExperiences.ts",
    [
      'import { resolveLandingPublicMenuRenderContext } from "@/lib/landing/publicLandingMenuData";',
      'import privateData from "@/lib/admin/private";',
      "export const privateSecret = process.env.INTERNAL_LANDING_SECRET;",
      "export const signed = (storage) => storage.createSignedUrl('landing');",
      "export const getLandingExperiences = resolveLandingPublicMenuRenderContext;",
      "void privateData;"
    ].join("\n")
  );
  await moduleFile(root, "lib/admin/private.ts", "export default {};\n");
  const landingFindings = await inspectStaticPublicImportBoundary(
    ["app/(fr)/page.tsx"],
    { root }
  );
  for (const [file, rule, detail] of [
    ["lib/admin/private.ts", "forbidden-path", "lib/admin/private"],
    ["lib/landing/menuExperiences.ts", "non-public-environment", "INTERNAL_LANDING_SECRET"],
    ["lib/landing/menuExperiences.ts", "signed-url-capability", "createSignedUrl"]
  ]) {
    assert.ok(
      landingFindings.some(
        (finding) =>
          finding.file === file &&
          finding.rule === rule &&
          finding.detail === detail
      ),
      `${file} must prove ${rule}`
    );
  }
  const contactFindings = await inspectStaticPublicImportBoundary(
    ["app/(fr)/contact/page.tsx"],
    { root }
  );
  assert.ok(
    contactFindings.some(
      (finding) => finding.rule === "landing-loader-boundary"
    )
  );

  await moduleFile(
    root,
    "app/(en)/en/page.tsx",
    'import { getLandingExperiences } from "@/lib/landing/menuExperiences"; void getLandingExperiences;'
  );
  const directFindings = await inspectStaticPublicImportBoundary(
    ["app/(en)/en/page.tsx"],
    { root }
  );
  assert.ok(
    directFindings.some(
      (finding) => finding.rule === "landing-loader-boundary"
    )
  );
});

test("the public external-data facade is scanned and enforces its exact delegate", async (t) => {
  const root = await makeGraph(t);
  await moduleFile(
    root,
    "app/(fr)/page.tsx",
    'import { VistairePreviewLanding } from "@/components/vistaire-preview/VistairePreviewLanding"; void VistairePreviewLanding;'
  );
  await moduleFile(
    root,
    "components/vistaire-preview/VistairePreviewLanding.tsx",
    'import { VistaireLanding } from "@/components/landing/VistaireLanding"; export const VistairePreviewLanding = VistaireLanding;'
  );
  await moduleFile(
    root,
    "components/landing/VistaireLanding.tsx",
    'import { getLandingExperiences } from "@/lib/landing/menuExperiences"; export const VistaireLanding = getLandingExperiences;'
  );
  await moduleFile(
    root,
    "lib/landing/menuExperiences.ts",
    'import { resolveLandingPublicMenuRenderContext } from "@/lib/landing/publicLandingMenuData"; export const getLandingExperiences = resolveLandingPublicMenuRenderContext;'
  );
  await moduleFile(
    root,
    "lib/landing/publicLandingMenuData.ts",
    [
      'import { resolvePublicMenuRenderContext } from "@/lib/menu/publicMenuRenderContext";',
      'import extra from "@/safe/extra";',
      "export const leaked = process.env.INTERNAL_FACADE_SECRET;",
      "export const signed = (storage) => storage.createSignedUrl('facade');",
      "export const resolveLandingPublicMenuRenderContext = resolvePublicMenuRenderContext;",
      "void extra;"
    ].join("\n")
  );
  await moduleFile(
    root,
    "lib/menu/publicMenuRenderContext.ts",
    'import admin from "@/utils/supabase/admin"; export const resolvePublicMenuRenderContext = admin;'
  );
  await moduleFile(root, "utils/supabase/admin.ts", "export default {};\n");
  await moduleFile(root, "safe/extra.ts", "export default {};\n");

  const facadeFindings = await inspectStaticPublicImportBoundary(
    ["app/(fr)/page.tsx"],
    { root }
  );
  assert.ok(
    facadeFindings.some(
      (finding) =>
        finding.file === "lib/landing/publicLandingMenuData.ts" &&
        finding.rule === "public-data-facade-import" &&
        finding.detail === "@/safe/extra"
    )
  );
  assert.ok(
    facadeFindings.some(
      (finding) =>
        finding.file === "lib/landing/publicLandingMenuData.ts" &&
        finding.rule === "non-public-environment" &&
        finding.detail === "INTERNAL_FACADE_SECRET"
    )
  );
  assert.ok(
    facadeFindings.some(
      (finding) =>
        finding.file === "lib/landing/publicLandingMenuData.ts" &&
        finding.rule === "signed-url-capability"
    )
  );
  assert.equal(
    facadeFindings.some(
      (finding) => finding.file === "utils/supabase/admin.ts"
    ),
    false,
    "only the exact delegate edge may remain opaque"
  );

  await moduleFile(
    root,
    "lib/landing/publicLandingMenuData.ts",
    'import "server-only"; export const resolveLandingPublicMenuRenderContext = null;'
  );
  const missingDelegateFindings = await inspectStaticPublicImportBoundary(
    ["app/(fr)/page.tsx"],
    { root }
  );
  assert.ok(
    missingDelegateFindings.some(
      (finding) =>
        finding.file === "lib/landing/publicLandingMenuData.ts" &&
        finding.rule === "public-data-facade-import" &&
        finding.detail ===
          "missing @/lib/menu/publicMenuRenderContext"
    )
  );

  await moduleFile(
    root,
    "lib/landing/menuExperiences.ts",
    'import { resolveLandingPublicMenuRenderContext } from "@/lib/landing/publicLandingMenuDataPreview"; export const getLandingExperiences = resolveLandingPublicMenuRenderContext;'
  );
  await moduleFile(
    root,
    "lib/landing/publicLandingMenuDataPreview.ts",
    'import { resolvePublicMenuRenderContext } from "@/lib/menu/publicMenuRenderContext"; export const resolveLandingPublicMenuRenderContext = resolvePublicMenuRenderContext;'
  );
  const nearMissFindings = await inspectStaticPublicImportBoundary(
    ["app/(fr)/page.tsx"],
    { root }
  );
  assert.ok(
    nearMissFindings.some(
      (finding) =>
        finding.file === "utils/supabase/admin.ts" &&
        finding.rule === "forbidden-path"
    )
  );
});

test("only the four reviewed SEO comparison entries may use the landing loader directly", async (t) => {
  const root = await makeGraph(t);
  const reviewedEntries = [
    "app/(fr)/(seo)/menu-digital-restaurant/page.tsx",
    "app/(fr)/(seo)/menu-pdf-vs-menu-digital/page.tsx",
    "app/(en)/en/digital-restaurant-menu/page.tsx",
    "app/(en)/en/pdf-vs-digital-menu/page.tsx"
  ];
  for (const entry of reviewedEntries) {
    await moduleFile(
      root,
      entry,
      'import { SeoInteractiveComparison } from "@/components/landing/SeoInteractiveComparison"; void SeoInteractiveComparison;'
    );
  }
  await moduleFile(
    root,
    "components/landing/SeoInteractiveComparison.tsx",
    'import { getLandingExperiences } from "@/lib/landing/menuExperiences"; export const SeoInteractiveComparison = getLandingExperiences;'
  );
  await moduleFile(
    root,
    "lib/landing/menuExperiences.ts",
    'import { resolveLandingPublicMenuRenderContext } from "@/lib/landing/publicLandingMenuData"; export const getLandingExperiences = resolveLandingPublicMenuRenderContext;'
  );
  await moduleFile(
    root,
    "lib/landing/publicLandingMenuData.ts",
    'import { resolvePublicMenuRenderContext } from "@/lib/menu/publicMenuRenderContext"; export const resolveLandingPublicMenuRenderContext = resolvePublicMenuRenderContext;'
  );
  await moduleFile(
    root,
    "lib/menu/publicMenuRenderContext.ts",
    'import admin from "@/utils/supabase/admin"; export const resolvePublicMenuRenderContext = admin;'
  );
  await moduleFile(root, "utils/supabase/admin.ts", "export default {};\n");

  assert.deepEqual(
    await inspectStaticPublicImportBoundary(reviewedEntries, { root }),
    []
  );

  await moduleFile(
    root,
    "lib/landing/menuExperiences.ts",
    [
      'import { resolveLandingPublicMenuRenderContext } from "@/lib/landing/publicLandingMenuData";',
      'import privateData from "@/lib/admin/private";',
      "export const getLandingExperiences = resolveLandingPublicMenuRenderContext;",
      "void privateData;"
    ].join("\n")
  );
  await moduleFile(root, "lib/admin/private.ts", "export default {};\n");
  const reviewedFindings = await inspectStaticPublicImportBoundary(
    reviewedEntries,
    { root }
  );
  assert.equal(
    reviewedFindings.filter(
      (finding) =>
        finding.file === "lib/admin/private.ts" &&
        finding.rule === "forbidden-path"
    ).length,
    reviewedEntries.length
  );

  await moduleFile(
    root,
    "app/(fr)/contact/page.tsx",
    'import { SeoInteractiveComparison } from "@/components/landing/SeoInteractiveComparison"; void SeoInteractiveComparison;'
  );
  assert.ok(
    (
      await inspectStaticPublicImportBoundary(
        ["app/(fr)/contact/page.tsx"],
        { root }
      )
    ).some((finding) => finding.rule === "landing-loader-boundary")
  );

  await moduleFile(
    root,
    "components/landing/AlternateComparison.tsx",
    'import { getLandingExperiences } from "@/lib/landing/menuExperiences"; export const AlternateComparison = getLandingExperiences;'
  );
  await moduleFile(
    root,
    reviewedEntries[0],
    'import { AlternateComparison } from "@/components/landing/AlternateComparison"; void AlternateComparison;'
  );
  assert.ok(
    (
      await inspectStaticPublicImportBoundary([reviewedEntries[0]], { root })
    ).some((finding) => finding.rule === "landing-loader-boundary")
  );
});

test("only four exact public-safe owner helpers are traversed instead of blanket-allowed", async (t) => {
  const root = await makeGraph(t);
  await moduleFile(
    root,
    "entry.ts",
    [
      'import "@/lib/owner/price";',
      'import "@/lib/owner/modelAssetSize";',
      'import "@/lib/owner/menuUrlCore";',
      'import "@/lib/owner/storageSafeIdentifier";',
      'import "@/lib/owner/pricePreview";'
    ].join("\n")
  );
  await moduleFile(
    root,
    "lib/owner/price.ts",
    'import "@/safe/transitive"; export const price = 1;'
  );
  await moduleFile(root, "lib/owner/modelAssetSize.ts", "export const size = 1;\n");
  await moduleFile(root, "lib/owner/menuUrlCore.ts", "export const url = '/';\n");
  await moduleFile(
    root,
    "lib/owner/storageSafeIdentifier.ts",
    "export const safe = true;\n"
  );
  await moduleFile(root, "lib/owner/pricePreview.ts", "export default {};\n");
  await moduleFile(
    root,
    "safe/transitive.ts",
    [
      'import admin from "@/utils/supabase/admin";',
      "export const leaked = process.env.INTERNAL_TRANSITIVE_SECRET;",
      "void admin;"
    ].join("\n")
  );
  await moduleFile(root, "utils/supabase/admin.ts", "export default {};\n");

  const findings = await inspectStaticPublicImportBoundary(["entry.ts"], {
    root
  });
  assert.deepEqual(
    findings
      .filter((finding) => finding.rule === "forbidden-path")
      .map((finding) => finding.file),
    ["lib/owner/pricePreview.ts", "utils/supabase/admin.ts"]
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.file === "safe/transitive.ts" &&
        finding.rule === "non-public-environment" &&
        finding.detail === "INTERNAL_TRANSITIVE_SECRET"
    )
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.file === "utils/supabase/admin.ts" &&
        finding.rule === "forbidden-path"
    )
  );
});

test("NODE_TEST_CONTEXT is allowed only in the exact Sauge renderer binding", async (t) => {
  const root = await makeGraph(t);
  const binding =
    "components/menu/unique/sauge-noire/SaugeNoireRendererBindings.ts";
  await moduleFile(
    root,
    binding,
    "export const nodeTest = process.env.NODE_TEST_CONTEXT;\n"
  );
  assert.deepEqual(
    await inspectStaticPublicImportBoundary([binding], { root }),
    []
  );

  await moduleFile(
    root,
    "components/menu/unique/sauge-noire/OtherBinding.ts",
    "export const nodeTest = process.env.NODE_TEST_CONTEXT;\n"
  );
  assert.ok(
    (
      await inspectStaticPublicImportBoundary(
        ["components/menu/unique/sauge-noire/OtherBinding.ts"],
        { root }
      )
    ).some(
      (finding) =>
        finding.rule === "non-public-environment" &&
        finding.detail === "NODE_TEST_CONTEXT"
    )
  );

  await moduleFile(
    root,
    binding,
    [
      "export const nodeTest = process.env.NODE_TEST_CONTEXT;",
      "export const secret = process.env.OTHER_PRIVATE_ENV;"
    ].join("\n")
  );
  const bindingFindings = await inspectStaticPublicImportBoundary([binding], {
    root
  });
  assert.equal(
    bindingFindings.some((finding) => finding.detail === "NODE_TEST_CONTEXT"),
    false
  );
  assert.ok(
    bindingFindings.some(
      (finding) =>
        finding.rule === "non-public-environment" &&
        finding.detail === "OTHER_PRIVATE_ENV"
    )
  );
});

test("lib/seo accepts only explicit approved environment reads", async (t) => {
  const root = await makeGraph(t);
  const seo = "lib/seo.ts";
  await moduleFile(
    root,
    seo,
    [
      "export const publicSite = process.env.NEXT_PUBLIC_SITE_URL;",
      "export const site = process.env.SITE_URL;",
      "export const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;",
      "export const preview = process.env.VERCEL_URL;"
    ].join("\n")
  );
  assert.deepEqual(
    await inspectStaticPublicImportBoundary([seo], { root }),
    []
  );

  await moduleFile(
    root,
    seo,
    [
      "export const publicSite = process.env.NEXT_PUBLIC_SITE_URL;",
      "export const copied = { ...process.env };",
      "export const { INTERNAL_SEO_SECRET } = process.env;"
    ].join("\n")
  );
  const findings = await inspectStaticPublicImportBoundary([seo], { root });
  assert.ok(
    findings.some(
      (finding) =>
        finding.file === seo &&
        finding.rule === "non-public-environment" &&
        finding.detail === "<process.env>"
    )
  );
});

test("Maison Elyse public identity stays dependency-free and scanner-visible", async () => {
  const identityPath = "lib/maisonElyseIdentity.ts";
  const source = await readFile(
    new URL(`../${identityPath}`, import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /\b(?:import\s*(?:\(|["'{*])|require\s*\(|from\s*["'])/
  );
  assert.match(source, /process\.env\.NEXT_PUBLIC_DEMO_RESTAURANT_ID/);
  assert.deepEqual(
    await inspectStaticPublicImportBoundary([identityPath]),
    []
  );
});

test("the composed French SEO layout is part of the scanned static graph", async (t) => {
  const seoLayout = "app/(fr)/(seo)/layout.tsx";
  assert.ok(STATIC_PUBLIC_ENTRY_FILES.includes(seoLayout));

  const root = await makeGraph(t);
  await moduleFile(
    root,
    seoLayout,
    'import privateData from "@/lib/admin/private"; export default function Layout({ children }) { void privateData; return children; }'
  );
  await moduleFile(root, "lib/admin/private.ts", "export default {};\n");

  const findings = await inspectStaticPublicImportBoundary([seoLayout], {
    root
  });
  assert.ok(
    findings.some(
      (finding) =>
        finding.file === "lib/admin/private.ts" &&
        finding.rule === "forbidden-path"
    )
  );
});

test("the repository's layouts and exact 26 named pages keep a public-only graph", async () => {
  assert.equal(STATIC_PUBLIC_NAMED_PAGE_ENTRIES.length, 26);
  assert.deepEqual(STATIC_PUBLIC_ENTRY_FILES.slice(0, 3), [
    "app/(fr)/layout.tsx",
    "app/(fr)/(seo)/layout.tsx",
    "app/(en)/layout.tsx"
  ]);
  assert.equal(STATIC_PUBLIC_ENTRY_FILES.length, 29);
  assert.deepEqual(
    await inspectStaticPublicImportBoundary(STATIC_PUBLIC_ENTRY_FILES),
    []
  );
});
