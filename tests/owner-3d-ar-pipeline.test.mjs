import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const model = await import("../lib/owner/threeDArPipelineModel.ts");

function finalReadyManifest(overrides = {}) {
  return {
    status: "review",
    validationStatus: "unvalidated",
    visualQuality: {
      status: "passed",
      manualReview: { status: "approved" }
    },
    quality: {
      manualVisualApproved: true,
      manualReview: { status: "approved" },
      realDeviceQa: {
        required: true,
        iphoneQuickLook: {
          required: true,
          status: "passed",
          device: "iPhone 15 Pro",
          os: "iOS 18.5",
          testedBy: "Owner",
          testedAt: "2026-05-31T12:00:00.000Z",
          evidence: { path: "assets/3d/reports/qa/iphone.md", sha256: "a".repeat(64), bytes: 512 }
        },
        androidSceneViewer: {
          required: true,
          status: "passed",
          device: "Pixel 8",
          os: "Android 15",
          testedBy: "Owner",
          testedAt: "2026-05-31T12:00:00.000Z",
          evidence: { path: "assets/3d/reports/qa/android.md", sha256: "b".repeat(64), bytes: 640 }
        }
      }
    },
    validation: { warnings: [], fails: [] },
    ...overrides
  };
}

test("owner 3D/AR pipeline exposes the required overview cards", () => {
  assert.deepEqual(
    model.PIPELINE_OVERVIEW_CARDS.map((card) => card.label),
    [
      "Sources uploaded",
      "Running",
      "Needs review",
      "Rejected",
      "Ready to finalize",
      "Ready to publish",
      "Published"
    ]
  );
});

test("owner 3D/AR pipeline actions stay visible but safe", () => {
  assert.deepEqual(
    model.PIPELINE_ACTIONS.map((action) => action.label),
    [
      "Upload source",
      "Run analyze",
      "Run optimize",
      "Run visual compare",
      "Approve visual",
      "Record device QA",
      "Prepare CDN",
      "Finalize",
      "Publish",
      "Rollback"
    ]
  );

  const publish = model.PIPELINE_ACTIONS.find((action) => action.id === "publish");
  const rollback = model.PIPELINE_ACTIONS.find((action) => action.id === "rollback");

  assert.equal(publish.confirmationRequired, true);
  assert.equal(rollback.confirmationRequired, true);
  assert.equal(publish.executesInUi, false);
  assert.equal(rollback.executesInUi, false);
});

test("owner 3D/AR status mapping does not invent success states", () => {
  assert.equal(
    model.resolvePipelineStatus({
      manifest: { status: "published", validationStatus: "passed" }
    }).id,
    "published"
  );
  assert.equal(
    model.resolvePipelineStatus({
      manifest: finalReadyManifest({ status: "approved", validationStatus: "passed" })
    }).id,
    "ready_to_publish"
  );
  assert.equal(
    model.resolvePipelineStatus({
      manifest: {
        status: "review",
        validationStatus: "failed",
        visualQuality: { status: "passed" },
        quality: {
          manualVisualApproved: true,
          realDeviceQa: {
            iphoneQuickLook: { status: "passed" },
            androidSceneViewer: { status: "passed" }
          }
        }
      }
    }).id,
    "needs_review"
  );
  assert.equal(
    model.resolvePipelineStatus({
      manifest: finalReadyManifest()
    }).id,
    "ready_to_finalize"
  );
  assert.equal(
    model.resolvePipelineStatus({
      manifest: finalReadyManifest({
        visualQuality: { status: "passed" }
      }),
      requiresCdnValidation: true,
      hasPassingCdnValidation: true
    }).id,
    "needs_review"
  );
  assert.equal(
    model.resolvePipelineStatus({
      manifest: finalReadyManifest({
        quality: {
          manualVisualApproved: true,
          manualReview: { status: "approved" },
          realDeviceQa: {
            required: true,
            iphoneQuickLook: { required: true, status: "passed", evidence: { sha256: "a".repeat(64), bytes: 512 } },
            androidSceneViewer: { required: true, status: "passed", evidence: { sha256: "b".repeat(64), bytes: 640 } }
          }
        }
      }),
      requiresCdnValidation: true,
      hasPassingCdnValidation: true
    }).id,
    "needs_review"
  );
  assert.equal(
    model.resolvePipelineStatus({
      manifest: { status: "review", validationStatus: "failed" },
      candidateReport: {
        selectedCandidate: null,
        decision: { status: "rejected", reason: "visual gate failed" }
      }
    }).id,
    "rejected"
  );
  assert.equal(
    model.resolvePipelineStatus({ hasSourceAnalysis: true }).id,
    "source_uploaded"
  );
});

test("owner 3D/AR keeps demo fallback visible when only failed pilot manifests exist", () => {
  assert.equal(
    model.shouldPreserveDemoFallbackAssets([{ source: "manifest", status: "rejected" }]),
    true
  );
  assert.equal(
    model.shouldPreserveDemoFallbackAssets([
      { source: "manifest", status: "rejected" },
      { source: "manifest", status: "rejected" }
    ]),
    true
  );
  assert.equal(
    model.shouldPreserveDemoFallbackAssets([{ source: "manifest", status: "needs_review" }]),
    false
  );
  assert.equal(
    model.shouldPreserveDemoFallbackAssets([{ source: "report", status: "rejected" }]),
    false
  );
  assert.equal(model.shouldPreserveDemoFallbackAssets([]), false);

  const pipeline = readFileSync(
    join(process.cwd(), "lib", "owner", "threeDArPipeline.ts"),
    "utf8"
  );
  assert.match(pipeline, /shouldPreserveDemoFallbackAssets\(assets\)/);
  assert.match(pipeline, /fallbackAssets\(rootDir\)/);
});

test("owner 3D/AR routes are prepared with exact slug/version paths", () => {
  const routes = [
    ["app", "(fr)", "owner", "3d-ar", "page.tsx"],
    ["app", "(fr)", "owner", "3d-ar", "[restaurantSlug]", "[menuSlug]", "[dishSlug]", "page.tsx"],
    [
      "app",
      "(fr)",
      "owner",
      "3d-ar",
      "[restaurantSlug]",
      "[menuSlug]",
      "[dishSlug]",
      "[version]",
      "page.tsx"
    ]
  ];

  for (const route of routes) {
    assert.equal(existsSync(join(process.cwd(), ...route)), true, route.join("/"));
  }
});

test("owner 3D/AR pages do not mount model viewers or preload runtime model files", () => {
  const overview = readFileSync(
    join(process.cwd(), "app", "(fr)", "owner", "3d-ar", "page.tsx"),
    "utf8"
  );

  assert.doesNotMatch(overview, /model-viewer|@google\/model-viewer/i);
  assert.doesNotMatch(overview, /<model|prefetchUsdzForQuickLook|prepareDishAssetIntent/);
});
