import assert from "node:assert/strict";
import test from "node:test";
import { runTrustedAdminE2EPreflight } from "../scripts/admin-e2e-trusted-preflight.mjs";

function validEnv() {
  return {
    PLAYWRIGHT_BASE_URL: "https://vistaire-git-qr-preview.vercel.app/",
    VISTAIRE_ADMIN_E2E_ENABLED: "true",
    VISTAIRE_ADMIN_E2E_BASE_URL: "https://vistaire-git-qr-preview.vercel.app/",
    VISTAIRE_ADMIN_E2E_EXPECTED_VERCEL_HOST: "vistaire-git-qr-preview.vercel.app",
    VISTAIRE_ADMIN_E2E_EXPECTED_REPOSITORY: "MarcSaad-Hadidi/Vistaire",
    VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH: "codex/qa-admin-qr-e2e",
    VISTAIRE_ADMIN_E2E_EXPECTED_COMMIT_SHA: "a".repeat(40),
    VISTAIRE_ADMIN_E2E_VERCEL_PROJECT_ID: "prj_fixture",
    VISTAIRE_ADMIN_E2E_VERCEL_TEAM_ID: "team_fixture",
    VISTAIRE_ADMIN_E2E_VERCEL_API_TOKEN: "vercel_api_fixture_token",
    VISTAIRE_ADMIN_E2E_SUPABASE_URL: "https://previewref123.supabase.co/",
    VISTAIRE_ADMIN_E2E_EXPECTED_SUPABASE_PROJECT_REF: "previewref123",
    VISTAIRE_ADMIN_E2E_RESTAURANT_NAME: "Vistaire E2E Restaurant A",
    VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME: "Vistaire E2E Restaurant B",
    VISTAIRE_ADMIN_E2E_QR_TOKEN: "PreviewToken_A_123",
    VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN: "PreviewToken_B_123",
    VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN: "PreviewToken_C_123",
    VISTAIRE_ADMIN_E2E_FALLBACK_QR_TOKEN: "PreviewToken_D_123"
  };
}

function readyDeployment(overrides = {}) {
  return {
    ok: true,
    async json() {
      return {
        readyState: "READY",
        target: "preview",
        url: "vistaire-git-qr-preview.vercel.app",
        alias: ["vistaire-git-qr-preview.vercel.app"],
        projectId: "prj_fixture",
        teamId: "team_fixture",
        gitRepo: {
          namespace: "MarcSaad-Hadidi",
          name: "Vistaire",
          repoId: 153
        },
        gitSource: {
          type: "github",
          ref: "codex/qa-admin-qr-e2e",
          sha: "a".repeat(40),
          repoId: 153
        },
        meta: {
          githubCommitRef: "codex/qa-admin-qr-e2e",
          githubCommitSha: "a".repeat(40)
        },
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://previewref123.supabase.co",
          VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "previewref123"
        },
        ...overrides
      };
    }
  };
}

function readyProject(overrides = {}) {
  return {
    ok: true,
    async json() {
      return {
        id: "prj_fixture",
        accountId: "team_fixture",
        link: {
          type: "github",
          org: "MarcSaad-Hadidi",
          repo: "Vistaire",
          repoId: 153
        },
        ...overrides
      };
    }
  };
}

function productionDeployment(overrides = {}) {
  return {
    ok: true,
    async json() {
      return {
        readyState: "READY",
        target: "production",
        projectId: "prj_fixture",
        teamId: "team_fixture",
        url: "vistaire-production-abc.vercel.app",
        alias: ["vistaire.ca", "www.vistaire.ca"],
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
          VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "productionref123"
        },
        ...overrides
      };
    }
  };
}

function trustedVercelFetch(
  deployment = readyDeployment(),
  project = readyProject(),
  production = productionDeployment()
) {
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/v9/projects/")) return project;
    if (parsed.pathname.endsWith("/vistaire.ca")) return production;
    return deployment;
  };
}

test("trusted preflight accepts an exact non-Production Preview binding", async () => {
  const result = await runTrustedAdminE2EPreflight(validEnv(), trustedVercelFetch());
  assert.deepEqual(result, {
    readyState: "READY",
    target: "preview",
    projectMatch: true,
    repositoryMatch: true,
    branchMatch: true,
    shaMatch: true,
    supabaseMatch: true
  });
});

test("trusted preflight rejects the authenticated Production Supabase ref", async () => {
  await assert.rejects(
    runTrustedAdminE2EPreflight(
      validEnv(),
      trustedVercelFetch(
        readyDeployment(),
        readyProject(),
        productionDeployment({
          env: {
            NEXT_PUBLIC_SUPABASE_URL: "https://previewref123.supabase.co",
            VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "previewref123"
          }
        })
      )
    ),
    /dedicated non-Production Preview project ref/
  );
});

