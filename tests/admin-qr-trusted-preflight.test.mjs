import assert from "node:assert/strict";
import test from "node:test";
import { runTrustedAdminE2EPreflight } from "../scripts/admin-e2e-trusted-preflight.mjs";

function validEnv() {
  return {
    PLAYWRIGHT_BASE_URL: "https://vistaire-git-qr-preview.vercel.app/",
    VISTAIRE_ADMIN_E2E_ENABLED: "true",
    VISTAIRE_ADMIN_E2E_BASE_URL: "https://vistaire-git-qr-preview.vercel.app/",
    VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST: "vistaire-git-qr-preview.vercel.app",
    VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH: "codex/qa-admin-qr-e2e",
    VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA: "a".repeat(40),
    VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID: "prj_fixture",
    VISTAIRE_ADMIN_E2E_VERCEL_TEAM_ID: "team_fixture",
    VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN: "vercel_api_fixture_token",
    VISTAIRE_ADMIN_E2E_SUPABASE_URL: "https://previewref123.supabase.co/",
    VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF: "previewref123",
    VISTAIRE_ADMIN_E2E_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    VISTAIRE_ADMIN_E2E_RESTAURANT_NAME: "Vistaire E2E Restaurant A",
    VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME: "Vistaire E2E Restaurant B",
    VISTAIRE_ADMIN_E2E_QR_TOKEN: "PreviewToken_A_123",
    VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN: "PreviewToken_B_123",
    VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN: "PreviewToken_C_123",
    VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN: "PreviewToken_D_123"
  };
}

function readyDeployment() {
  return {
    ok: true,
    async json() {
      return {
        readyState: "READY",
        target: "preview",
        projectId: "prj_fixture",
        meta: {
          githubCommitRef: "codex/qa-admin-qr-e2e",
          githubCommitSha: "a".repeat(40)
        },
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://previewref123.supabase.co",
          VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "previewref123"
        }
      };
    }
  };
}

test("trusted preflight accepts an exact non-Production Preview binding", async () => {
  const result = await runTrustedAdminE2EPreflight(validEnv(), async () => readyDeployment());
  assert.deepEqual(result, {
    branch: "codex/qa-admin-qr-e2e",
    sha: "a".repeat(40),
    projectId: "prj_fixture",
    readyState: "READY",
    target: "preview"
  });
});

test("trusted preflight rejects a self-declared Production Supabase ref", async () => {
  const env = validEnv();
  env.VISTAIRE_ADMIN_E2E_PRODUCTION_SUPABASE_PROJECT_REF =
    env.VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF;
  await assert.rejects(
    runTrustedAdminE2EPreflight(env, async () => readyDeployment()),
    /dedicated non-Production Preview project ref/
  );
});

test("trusted preflight rejects tokens that are unsafe for URL and log masking", async () => {
  for (const token of ["unsafe token value", "unsafe%2Ftokenvalue", "unsafe\ntokenvalue"]) {
    const env = validEnv();
    env.VISTAIRE_ADMIN_E2E_QR_TOKEN = token;
    await assert.rejects(
      runTrustedAdminE2EPreflight(env, async () => readyDeployment()),
      /(?:URL-safe opaque values|one opaque token without whitespace)/
    );
  }
});

test("trusted preflight requires the exact controlled fixture names", async () => {
  const env = validEnv();
  env.VISTAIRE_ADMIN_E2E_RESTAURANT_NAME = "Trouvable";
  await assert.rejects(
    runTrustedAdminE2EPreflight(env, async () => readyDeployment()),
    /dedicated Restaurant A fixture/
  );
});
