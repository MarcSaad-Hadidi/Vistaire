import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const reviewModel = await import("../lib/owner/threeDVisualReviewModel.ts");
const pathSegments = await import("../lib/owner/owner3dPathSegments.ts");

const VALID_REPORT = {
  status: "passed",
  meanSsim: 0.991,
  maxDiffRatio: 0.001,
  maxSilhouetteDiff: 0.001,
  maxColorDelta: 0.01,
  maxTextureBlurDelta: 0.01,
  maxMaterialDrift: 0.01,
  maxScaleDriftMeters: 0.001,
  maxOriginDriftMeters: 0.001,
  selectedCandidate: "mobile-balanced",
  source: {
    path: "assets/3d/source/maison-elyse/main/homard-bisque/v1/source.glb"
  },
  candidate: {
    path: "assets/3d/work/maison-elyse/main/homard-bisque/v1/mobile/homard-bisque-mobile.glb"
  },
  decision: {
    reason: "Balanced candidate keeps silhouette and material appetite."
  },
  angleReports: [
    {
      variant: "mobile",
      angle: "front",
      status: "passed",
      before: "assets/3d/reports/maison-elyse/main/homard-bisque/v1/visual/mobile/before/front.png",
      after: "assets/3d/reports/maison-elyse/main/homard-bisque/v1/visual/mobile/after/front.png",
      diff: "assets/3d/reports/maison-elyse/main/homard-bisque/v1/visual/mobile/diff/front.png",
      ssim: 0.991,
      perceptualScore: 0.99,
      maxDiffRatio: 0.001,
      maxSilhouetteDiff: 0.001,
      maxColorDelta: 0.01,
      maxTextureBlurDelta: 0.01,
      maxMaterialDrift: 0.01
    }
  ]
};

test("owner visual review reports missing visual evidence without fake approval", () => {
  const state = reviewModel.buildVisualReviewState({
    visualReport: null,
    candidateReport: null,
    manifest: null,
    identity: {
      restaurantSlug: "maison-elyse",
      menuSlug: "main",
      dishSlug: "homard-bisque",
      version: "v1"
    }
  });

  assert.equal(state.hasVisualReport, false);
  assert.equal(state.approval.canApprove, false);
  assert.match(state.warning, /no visual report/i);
});

test("owner visual review disables approve when the visual report is invalid", () => {
  const state = reviewModel.buildVisualReviewState({
    visualReport: {
      status: "passed",
      angleReports: [
        {
          variant: "mobile",
          angle: "front",
          before: "assets/3d/reports/x/before.png"
        }
      ]
    },
    candidateReport: null,
    manifest: null,
    identity: {
      restaurantSlug: "maison-elyse",
      menuSlug: "main",
      dishSlug: "homard-bisque",
      version: "v1"
    }
  });

  assert.equal(state.hasVisualReport, true);
  assert.equal(state.visualReportValid, false);
  assert.equal(state.approval.canApprove, false);
  assert.match(state.approval.disabledReason, /before\/after\/diff/i);
});

test("owner visual review approve requires a valid report and reviewer identity", () => {
  const state = reviewModel.buildVisualReviewState({
    visualReport: VALID_REPORT,
    candidateReport: { selectedCandidate: "mobile-balanced" },
    manifest: null,
    identity: {
      restaurantSlug: "maison-elyse",
      menuSlug: "main",
      dishSlug: "homard-bisque",
      version: "v1"
    }
  });

  assert.equal(state.approval.canApprove, true);
  assert.match(state.visualReportSha256, /^[a-f0-9]{64}$/);
  assert.match(state.angles[0].before.url, /restaurantSlug=maison-elyse/);
  assert.match(state.angles[0].before.url, /path=assets%2F3d%2Freports%2Fmaison-elyse/);
  assert.equal(state.sourceModel.origin, "owner-artifact");
  assert.match(state.sourceModel.url, /path=assets%2F3d%2Fsource%2Fmaison-elyse/);
  assert.equal(
    reviewModel.allowedVisualReviewArtifactPaths(state).has(
      "assets/3d/reports/maison-elyse/main/homard-bisque/v1/visual/mobile/before/front.png"
    ),
    true
  );
  assert.equal(
    reviewModel.reviewArtifactPathMatchesIdentity(
      "assets/3d/reports/maison-elyse/main/homard-bisque/v1/visual/mobile/diff/front.png",
      state.identity
    ),
    true
  );
  assert.equal(
    reviewModel.reviewArtifactPathMatchesIdentity(
      "assets/3d/reports/other/main/homard-bisque/v1/visual/mobile/diff/front.png",
      state.identity
    ),
    false
  );
  assert.equal(
    reviewModel.validateVisualReviewAction(
      { action: "approve", reviewerName: "" },
      state
    ).ok,
    false
  );
  assert.equal(
    reviewModel.validateVisualReviewAction(
      { action: "approve", reviewerName: "Marc Owner" },
      state
    ).ok,
    true
  );
});

