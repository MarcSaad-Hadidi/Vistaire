import assert from "node:assert/strict";
import test from "node:test";

const NOW = 1_783_631_200;
const SESSION_SECRET = "synthetic-session-secret-with-at-least-32-bytes";
const LOCAL_PREVIEW_SECRET =
  "synthetic-local-preview-secret-with-at-least-32-bytes";

function controlledEnvironment(overrides = {}) {
  return {
    VISTAIRE_ADMIN_E2E_ENABLED: "true",
    VISTAIRE_ADMIN_E2E_BASE_URL:
      "https://vistaire-git-qr-security-capoships-projects.vercel.app",
    PLAYWRIGHT_BASE_URL:
      "https://vistaire-git-qr-security-capoships-projects.vercel.app",
    VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST:
      "vistaire-git-qr-security-capoships-projects.vercel.app",
    VISTAIRE_ADMIN_E2E_VERCEL_TEAM_ID: "team_syntheticpreview",
    VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID: "prj_syntheticpreview",
    VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH: "qr-security",
    VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN:
      "synthetic-vercel-read-only-api-token",
    VISTAIRE_ADMIN_E2E_SUPABASE_URL:
      "https://previewfixtureproject.supabase.co",
    VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF:
      "previewfixtureproject",
    VISTAIRE_ADMIN_E2E_RESTAURANT_NAME: "Vistaire E2E Restaurant A",
    VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME: "Vistaire E2E Restaurant B",
    VISTAIRE_ADMIN_E2E_QR_TOKEN: "synthetic-qr-fixture-a-token",
    VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN: "synthetic-qr-fixture-b-token",
    VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN:
      "synthetic-qr-fixture-suspended-token",
    VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN:
      "synthetic-qr-fixture-fallback-token",
    ...overrides
  };
}

async function adminAccessFixture({
  qrId = "qr-fixture-a",
  restaurantId = "restaurant-fixture-a",
  row
} = {}) {
  const { createAdminAccessToken } = await import(
    "../lib/admin/accessSessionCore.ts"
  );
  const token = createAdminAccessToken(
    { qrId, restaurantId, now: NOW },
    SESSION_SECRET
  );
  return {
    secret: SESSION_SECRET,
    now: NOW + 60,
    getCookieValue: () => token,
    readQrCode: async () =>
      row ?? {
        id: qrId,
        restaurantId,
        targetKind: "admin",
        targetPath: "/admin",
        status: "active"
      }
  };
}

test("controlled QR E2E accepts only a separate HTTPS preview and returns no token values", async () => {
  const { validateControlledAdminE2EContract } = await import(
    "../scripts/admin-e2e-fixture-contract.mjs"
  );
  const env = controlledEnvironment();
  const result = validateControlledAdminE2EContract(env);
  const serialized = JSON.stringify(result);

  assert.deepEqual(result, {
    baseOrigin:
      "https://vistaire-git-qr-security-capoships-projects.vercel.app",
    vercelHost: "vistaire-git-qr-security-capoships-projects.vercel.app",
    vercelTeamId: "team_syntheticpreview",
    vercelProjectId: "prj_syntheticpreview",
    gitBranch: "qr-security",
    commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    supabaseProjectRef: "previewfixtureproject",
    restaurantA: "Vistaire E2E Restaurant A",
    restaurantB: "Vistaire E2E Restaurant B",
    secretNames: [
      "VISTAIRE_ADMIN_E2E_QR_TOKEN",
      "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN",
      "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN",
      "VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN"
    ]
  });
  for (const name of result.secretNames) {
    assert.doesNotMatch(serialized, new RegExp(env[name]));
  }

  for (const baseUrl of [
    "http://localhost:3000",
    "https://vistaire.ca",
    "https://www.vistaire.ca",
    "https://vistaire.vercel.app",
    "https://user:password@preview.example"
  ]) {
    assert.throws(
      () =>
        validateControlledAdminE2EContract(
          controlledEnvironment({
            VISTAIRE_ADMIN_E2E_BASE_URL: baseUrl,
            PLAYWRIGHT_BASE_URL: baseUrl
          })
        ),
      /controlled preview|credentials|HTTPS|expected Vercel preview/
    );
  }
});

