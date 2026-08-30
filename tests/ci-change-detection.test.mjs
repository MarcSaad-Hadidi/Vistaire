import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyChanges,
  classifyPath,
  deriveRunOutputs,
  gitDiffPaths,
  normalizePath,
  RUN_OUTPUTS,
  toGitHubOutputs
} from "../scripts/ci/detect-changes.mjs";

const classify = (files, extra = {}) => classifyChanges({ eventName: "pull_request", changedFiles: files, ...extra });

test("normalizes Windows paths", () => assert.equal(normalizePath(".\\components\\menu\\Card.tsx"), "components/menu/Card.tsx"));
test("documentation only", () => {
  const result = classify(["docs/ci.md", "README.md"]);
  assert.equal(result.docs_only, true);
  assert.equal(result.full_ci, false);
});
test("documentation is an explicit allowlist, not an extension rule", () => {
  assert.equal(classifyPath("README.md").categories.has("docs_only"), true);
  assert.equal(classifyPath("docs/ci.md").categories.has("docs_only"), true);
  assert.equal(classifyPath("docs/demo.mp4").categories.has("assets"), true);
  assert.equal(classifyPath("docs/demo.mp4").categories.has("docs_only"), false);
  assert.equal(classifyPath("app/help/page.mdx").categories.has("docs_only"), false);
  assert.equal(classifyPath("app/help/page.mdx").known, true);
  assert.equal(classifyPath("content/landing-copy.mdx").categories.has("landing"), true);
  assert.equal(classifyPath("content/landing-copy.mdx").categories.has("docs_only"), false);
  assert.equal(classifyPath("fixtures/runtime-data.txt").categories.has("docs_only"), false);
  assert.equal(classifyPath("fixtures/runtime-data.txt").known, true);
});
test("documentation media runs asset guards", () => {
  const result = classify(["docs/demo.mp4", "docs/raw.mov", "documentation/source.blend"]);
  assert.equal(result.assets, true);
  assert.equal(result.docs_only, false);
  assert.equal(result.full_ci, false);
  assert.equal(result.run_build, true);
  assert.equal(result.run_core, true);
});
test("landing CSS", () => assert.equal(classify(["styles/landing.css"]).landing, true));
test("landing public media", () => assert.equal(classify(["public/videos/Vistaire2.mp4"]).landing, true));
test("SEO route", () => assert.equal(classify(["app/robots.ts"]).seo, true));
test("SEO route segment", () => assert.equal(classify(["app/seo/page.tsx"]).seo, true));
test("SQL migration", () => assert.equal(classify(["supabase/migrations/20260101_menu.sql"]).database, true));
test("translation", () => assert.equal(classify(["lib/translation/catalog.ts"]).translations, true));
test("QR", () => assert.equal(classify(["app/api/owner/qr-codes/route.ts"]).qr, true));
test("admin", () => assert.equal(classify(["app/(fr)/admin/restaurants/page.tsx"]).admin, true));
test("shared menu", () => assert.equal(classify(["components/menu/MenuCard.tsx"]).menu_shared, true));
test("Trouvable belongs to shared menu", () => assert.equal(classify(["components/trouvable/Category.tsx"]).menu_shared, true));
test("Sauge renderer", () => assert.equal(classify(["components/menu/unique/sauge-noire/Renderer.tsx"]).sauge_renderer, true));
test("PageFlip gestures", () => assert.equal(classify(["components/menu/PageFlipWrapper.tsx"]).pageflip_gestures, true));
test("Playwright runner forces full CI", () => {
  const result = classify(["scripts/run-playwright-e2e.mjs"]);
  assert.equal(result.ci_infrastructure, true);
  assert.equal(result.full_ci, true);
});
test("public navigation chrome changes run the core browser family", () => {
  const result = classify(["components/vistaire-preview/VistairePreviewChrome.tsx"]);
  assert.equal(result.core, true);
  assert.equal(result.public_navigation, true);
  assert.equal(result.run_core, true);
  assert.equal(result.run_webkit, true);
  assert.equal(result.run_build, true);
  assert.equal(result.run_static, true);
  assert.equal(result.run_landing, false);
  assert.equal(result.run_menu, false);
  assert.equal(result.run_seo, false);
});