test("trusted preflight rejects an incoherent Production Supabase URL or missing Production alias", async () => {
  for (const production of [
    productionDeployment({ alias: ["unrelated.example"] }),
    productionDeployment({
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://differentref123.supabase.co",
        VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "productionref123"
      }
    })
  ]) {
    await assert.rejects(
      runTrustedAdminE2EPreflight(
        validEnv(),
        trustedVercelFetch(readyDeployment(), readyProject(), production)
      ),
      /dedicated non-Production Preview project ref/
    );
  }
});

test("trusted preflight rejects tokens that are unsafe for URL and log masking", async () => {
  for (const token of ["unsafe token value", "unsafe%2Ftokenvalue", "unsafe\ntokenvalue"]) {
    const env = validEnv();
    env.VISTAIRE_ADMIN_E2E_QR_TOKEN = token;
    await assert.rejects(
      runTrustedAdminE2EPreflight(env, trustedVercelFetch()),
      /(?:URL-safe opaque values|one opaque token without whitespace)/
    );
  }
});

test("trusted preflight requires the exact controlled fixture names", async () => {
  const env = validEnv();
  env.VISTAIRE_ADMIN_E2E_RESTAURANT_NAME = "Trouvable";
  await assert.rejects(
    runTrustedAdminE2EPreflight(env, trustedVercelFetch()),
    /dedicated Restaurant A fixture/
  );
});

test("trusted preflight rejects a deployment from a fork or another repository", async () => {
  for (const gitRepo of [
    { namespace: "attacker", name: "Vistaire", repoId: 999 },
    { namespace: "MarcSaad-Hadidi", name: "Vistaire", repoId: 999 }
  ]) {
    await assert.rejects(
      runTrustedAdminE2EPreflight(
        validEnv(),
        trustedVercelFetch(readyDeployment({ gitRepo }))
      ),
      /(?:trusted non-fork repository|project repository binding)/
    );
  }
});

test("trusted preflight rejects team, host, and Production alias drift", async () => {
  for (const deployment of [
    readyDeployment({ teamId: "team_attacker" }),
    readyDeployment({ url: "other-preview.vercel.app" }),
    readyDeployment({ alias: ["vistaire.ca"] })
  ]) {
    await assert.rejects(
      runTrustedAdminE2EPreflight(validEnv(), trustedVercelFetch(deployment)),
      /(?:team|host|Production alias)/
    );
  }
});

test("trusted preflight verifies the Vercel project repository binding", async () => {
  await assert.rejects(
    runTrustedAdminE2EPreflight(
      validEnv(),
      trustedVercelFetch(
        readyDeployment(),
        readyProject({ link: { type: "github", org: "attacker", repo: "Vistaire", repoId: 999 } })
      )
    ),
    /project repository binding/
  );
});

test("trusted preflight rejects primary branches and an incorrect deployment SHA", async () => {
  for (const branch of ["main", "master", "production"]) {
    const env = validEnv();
    env.VISTAIRE_ADMIN_E2E_EXPECTED_GIT_BRANCH = branch;
    await assert.rejects(
      runTrustedAdminE2EPreflight(env, trustedVercelFetch()),
      /must be non-production/
    );
  }

  await assert.rejects(
    runTrustedAdminE2EPreflight(
      validEnv(),
      trustedVercelFetch(readyDeployment({
        gitSource: {
          type: "github",
          ref: "codex/qa-admin-qr-e2e",
          sha: "b".repeat(40),
          repoId: 153
        },
        meta: {}
      }))
    ),
    /exact commit/
  );
});

test("trusted preflight rejects an explicit Preview port and non-GitHub deployment source", async () => {
  const portEnv = validEnv();
  portEnv.PLAYWRIGHT_BASE_URL = "https://vistaire-git-qr-preview.vercel.app:444/";
  portEnv.VISTAIRE_ADMIN_E2E_BASE_URL = portEnv.PLAYWRIGHT_BASE_URL;
  await assert.rejects(
    runTrustedAdminE2EPreflight(portEnv, trustedVercelFetch()),
    /(?:credential-free HTTPS origin|exact non-production Vercel branch Preview)/
  );

  await assert.rejects(
    runTrustedAdminE2EPreflight(
      validEnv(),
      trustedVercelFetch(readyDeployment({
        gitSource: {
          type: "gitlab",
          ref: "codex/qa-admin-qr-e2e",
          sha: "a".repeat(40),
          repoId: 153
        }
      }))
    ),
    /trusted non-fork repository/
  );
});