test("owner visual review reject requires a note and keeps publish/finalize out of scope", () => {
  const state = reviewModel.buildVisualReviewState({
    visualReport: VALID_REPORT,
    candidateReport: { selectedCandidate: "mobile-balanced" },
    manifest: null,
    identity: {
      restaurantSlug: "maison-elyse",
      menuSlug: "main",
      dishSlug: "homard-bisque",
      version: "v1"
    }
  });

  assert.equal(
    reviewModel.validateVisualReviewAction({ action: "reject", note: "" }, state).ok,
    false
  );
  const result = reviewModel.validateVisualReviewAction(
    { action: "reject", note: "Texture blur visible on the sauce." },
    state
  );
  assert.equal(result.ok, true);
  assert.equal(result.reviewStatus, "rejected");
  assert.equal(result.finalizesOrPublishes, false);
});

test("owner visual review URL safety blocks unsafe model and screenshot references", () => {
  const identity = {
    restaurantSlug: "maison",
    menuSlug: "main",
    dishSlug: "dish",
    version: "v1"
  };

  assert.equal(
    reviewModel.sanitizeReviewModelUrl("/models/restaurants/maison/main/dish/v1/web/dish.glb").ok,
    true
  );
  assert.equal(
    reviewModel.sanitizeReviewModelUrl("https://cdn.vistaire.test/models/dish.glb", {
      allowedOrigins: ["https://cdn.vistaire.test"]
    }).ok,
    true
  );
  assert.equal(
    reviewModel.sanitizeReviewModelUrl("https://cdn.vistaire.test/vistaire/maison/main/dish/v1/web/dish.glb", {
      allowedOrigins: ["https://cdn.vistaire.test"],
      identity,
      cdnBaseUrl: "https://cdn.vistaire.test/vistaire"
    }).ok,
    true
  );

  for (const unsafe of [
    "https://cdn.vistaire.test/vistaire/maison/main/other-dish/v1/web/dish.glb",
    "https://cdn.vistaire.test/vistaire/maison/main/dish/v1/web/dish.glb?token=secret",
    "https://cdn.vistaire.test/vistaire/maison/main/dish/v1/web/dish.glb#hash",
    "https://user:pass@cdn.vistaire.test/vistaire/maison/main/dish/v1/web/dish.glb"
  ]) {
    assert.equal(
      reviewModel.sanitizeReviewModelUrl(unsafe, {
        allowedOrigins: ["https://cdn.vistaire.test"],
        identity
      }).ok,
      false,
      unsafe
    );
  }

  for (const unsafe of [
    "javascript:alert(1)",
    "//evil.test/model.glb",
    "/api/owner/3d-ar/review-artifact?path=../../.env",
    "/models/restaurants/maison/main/dish/v1/ios/dish.usdz",
    "https://evil.test/model.glb"
  ]) {
    assert.equal(reviewModel.sanitizeReviewModelUrl(unsafe).ok, false, unsafe);
  }

  assert.equal(
    reviewModel.validateReviewArtifactPath(
      "assets/3d/reports/maison/main/dish/v1/visual/mobile/diff/front.png"
    ).ok,
    true
  );
  assert.equal(
    reviewModel.validateReviewArtifactPath("assets/3d/source/maison/main/dish/v1/source.glb").ok,
    true
  );

  for (const unsafe of [
    "../.env",
    "assets/3d/reports/maison/main/dish/v1/secret.txt",
    "public/models/restaurants/maison/main/dish/v1/ios/dish.usdz"
  ]) {
    assert.equal(reviewModel.validateReviewArtifactPath(unsafe).ok, false, unsafe);
  }
});