test("restaurateur preview routes, fixture, components, and browser spec share one public family", () => {
  for (const path of [
    "app/(fr)/apercu-restaurateur/page.tsx",
    "app/(en)/en/restaurant-preview/page.tsx",
    "components/vistaire-preview/RestaurateurDashboardDemo.tsx",
    "lib/restaurateurPreview/fixture.ts",
    "e2e/restaurateur-preview.spec.ts"
  ]) {
    const result = classify([path]);
    assert.equal(result.public_navigation, true, path);
    assert.equal(result.run_core, true, path);
    assert.equal(result.run_webkit, true, path);
  }
});
test("public navigation remains covered when a QR preview change overlaps", () => {
  const result = classify([
    "components/vistaire-preview/VistairePreviewChrome.tsx",
    "components/vistaire-preview/VistaireMenuQrCodeRestaurantPreview.tsx",
    "e2e/public-navigation.spec.ts"
  ]);
  assert.equal(result.public_navigation, true);
  assert.equal(result.qr, true);
  assert.equal(result.run_core, true);
  assert.equal(result.run_admin_qr, true);
});
test("public navigation callsites stay in the core browser family", () => {
  for (const path of [
    "app/(fr)/demo/page.tsx",
    "app/(en)/en/pricing-digital-restaurant-menu/page.tsx",
    "app/(en)/en/vistaire-menu/page.tsx",
    "components/landing/VistaireLanding.tsx",
    "components/seo/SeoGeoAeoPage.tsx"
  ]) {
    const result = classify([path]);
    assert.equal(result.public_navigation, true, path);
    assert.equal(result.run_core, true, path);
  }
});

test("locale-grouped application paths retain their specialized CI families", () => {
  const cases = [
    ["grouped SEO", "app/(fr)/(seo)/menu-digital-restaurant/page.tsx", ["run_seo"]],
    ["grouped landing", "app/(fr)/page.tsx", ["run_landing"]],
    ["grouped menu", "app/(fr)/menu/[slug]/page.tsx", ["run_menu", "run_webkit"]],
    ["grouped admin", "app/(fr)/admin/page.tsx", ["run_admin_qr"]],
    ["grouped owner", "app/(fr)/owner/page.tsx", ["run_admin_qr"]],
    [
      "grouped public preview",
      "app/(fr)/apercu-restaurateur/page.tsx",
      ["run_core", "run_webkit"]
    ],
    ["French document root", "app/(fr)/layout.tsx", ["run_core"]],
    ["English document root", "app/(en)/layout.tsx", ["run_core"]]
  ];

  for (const [name, file, browserFamilies] of cases) {
    const result = classify([file]);
    assert.equal(result.run_static, true, `${name}: static contract`);
    assert.equal(result.run_build, true, `${name}: build`);
    for (const family of browserFamilies) {
      assert.equal(result[family], true, `${name}: ${family}`);
    }
  }
});
test("workflow forces full CI", () => assert.equal(classify([".github/workflows/app-ci.yml"]).full_ci, true));
test("lockfile forces full CI", () => assert.equal(classify(["package-lock.json"]).full_ci, true));
test("unknown path fails closed", () => {
  const result = classify(["vendor/generated.weird"]);
  assert.equal(result.full_ci, true);
  assert.deepEqual(result.unknown_files, ["vendor/generated.weird"]);
});
test("rename classifies both old and new paths", () => {
  const result = classify([{ status: "renamed", from: "docs/old.md", to: "components/menu/New.tsx" }]);
  assert.equal(result.menu_shared, true);
  assert.equal(result.docs_only, false);
});
test("deletion remains classified", () => assert.equal(classify([{ status: "deleted", path: "supabase/migrations/old.sql" }]).database, true));
test("merge_group is exhaustive", () => {
  const result = classifyChanges({ eventName: "merge_group", changedFiles: [] });
  assert.equal(result.full_ci, true);
  assert.equal(result.sauge_renderer, true);
});
test("workflow dispatch full is exhaustive", () => {
  const result = classifyChanges({ eventName: "workflow_dispatch", dispatchInput: { target: "full" } });
  assert.equal(result.full_ci, true);
  assert.equal(result.admin, true);
});
test("workflow dispatch family targets are explicit and bounded", () => {
  const result = classifyChanges({
    eventName: "workflow_dispatch",
    dispatchInput: { target: "admin_qr" }
  });
  assert.equal(result.full_ci, false);
  assert.equal(result.admin, true);
  assert.equal(result.qr, true);
  assert.equal(result.sauge_renderer, false);
  assert.deepEqual(RUN_OUTPUTS.filter((output) => result[output]), [
    "run_static", "run_database", "run_build", "run_admin_qr"
  ]);
});
test("invalid workflow dispatch target fails closed", () => {
  const result = classifyChanges({
    eventName: "workflow_dispatch",
    dispatchInput: { target: "not-a-target" },
    changedFiles: ["README.md"]
  });
  assert.equal(result.full_ci, true);
});
test("push main is exhaustive", () => {
  const result = classifyChanges({ eventName: "push", ref: "refs/heads/main", changedFiles: ["README.md"] });
  assert.equal(result.full_ci, true);
  assert.equal(result.pageflip_gestures, true);
});
test("a branch named feature/main is not treated as the main branch", () => {
  const result = classifyChanges({
    eventName: "push",
    ref: "refs/heads/feature/main",
    changedFiles: ["README.md"]
  });
  assert.equal(result.full_ci, false);
  assert.equal(result.docs_only, true);
});

