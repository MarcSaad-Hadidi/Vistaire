import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/workflow-security.yml", import.meta.url),
  "utf8"
);
const mediaBackfillWorkflow = await readFile(
  new URL("../.github/workflows/media-backfill.yml", import.meta.url),
  "utf8"
);

test("workflow security gates are immutable, read-only, and explicit", () => {
  assert.match(workflow, /name: Workflow Security/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /devops-actions\/actionlint@[0-9a-f]{40}/);
  assert.match(workflow, /zizmorcore\/zizmor-action@[0-9a-f]{40}/);
  assert.match(workflow, /version: 1\.21\.0/);
  assert.match(workflow, /online-audits: false/);
  assert.match(workflow, /advanced-security: false/);
  assert.match(workflow, /npm audit --json/);
  assert.match(workflow, /check-npm-audit-baseline\.mjs/);
  assert.doesNotMatch(workflow, /npm audit fix/);
  for (const match of workflow.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)) {
    assert.match(match[2], /^[0-9a-f]{40}$/, `${match[1]} must use a full commit SHA`);
  }
});

test("dish photo backfill is manual, main-only, and fail-closed for production apply", () => {
  assert.match(mediaBackfillWorkflow, /name: Dish Photo Derivative Backfill/);
  assert.match(mediaBackfillWorkflow, /^on:\s*\n\s*workflow_dispatch:/m);
  assert.doesNotMatch(mediaBackfillWorkflow, /^\s+(?:pull_request|push|schedule):/m);
  assert.match(mediaBackfillWorkflow, /permissions:\s+contents: read/);
  assert.match(mediaBackfillWorkflow, /default: dry-run/);
  assert.match(mediaBackfillWorkflow, /options:\s*\n\s*- dry-run\s*\n\s*- apply/);
  assert.match(mediaBackfillWorkflow, /APPLY-DISH-PHOTO-BACKFILL/);
  assert.match(mediaBackfillWorkflow, /github\.event_name == 'workflow_dispatch'/);
  assert.match(mediaBackfillWorkflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(mediaBackfillWorkflow, /persist-credentials: false/);
  assert.match(mediaBackfillWorkflow, /lfs: false/);
  assert.match(mediaBackfillWorkflow, /NEXT_PUBLIC_SUPABASE_URL: \$\{\{ secrets\.NEXT_PUBLIC_SUPABASE_URL \}\}/);
  assert.match(mediaBackfillWorkflow, /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
  assert.match(mediaBackfillWorkflow, /VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: \$\{\{ vars\.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF \}\}/);
  assert.match(mediaBackfillWorkflow, /VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY: \$\{\{ vars\.VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY \}\}/);
  assert.match(mediaBackfillWorkflow, /VISTAIRE_MEDIA_WRITES_ENABLED: \$\{\{ vars\.VISTAIRE_MEDIA_WRITES_ENABLED \}\}/);
  assert.match(mediaBackfillWorkflow, /--measure-only/);
  assert.match(mediaBackfillWorkflow, /--apply --confirm-production/);
  assert.match(mediaBackfillWorkflow, /--measure-report=/);
  assert.match(mediaBackfillWorkflow, /--verify-only/);
  assert.doesNotMatch(mediaBackfillWorkflow, /VISTAIRE_MEDIA_BACKFILL_ALLOW_APPLY=1/);
  assert.doesNotMatch(mediaBackfillWorkflow, /VISTAIRE_MEDIA_WRITES_ENABLED=true/);
  assert.doesNotMatch(mediaBackfillWorkflow, /continue-on-error/);
  for (const match of mediaBackfillWorkflow.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)) {
    assert.match(match[2], /^[0-9a-f]{40}$/, `${match[1]} must use a full commit SHA`);
  }
});

test("production apply is restricted to one explicit canary dish", () => {
  assert.match(mediaBackfillWorkflow, /canary_restaurant_id:/);
  assert.match(mediaBackfillWorkflow, /canary_dish_id:/);
  assert.match(mediaBackfillWorkflow, /CANARY_RESTAURANT_ID: \$\{\{ inputs\.canary_restaurant_id \}\}/);
  assert.match(mediaBackfillWorkflow, /CANARY_DISH_ID: \$\{\{ inputs\.canary_dish_id \}\}/);
  assert.match(mediaBackfillWorkflow, /Apply blocked: canary restaurant and dish are required/);
  assert.match(mediaBackfillWorkflow, /Apply blocked: canary restaurant id must be a UUID/);
  assert.match(mediaBackfillWorkflow, /Apply blocked: canary dish id must be a UUID/);
  assert.equal(
    (mediaBackfillWorkflow.match(/--restaurant-id="\$CANARY_RESTAURANT_ID"/g) ?? []).length,
    3,
    "measure, apply, and verify must all use the exact canary restaurant"
  );
  assert.equal(
    (mediaBackfillWorkflow.match(/--dish-id="\$CANARY_DISH_ID"/g) ?? []).length,
    3,
    "measure, apply, and verify must all use the exact canary dish"
  );
  const applyBlock = mediaBackfillWorkflow.slice(
    mediaBackfillWorkflow.indexOf("- name: Apply measured derivative backfill"),
    mediaBackfillWorkflow.indexOf("- name: Verify derivative metadata and Storage objects after apply")
  );
  assert.match(applyBlock, /--restaurant-id="\$CANARY_RESTAURANT_ID"/);
  assert.match(applyBlock, /--dish-id="\$CANARY_DISH_ID"/);
});
