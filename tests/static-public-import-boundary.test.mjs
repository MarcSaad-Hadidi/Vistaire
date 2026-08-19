import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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

test("the landing loader exception is path- and entry-specific and remains a leaf", async (t) => {
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
    'import privateData from "@/lib/admin/private"; export const getLandingExperiences = privateData;'
  );
  await moduleFile(root, "lib/admin/private.ts", "export default {};\n");

  assert.deepEqual(
    await inspectStaticPublicImportBoundary(["app/(fr)/page.tsx"], { root }),
    []
  );
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
    'import privateData from "@/lib/admin/private"; export const getLandingExperiences = privateData;'
  );
  await moduleFile(root, "lib/admin/private.ts", "export default {};\n");

  assert.deepEqual(
    await inspectStaticPublicImportBoundary(reviewedEntries, { root }),
    []
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

test("the repository's two roots and exact 26 named pages keep a public-only graph", async () => {
  assert.equal(STATIC_PUBLIC_NAMED_PAGE_ENTRIES.length, 26);
  assert.deepEqual(
    STATIC_PUBLIC_ENTRY_FILES.slice(0, 2),
    ["app/(fr)/layout.tsx", "app/(en)/layout.tsx"]
  );
  assert.equal(STATIC_PUBLIC_ENTRY_FILES.length, 28);
  assert.deepEqual(
    await inspectStaticPublicImportBoundary(STATIC_PUBLIC_ENTRY_FILES),
    []
  );
});
