import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const jobsModel = await import("../lib/owner/threeDJobsModel.ts");

const IDENTITY = {
  restaurantSlug: "maison-elyse",
  menuSlug: "main",
  dishSlug: "homard-bisque",
  version: "v1"
};

test("owner 3D jobs expose required states plus honest cancelled state", () => {
  assert.deepEqual(jobsModel.PIPELINE_JOB_STATUSES, [
    "queued",
    "running",
    "analyzing",
    "optimizing",
    "visual_comparing",
    "needs_visual_review",
    "needs_device_qa",
    "needs_cdn_upload",
    "needs_finalize",
    "ready_to_publish",
    "published",
    "rejected",
    "failed",
    "rolled_back",
    "cancelled"
  ]);
});

test("owner 3D jobs allow only safe state transitions", () => {
  assert.equal(jobsModel.canTransitionJob("queued", "running"), true);
  assert.equal(jobsModel.canTransitionJob("running", "analyzing"), true);
  assert.equal(jobsModel.canTransitionJob("analyzing", "needs_visual_review"), true);
  assert.equal(jobsModel.canTransitionJob("needs_cdn_upload", "needs_finalize"), true);
  assert.equal(jobsModel.canTransitionJob("ready_to_publish", "published"), true);
  assert.equal(jobsModel.canTransitionJob("queued", "cancelled"), true);

  assert.equal(jobsModel.canTransitionJob("published", "running"), false);
  assert.equal(jobsModel.canTransitionJob("cancelled", "queued"), false);
  assert.equal(jobsModel.transitionJobStatus("published", "running").ok, false);
});

test("owner 3D job enqueue policy blocks publish and rollback until readiness checks exist", () => {
  assert.equal(jobsModel.queuePolicyForStep("analyze").ok, true);
  assert.equal(jobsModel.queuePolicyForStep("visual_compare").ok, true);
  assert.equal(jobsModel.queuePolicyForStep("publish").ok, false);
  assert.equal(jobsModel.queuePolicyForStep("rollback").ok, false);
});

test("owner 3D jobs create queued records with manual runner commands, not background execution", () => {
  const job = jobsModel.createPipelineJobDraft({
    identity: IDENTITY,
    step: "visual_compare",
    initiatedBy: "user_owner"
  });

  assert.equal(job.status, "queued");
  assert.equal(job.step, "visual_compare");
  assert.equal(job.nextAction, "Run manual runner command");
  assert.match(job.manualRunnerCommand, /npm run 3d:visual-compare/);
  assert.doesNotMatch(job.manualRunnerCommand, /public\/models\/restaurants\/.*\.glb/);
  assert.equal(Array.isArray(job.logs), true);
  assert.equal(Array.isArray(job.artifacts), true);
});

test("owner 3D jobs do not collide when the same step is queued twice", () => {
  const first = jobsModel.createPipelineJobDraft({
    identity: IDENTITY,
    step: "analyze",
    initiatedBy: "user_owner",
    now: "2026-05-31T12:00:00.000Z"
  });
  const second = jobsModel.createPipelineJobDraft({
    identity: IDENTITY,
    step: "analyze",
    initiatedBy: "user_owner",
    now: "2026-05-31T12:00:00.000Z"
  });

  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^job_[a-z0-9._-]{8,80}$/);
  assert.match(second.id, /^job_[a-z0-9._-]{8,80}$/);
});

test("owner 3D jobs fallback queue supports listing and detail without fake persistence", () => {
  const queue = jobsModel.buildFallbackPipelineJobs([IDENTITY], "dev-owner");

  assert.equal(queue.mode, "fallback");
  assert.equal(queue.persisted, false);
  assert.equal(queue.jobs.length, 1);
  assert.equal(queue.jobs[0].status, "queued");
});

test("owner 3D job API routes are auth-gated and do not execute long processes", () => {
  const routes = [
    join(process.cwd(), "app", "api", "owner", "3d-ar", "jobs", "route.ts"),
    join(process.cwd(), "app", "api", "owner", "3d-ar", "jobs", "[jobId]", "route.ts")
  ];

  for (const route of routes) {
    assert.equal(existsSync(route), true, route);
    const source = readFileSync(route, "utf8");
    assert.match(source, /requireVistaireOwnerApi\(\)/);
    assert.doesNotMatch(source, /child_process|spawn\(|exec\(|execFile\(|npm run 3d:/);
  }

  const listRoute = readFileSync(routes[0], "utf8");
  const detailRoute = readFileSync(routes[1], "utf8");
  assert.match(listRoute, /queuePolicyForStep/);
  assert.match(listRoute, /VISTAIRE_OWNER_3D_JOB_POSTS_PER_MINUTE/);
  assert.match(listRoute, /requireSameOriginOwnerMutation/);
  assert.match(detailRoute, /requireSameOriginOwnerMutation/);
});

test("owner 3D jobs migration defines all requested tables with RLS", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0004_owner_3d_pipeline_jobs.sql"),
    "utf8"
  );

  for (const [requestedTable, actualTable] of [
    ["3d_asset_sources", "owner_3d_asset_sources"],
    ["3d_asset_versions", "owner_3d_asset_versions"],
    ["3d_pipeline_jobs", "owner_3d_pipeline_jobs"],
    ["3d_pipeline_artifacts", "owner_3d_pipeline_artifacts"],
    ["3d_visual_reviews", "owner_3d_visual_reviews"],
    ["3d_device_qa", "owner_3d_device_qa"],
    ["3d_publish_events", "owner_3d_publish_events"]
  ]) {
    assert.match(migration, new RegExp(`requested ${requestedTable}`));
    assert.match(migration, new RegExp(`create table if not exists public\\.${actualTable}`));
    assert.match(migration, new RegExp(`alter table public\\.${actualTable} enable row level security`));
  }
});

test("owner 3D jobs UI includes queue, timeline, logs drawer, retry, cancel, and next action", () => {
  const componentPath = join(
    process.cwd(),
    "components",
    "owner",
    "Owner3dJobsPanel.tsx"
  );
  assert.equal(existsSync(componentPath), true);
  const source = readFileSync(componentPath, "utf8");

  for (const text of [
    "Job queue",
    "Status timeline",
    "Logs",
    "Retry failed step",
    "Cancel pending job",
    "Next action"
  ]) {
    assert.match(source, new RegExp(text));
  }
});