test("exact run_* policy matrix is stable", () => {
  const cases = [
    ["documentation", ["README.md"], []],
    ["SQL", ["supabase/migrations/20260101_menu.sql"], ["run_static", "run_database"]],
    ["translation", ["content/translations/en.json"], ["run_static", "run_database", "run_build", "run_menu", "run_webkit"]],
    ["QR", ["app/api/owner/qr-codes/route.ts"], ["run_static", "run_database", "run_build", "run_admin_qr"]],
    ["SEO", ["app/seo/page.tsx"], ["run_static", "run_build", "run_seo"]],
    ["landing", ["app/(landing)/page.tsx"], ["run_static", "run_build", "run_core", "run_landing"]],
    ["menu shared", ["components/menu/MenuCard.tsx"], ["run_static", "run_build", "run_menu", "run_webkit"]],
    ["Sauge", ["components/menu/unique/sauge-noire/Renderer.tsx"], [
      "run_static", "run_build", "run_menu", "run_sauge", "run_webkit"
    ]]
  ];
  for (const [name, files, expected] of cases) {
    const result = classify(files);
    const actual = RUN_OUTPUTS.filter((output) => result[output]);
    assert.deepEqual(actual, expected, `${name} outputs`);
    assert.deepEqual(result.categories.includes("full_ci"), false, `${name} should stay targeted`);
  }
  const exhaustive = classifyChanges({
    eventName: "push",
    ref: "refs/heads/main",
    changedFiles: ["README.md"]
  });
  assert.deepEqual(RUN_OUTPUTS.filter((output) => exhaustive[output]), [...RUN_OUTPUTS]);
  assert.deepEqual(deriveRunOutputs(exhaustive.flags), Object.fromEntries(RUN_OUTPUTS.map((name) => [name, true])));
  for (const event of ["merge_group", "workflow_call"]) {
    const result = classifyChanges({ eventName: event, changedFiles: event === "merge_group" ? [] : undefined });
    assert.deepEqual(RUN_OUTPUTS.filter((output) => result[output]), [...RUN_OUTPUTS], `${event} outputs`);
  }
  const nightly = classifyChanges({ eventName: "workflow_dispatch", dispatchInput: { target: "full" } });
  assert.deepEqual(RUN_OUTPUTS.filter((output) => nightly[output]), [...RUN_OUTPUTS], "nightly/full outputs");
});