test("owner visual review route segment sanitizer is bounded and regex-free", () => {
  assert.equal(pathSegments.cleanOwner3dPathSegment("Maison@@Elyse"), "maison-elyse");
  assert.equal(pathSegments.cleanOwner3dPathSegment("--maison--elyse--"), "maison--elyse");
  assert.equal(pathSegments.cleanOwner3dPathSegment("A".repeat(100)).length, 80);

  const sanitizer = readFileSync(
    join(process.cwd(), "lib", "owner", "owner3dPathSegments.ts"),
    "utf8"
  );
  assert.doesNotMatch(sanitizer, /\.replace\(/);

  const server = readFileSync(
    join(process.cwd(), "lib", "owner", "threeDVisualReviewServer.ts"),
    "utf8"
  );
  assert.doesNotMatch(server, /replace\(\s*\/\[\^a-z0-9/);
});

test("owner visual review route and component avoid early GLB loading", () => {
  const routePath = join(
    process.cwd(),
    "app",
    "(fr)",
    "owner",
    "3d-ar",
    "[restaurantSlug]",
    "[menuSlug]",
    "[dishSlug]",
    "[version]",
    "review",
    "page.tsx"
  );
  const componentPath = join(process.cwd(), "components", "owner", "Owner3dVisualReviewPanel.tsx");
  const viewerPath = join(process.cwd(), "components", "owner", "Owner3dLazyModelViewer.tsx");
  const apiPath = join(process.cwd(), "app", "api", "owner", "3d-ar", "visual-review", "route.ts");
  const artifactApiPath = join(process.cwd(), "app", "api", "owner", "3d-ar", "review-artifact", "route.ts");

  for (const path of [routePath, componentPath, viewerPath, apiPath, artifactApiPath]) {
    assert.equal(existsSync(path), true, path);
  }

  const viewer = readFileSync(viewerPath, "utf8");
  assert.match(viewer, /Load source model/);
  assert.match(viewer, /Load candidate model/);
  assert.match(viewer, /import\("@google\/model-viewer"\)/);
  assert.match(viewer, /loaded/);
  assert.doesNotMatch(viewer, /ios-src|quick-look|ar-modes/i);

  const route = readFileSync(routePath, "utf8");
  assert.doesNotMatch(route, /model-viewer|@google\/model-viewer|\\.glb["']/i);

  const api = readFileSync(apiPath, "utf8");
  assert.match(api, /requireVistaireOwnerApi\(\)/);
  assert.match(api, /requireSameOriginOwnerMutation/);
  assert.match(api, /expectedVisualReportSha256/);
  assert.match(api, /expectedSelectedCandidate/);
  assert.match(api, /visual_report_sha256/);
  assert.match(api, /selected_candidate/);
  assert.doesNotMatch(api, /finalize|publish|child_process|spawn\(|exec\(/);

  const artifactApi = readFileSync(artifactApiPath, "utf8");
  assert.match(artifactApi, /validateSourceUploadIdentity/);
  assert.match(artifactApi, /reviewArtifactPathMatchesIdentity/);
  assert.match(artifactApi, /allowedVisualReviewArtifactPaths/);

  const migration = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0004_owner_3d_pipeline_jobs.sql"),
    "utf8"
  );
  assert.match(migration, /restaurant_slug text not null/);
  assert.match(migration, /visual_report_sha256/);
  assert.match(migration, /selected_candidate/);
});
