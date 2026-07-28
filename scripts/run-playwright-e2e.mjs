import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import http from "node:http";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";
const OWNER_E2E_TOKEN = skipWebServer
  ? process.env.VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN ??
    randomBytes(32).toString("base64url")
  : randomBytes(32).toString("base64url");
const LOCAL_E2E_CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k";
const LOCAL_E2E_CLERK_SECRET_KEY =
  process.env.CLERK_SECRET_KEY ??
  "sk_test_Y2xlcmsuZXhhbXBsZS5jb20k";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;
const parsedBaseURL = new URL(baseURL);
const playwrightArgs = ["./node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)];
const useLocalDemoServer = process.argv
  .slice(2)
  .includes("e2e/ci-smoke.spec.ts");
const useTrouvableImmersiveFixture = process.argv
  .slice(2)
  .some((argument) =>
    argument.replaceAll("\\", "/").endsWith("e2e/trouvable-back-to-top-ar-handoff.spec.ts")
  );
const includesSaugeNoireBrowserFlow = process.argv
  .slice(2)
  .some((argument) =>
    /(?:^|\/)sauge-noire-[^/]+\.spec\.ts$/.test(argument.replaceAll("\\", "/"))
  );
const SAUGE_FIXTURE_ORIGIN = "http://127.0.0.1:55434";

function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", (error) => {
        if (Date.now() > deadline) {
          reject(error);
          return;
        }
        setTimeout(poll, 500);
      });

      request.setTimeout(2_000, () => {
        request.destroy();
      });
    };

    poll();
  });
}

function runChild(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      windowsHide: true,
      ...options
    });

    child.on("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function main() {
  let server = null;
  let saugeFixture = null;

  try {
    if (includesSaugeNoireBrowserFlow) {
      saugeFixture = spawn(
        process.execPath,
        ["e2e/support/sauge-noire-fixture-server.mjs"],
        {
          stdio: "inherit",
          windowsHide: true,
          env: { ...process.env, VISTAIRE_SAUGE_NOIRE_FIXTURE_PORT: "55434" }
        }
      );
      await waitForServer(`${SAUGE_FIXTURE_ORIGIN}/fixture/health`);
    }
    if (!skipWebServer) {
      const port = parsedBaseURL.port || (parsedBaseURL.protocol === "https:" ? "443" : "80");
      server = spawn(
        process.execPath,
        [
          "./node_modules/next/dist/bin/next",
          useLocalDemoServer ? "dev" : "start",
          "-p",
          port,
          "-H",
          "127.0.0.1"
        ],
        {
          stdio: "inherit",
          windowsHide: true,
          env: {
            ...process.env,
            ...(includesSaugeNoireBrowserFlow
              ? {
                  NEXT_PUBLIC_SUPABASE_URL: SAUGE_FIXTURE_ORIGIN,
                  SUPABASE_SERVICE_ROLE_KEY: "sauge-noire-fixture-service-role-key",
                  VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: ""
                }
              : {}),
            CLERK_SECRET_KEY: LOCAL_E2E_CLERK_SECRET_KEY,
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
              LOCAL_E2E_CLERK_PUBLISHABLE_KEY,
            VISTAIRE_OWNER_E2E_AUTH_BYPASS: "1",
            VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN: OWNER_E2E_TOKEN,
            VISTAIRE_OWNER_E2E_EMAIL: "owner-e2e@localhost",
            VISTAIRE_OWNER_3D_JOBS_FALLBACK: "1",
            VISTAIRE_OWNER_3D_RESTAURANT_SLUGS: "*",
            ...(useTrouvableImmersiveFixture
              ? { VISTAIRE_E2E_TROUVABLE_3D: "1" }
              : {})
          }
        }
      );

      await waitForServer(baseURL);
    }

    const exitCode = await runChild(process.execPath, playwrightArgs, {
      env: {
        ...process.env,
        PLAYWRIGHT_SKIP_WEB_SERVER: "1",
        PLAYWRIGHT_BASE_URL: baseURL,
        ...(includesSaugeNoireBrowserFlow ? { PLAYWRIGHT_INCLUDE_WEBKIT: "1" } : {}),
        VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN: OWNER_E2E_TOKEN
      }
    });

    process.exitCode = exitCode;
  } finally {
    if (server && !server.killed) {
      server.kill();
    }
    if (saugeFixture && !saugeFixture.killed) {
      saugeFixture.kill();
    }
  }
}

await main();
