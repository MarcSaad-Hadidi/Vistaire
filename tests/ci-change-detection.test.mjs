import assert from "node:assert/strict";
import test from "node:test";
import { classifyChanges, classifyPath, normalizePath, toGitHubOutputs } from "../scripts/ci/detect-changes.mjs";

const classify = (files, extra = {}) => classifyChanges({ eventName: "pull_request", changedFiles: files, ...extra });

test("normalizes Windows paths", () => assert.equal(normalizePath(".\\components\\menu\\Card.tsx"), "components/menu/Card.tsx"));
test("documentation only", () => {
  const result = classify(["docs/ci.md", "README.md"]);
  assert.equal(result.docs_only, true);
  assert.equal(result.full_ci, false);
});
test("landing CSS", () => assert.equal(classify(["styles/landing.css"]).landing, true));
test("landing public media", () => assert.equal(classify(["public/videos/Vistaire2.mp4"]).landing, true));
test("SEO route", () => assert.equal(classify(["app/robots.ts"]).seo, true));
test("SEO route segment", () => assert.equal(classify(["app/seo/page.tsx"]).seo, true));
test("SQL migration", () => assert.equal(classify(["supabase/migrations/20260101_menu.sql"]).database, true));
test("translation", () => assert.equal(classify(["lib/translation/catalog.ts"]).translations, true));
test("QR", () => assert.equal(classify(["app/api/owner/qr-codes/route.ts"]).qr, true));
test("admin", () => assert.equal(classify(["app/admin/restaurants/page.tsx"]).admin, true));
test("shared menu", () => assert.equal(classify(["components/menu/MenuCard.tsx"]).menu_shared, true));
test("Trouvable belongs to shared menu", () => assert.equal(classify(["components/trouvable/Category.tsx"]).menu_shared, true));
test("Sauge renderer", () => assert.equal(classify(["components/menu/unique/sauge-noire/Renderer.tsx"]).sauge_renderer, true));
test("PageFlip gestures", () => assert.equal(classify(["components/menu/PageFlipWrapper.tsx"]).pageflip_gestures, true));
test("Playwright runner forces full CI", () => {
  const result = classify(["scripts/run-playwright-e2e.mjs"]);
  assert.equal(result.ci_infrastructure, true);
  assert.equal(result.full_ci, true);
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
test("stable GitHub output protocol", () => {
  const output = toGitHubOutputs(classify(["docs/ci.md"]));
  assert.match(output, /docs_only=true/);
  assert.match(output, /full_ci=false/);
  assert.match(output, /categories=docs_only/);
});

test("classifyPath exposes known status", () => {
  assert.equal(classifyPath("components/menu/Card.tsx").known, true);
  assert.equal(classifyPath("unknown.blob").known, false);
});