test("preflight proves the exact Vercel Preview and its effective Supabase binding", async () => {
  const {
    validateControlledAdminE2EContract,
    verifyControlledAdminE2ERemoteIdentity
  } = await import("../scripts/admin-e2e-fixture-contract.mjs");
  const env = controlledEnvironment();
  const contract = validateControlledAdminE2EContract(env);
  const requests = [];
  const fetchDeployment = async (url, options) => {
    requests.push({ url: String(url), authorization: options.headers.Authorization });
    return new Response(
      JSON.stringify({
        target: null,
        readyState: "READY",
        projectId: env.VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID,
        meta: {
          githubCommitRef: env.VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH,
          githubCommitSha: env.VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA
        },
        env: [
          {
            key: "NEXT_PUBLIC_SUPABASE_URL",
            value: env.VISTAIRE_ADMIN_E2E_SUPABASE_URL
          },
          {
            key: "VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF",
            value: env.VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  assert.deepEqual(
    await verifyControlledAdminE2ERemoteIdentity(
      contract,
      env,
      fetchDeployment
    ),
    {
      readyState: "READY",
      target: "preview",
      projectId: "prj_syntheticpreview",
      gitBranch: "qr-security",
      commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      supabaseProjectRef: "previewfixtureproject"
    }
  );
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /api\.vercel\.com\/v13\/deployments\//);
  assert.doesNotMatch(
    requests[0].url,
    new RegExp(env.VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN)
  );
  assert.equal(
    requests[0].authorization,
    `Bearer ${env.VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN}`
  );
});

test("remote preflight rejects Production metadata and Supabase deployment drift", async () => {
  const {
    validateControlledAdminE2EContract,
    verifyControlledAdminE2ERemoteIdentity
  } = await import("../scripts/admin-e2e-fixture-contract.mjs");
  const env = controlledEnvironment();
  const contract = validateControlledAdminE2EContract(env);
  const metadata = {
    target: null,
    readyState: "READY",
    projectId: env.VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID,
    meta: {
      githubCommitRef: env.VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH,
      githubCommitSha: env.VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA
    },
    env: [
      {
        key: "NEXT_PUBLIC_SUPABASE_URL",
        value: env.VISTAIRE_ADMIN_E2E_SUPABASE_URL
      },
      {
        key: "VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF",
        value: env.VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF
      }
    ]
  };
  const responseFor = (overrides) => async () =>
    new Response(JSON.stringify({ ...metadata, ...overrides }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

  await assert.rejects(
    verifyControlledAdminE2ERemoteIdentity(
      contract,
      env,
      responseFor({ target: "production" })
    ),
    /Preview deployment/
  );
  await assert.rejects(
    verifyControlledAdminE2ERemoteIdentity(
      contract,
      env,
      responseFor({
        env: metadata.env.map((entry) =>
          entry.key === "NEXT_PUBLIC_SUPABASE_URL"
            ? {
                ...entry,
                value: "https://productionprojectref.supabase.co"
              }
            : entry
        )
      })
    ),
    /Supabase binding/
  );
  await assert.rejects(
    verifyControlledAdminE2ERemoteIdentity(
      contract,
      env,
      responseFor({
        meta: {
          ...metadata.meta,
          githubCommitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }
      })
    ),
    /commit/
  );
});

test("controlled QR E2E fails closed for host drift, invalid tokens, and fixture identity drift", async () => {
  const { validateControlledAdminE2EContract } = await import(
    "../scripts/admin-e2e-fixture-contract.mjs"
  );

  const invalidEnvironments = [
    controlledEnvironment({
      PLAYWRIGHT_BASE_URL: "https://other-preview.example"
    }),
    controlledEnvironment({
      VISTAIRE_ADMIN_E2E_QR_TOKEN: "short"
    }),
    controlledEnvironment({
      VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN:
        "synthetic-qr-fixture-a-token"
    }),
    controlledEnvironment({
      VISTAIRE_ADMIN_E2E_RESTAURANT_NAME: "Production Client"
    }),
    controlledEnvironment({
      VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST:
        "other-git-preview-capoships-projects.vercel.app"
    }),
    controlledEnvironment({
      VISTAIRE_ADMIN_E2E_BASE_URL:
        "https://vistaire-git-main-capoships-projects.vercel.app",
      PLAYWRIGHT_BASE_URL:
        "https://vistaire-git-main-capoships-projects.vercel.app",
      VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST:
        "vistaire-git-main-capoships-projects.vercel.app"
    }),
    controlledEnvironment({
      VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF:
        "otherpreviewproject"
    }),
    controlledEnvironment({
      VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST: ""
    }),
    controlledEnvironment({
      VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF: ""
    })
  ];

  for (const env of invalidEnvironments) {
    assert.throws(() => validateControlledAdminE2EContract(env));
  }
});

test("dev, preview, and production keep local preview grants separated by host and runtime mode", async () => {
  const {
    createLocalAdminPreviewAccess,
    createLocalAdminPreviewGrant
  } = await import("../lib/admin/localPreviewCore.ts");

  const localGrant = createLocalAdminPreviewGrant({
    nodeEnv: "development",
    origin: "http://localhost:3000",
    requestOrigin: "http://localhost:3000",
    secret: LOCAL_PREVIEW_SECRET,
    now: NOW
  });
  assert.equal(localGrant.ok, true);
  assert.equal(
    createLocalAdminPreviewGrant({
      nodeEnv: "production",
      origin: "https://vistaire-qr-security-fixture.vercel.app",
      requestOrigin: "https://vistaire-qr-security-fixture.vercel.app",
      secret: LOCAL_PREVIEW_SECRET,
      now: NOW
    }).ok,
    false,
    "a Vercel preview uses the production runtime mode and must not get a local grant"
  );
  assert.equal(
    createLocalAdminPreviewGrant({
      nodeEnv: "production",
      origin: "https://vistaire.ca",
      requestOrigin: "https://vistaire.ca",
      secret: LOCAL_PREVIEW_SECRET,
      now: NOW
    }).ok,
    false,
    "production must not get a local grant"
  );

  assert.equal(localGrant.ok, true);
  if (localGrant.ok) {
    assert.equal(
      createLocalAdminPreviewAccess({
        nodeEnv: "development",
        hostname: "preview.example",
        capability: "dashboard:read",
        cookieValue: localGrant.cookie.value,
        restaurantId: "restaurant-fixture-a",
        secret: LOCAL_PREVIEW_SECRET,
        now: NOW + 1
      }),
      null,
      "a valid local cookie must not cross onto a remote host"
    );
  }
});

test("admin cookies remain path scoped and secure in preview and production", async () => {
  const {
    getAdminAccessCookieOptions,
    getExpiredAdminAccessCookieOptions
  } = await import("../lib/admin/accessSessionCore.ts");

  const development = getAdminAccessCookieOptions("development");
  const preview = getAdminAccessCookieOptions("production");
  const production = getAdminAccessCookieOptions("production");

  assert.equal(development.secure, false);
  for (const options of [preview, production]) {
    assert.deepEqual(options, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/admin",
      maxAge: 28_800
    });
  }
  assert.equal(getExpiredAdminAccessCookieOptions("production").maxAge, 0);
  assert.equal(
    getExpiredAdminAccessCookieOptions("production").expires.getTime(),
    0
  );
});

test("A/B isolation, invalid sessions, and live QR pause all fail closed", async () => {
  const { requireAdminRestaurantAccess } = await import(
    "../lib/admin/accessCore.ts"
  );
  const { createAdminAccessToken } = await import(
    "../lib/admin/accessSessionCore.ts"
  );
  const activeA = await adminAccessFixture();

  assert.equal(
    (await requireAdminRestaurantAccess("dashboard:read", activeA)).ok,
    true
  );
  assert.deepEqual(
    await requireAdminRestaurantAccess(
      "dish:availability:write",
      await adminAccessFixture({
        row: {
          id: "qr-fixture-a",
          restaurantId: "restaurant-fixture-b",
          targetKind: "admin",
          targetPath: "/admin",
          status: "active"
        }
      })
    ),
    { ok: false, reason: "revoked" }
  );
  assert.deepEqual(
    await requireAdminRestaurantAccess(
      "dashboard:read",
      await adminAccessFixture({
        row: {
          id: "qr-fixture-a",
          restaurantId: "restaurant-fixture-a",
          targetKind: "admin",
          targetPath: "/admin",
          status: "paused"
        }
      })
    ),
    { ok: false, reason: "revoked" }
  );

  const invalid = await adminAccessFixture();
  invalid.getCookieValue = () => "invalid.synthetic.session";
  assert.deepEqual(
    await requireAdminRestaurantAccess("dashboard:read", invalid),
    { ok: false, reason: "session" }
  );

  const expired = await adminAccessFixture();
  expired.getCookieValue = () =>
    createAdminAccessToken(
      {
        qrId: "qr-fixture-a",
        restaurantId: "restaurant-fixture-a",
        now: NOW - 28_800
      },
      SESSION_SECRET
    );
  assert.deepEqual(
    await requireAdminRestaurantAccess("dashboard:read", expired),
    { ok: false, reason: "session" }
  );
});

test("Supabase project identity rejects a cross-project deployment binding", async () => {
  const { validateSupabaseProjectIdentity } = await import(
    "../utils/supabase/projectIdentity.ts"
  );

  assert.deepEqual(
    validateSupabaseProjectIdentity({
      supabaseUrl: "https://previewfixtureproject.supabase.co",
      expectedProjectRef: "previewfixtureproject"
    }),
    { ok: true, projectRef: "previewfixtureproject" }
  );
  assert.deepEqual(
    validateSupabaseProjectIdentity({
      supabaseUrl: "https://productionfixtureproject.supabase.co",
      expectedProjectRef: "previewfixtureproject"
    }),
    {
      ok: false,
      reason: "Supabase project does not match the expected deployment project."
    }
  );
});

test("secret-bearing admin E2E disables retries and all Playwright artifacts", async () => {
  const { readFile } = await import("node:fs/promises");
  const [config, workflow] = await Promise.all([
    readFile("playwright.config.ts", "utf8"),
    readFile(".github/workflows/admin-restaurant-e2e.yml", "utf8")
  ]);

  assert.match(config, /VISTAIRE_ADMIN_E2E_SENSITIVE/);
  assert.match(config, /sensitiveAdminE2E\s*\?\s*0\s*:/);
  assert.match(config, /screenshot:\s*sensitiveAdminE2E\s*\?\s*"off"\s*:/);
  assert.match(config, /trace:\s*sensitiveAdminE2E\s*\?\s*"off"\s*:/);
  assert.match(config, /video:\s*"off"/);
  assert.match(config, /preserveOutput:\s*sensitiveAdminE2E\s*\?\s*"never"\s*:/);
  assert.match(workflow, /VISTAIRE_ADMIN_E2E_SENSITIVE:\s*["']1["']/);
  for (const tokenName of [
    "VISTAIRE_ADMIN_E2E_QR_TOKEN",
    "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN",
    "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN",
    "VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN"
  ]) {
    assert.match(
      workflow,
      new RegExp(`::add-mask::\\$${tokenName}`)
    );
  }
  assert.ok(
    workflow.indexOf("::add-mask::") <
      workflow.indexOf(
        "npx playwright test e2e/admin-restaurant-dashboard.spec.ts"
      ),
    "QR values must be masked before Playwright can log a /q/<token> URL"
  );
});