test("pull_request diff uses merge-base when main advances", () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), "vistaire-ci-"));
  const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "ignore" });
  const sha = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  try {
    git("init", "-b", "main");
    git("config", "user.email", "ci@example.test");
    git("config", "user.name", "CI test");
    writeFileSync(path.join(repo, "README.md"), "root\n");
    writeFileSync(path.join(repo, "app-seo-old.ts"), "old\n");
    writeFileSync(path.join(repo, "app-seo-delete.ts"), "delete\n");
    git("add", ".");
    git("commit", "-m", "root");
    git("switch", "-c", "feature/seo");
    const branchBase = sha();
    git("mv", "app-seo-old.ts", "app-seo-new.ts");
    execFileSync("git", ["rm", "app-seo-delete.ts"], { cwd: repo, stdio: "ignore" });
    writeFileSync(path.join(repo, "seo-page.ts"), "seo\n");
    git("add", ".");
    git("commit", "-m", "seo change");
    const head = sha();
    git("switch", "main");
    writeFileSync(path.join(repo, "main-only.txt"), "main\n");
    git("add", ".");
    git("commit", "-m", "main advanced");
    const advancedBase = sha();

    assert.notEqual(advancedBase, branchBase);
    const files = gitDiffPaths(advancedBase, head, { cwd: repo });
    assert.deepEqual(files, ["app-seo-delete.ts", "app-seo-new.ts", "app-seo-old.ts", "seo-page.ts"]);
    assert.equal(files.includes("main-only.txt"), false);
    const result = classifyChanges({ eventName: "pull_request", changedFiles: files });
    assert.equal(result.seo, true);
    assert.equal(result.full_ci, false);
    assert.equal(result.run_seo, true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("merge-base failure is fail-closed to full CI", () => {
  const missing = "f".repeat(40);
  assert.equal(gitDiffPaths(missing, "e".repeat(40)), null);
  const result = classifyChanges({
    eventName: "pull_request",
    changedFiles: undefined
  });
  assert.equal(result.full_ci, true);
  assert.deepEqual(RUN_OUTPUTS.filter((output) => result[output]), [...RUN_OUTPUTS]);
});
test("stable GitHub output protocol", () => {
  const output = toGitHubOutputs(classify(["docs/ci.md"]));
  assert.match(output, /docs_only=true/);
  assert.match(output, /full_ci=false/);
  assert.match(output, /categories=docs_only/);
  assert.match(output, /run_static=false/);
  assert.match(output, /classification_valid=true/);
});

test("GitHub outputs escape hostile filenames and reasons", () => {
  const hostile = "vendor/$(`touch nope`)\nCI_CLASSIFIER_REASON.weird";
  const output = toGitHubOutputs(classify([hostile]));
  const lines = output.split("\n");
  assert.equal(
    lines.find((line) => line.startsWith("changed_files="))?.slice("changed_files=".length),
    "vendor/$(`touch nope`)\\nCI_CLASSIFIER_REASON.weird"
  );
  const reasonStart = lines.indexOf("reason<<CI_CLASSIFIER_REASON");
  assert.equal(lines[reasonStart + 1], "unclassified path(s): vendor/$(`touch nope`)\\nCI_CLASSIFIER_REASON.weird");
  assert.equal(lines[reasonStart + 2], "CI_CLASSIFIER_REASON");
});

test("classifyPath exposes known status", () => {
  assert.equal(classifyPath("components/menu/Card.tsx").known, true);
  assert.equal(classifyPath("unknown.blob").known, false);
});
