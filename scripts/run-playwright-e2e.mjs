import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
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
const rawArgs = process.argv.slice(2);
const buildRequested =
  rawArgs.includes("--build") || process.env.VISTAIRE_E2E_BUILD === "1";
const playwrightInputArgs = rawArgs.filter((argument) => argument !== "--build");
const playwrightArgs = [
  "./node_modules/@playwright/test/cli.js",
  "test",
  ...playwrightInputArgs
];
const useLocalDemoServer = playwrightInputArgs
  .includes("e2e/ci-smoke.spec.ts");
const useTrouvableImmersiveFixture = playwrightInputArgs
  .some((argument) =>
    argument.replaceAll("\\", "/").endsWith("e2e/trouvable-back-to-top-ar-handoff.spec.ts")
  );
const includesSaugeNoireBrowserFlow = playwrightInputArgs
  .some((argument) => {
    const normalized = argument.replaceAll("\\", "/");
    return (
      /(?:^|\/)sauge-noire-[^/]+\.spec\.ts$/.test(normalized) ||
      /(?:^|\/)landing-(?:redesign|production-photo)\.spec\.ts$/.test(normalized)
    );
  });
const requestsWebkit = playwrightInputArgs.some((argument) => argument === "--project=webkit");
const includesSeoSmoke = playwrightInputArgs
  .some((argument) =>
    /(?:^|\/)seo-smoke\.spec\.ts$/.test(argument.replaceAll("\\", "/"))
  );
const includesLandingProductionPhoto = playwrightInputArgs
  .some((argument) =>
    /(?:^|\/)landing-production-photo\.spec\.ts$/.test(
      argument.replaceAll("\\", "/")
    )
  );
const useDevelopmentServer =
  process.env.VISTAIRE_E2E_DEV_SERVER === "1" ||
  (useLocalDemoServer && process.env.CI !== "true") ||
  (process.env.CI !== "true" &&
    ((includesSaugeNoireBrowserFlow && !includesLandingProductionPhoto) ||
      (includesSeoSmoke && !includesLandingProductionPhoto)));
// The CI build is compiled against the hermetic Supabase endpoint because
// Next inlines NEXT_PUBLIC_* values into the production server bundle. Start
// the fixture for every production CI group, not only Sauge specs, so the
// shared .next artifact remains runnable for /demo and menu metadata checks.
const includesSaugeNoireFixture =
  includesSaugeNoireBrowserFlow ||
  (process.env.CI === "true" && !useDevelopmentServer);
const SAUGE_FIXTURE_ORIGIN = "http://127.0.0.1:55434";
const SAUGE_FIXTURE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: SAUGE_FIXTURE_ORIGIN,
  SUPABASE_SERVICE_ROLE_KEY: "sauge-noire-fixture-service-role-key",
  VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "",
  VISTAIRE_EXCHANGE_RATES_FIXTURE_JSON:
    '{"CAD":1,"USD":0.72,"EUR":0.6225}'
};
let activeChild = null;

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
    activeChild = child;

    child.on("exit", (code, signal) => {
      if (activeChild === child) activeChild = null;
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function hasProductionBuild() {
  try {
    await access(".next/BUILD_ID");
    return true;
  } catch {
    return false;
  }
}

function stopProcess(child) {
  if (!child || child.killed || child.exitCode !== null) return;

  if (process.platform === "win32") {
    child.kill();
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function main() {
  let server = null;
  let saugeFixture = null;
  const startedAt = Date.now();

  const stopChildren = () => {
    stopProcess(activeChild);
    stopProcess(server);
    stopProcess(saugeFixture);
  };
  const onTermination = () => {
    stopChildren();
  };
  process.once("SIGINT", onTermination);
  process.once("SIGTERM", onTermination);

  try {
    if (includesSaugeNoireFixture) {
      saugeFixture = spawn(
        process.execPath,
        ["e2e/support/sauge-noire-fixture-server.mjs"],
        {
          stdio: "inherit",
          windowsHide: true,
          detached: process.platform !== "win32",
          env: { ...process.env, VISTAIRE_SAUGE_NOIRE_FIXTURE_PORT: "55434" }
        }
      );
      await waitForServer(`${SAUGE_FIXTURE_ORIGIN}/fixture/health`);
    }

    if (buildRequested && !skipWebServer) {
      const buildExitCode = await runChild(
        process.execPath,
        ["./node_modules/next/dist/bin/next", "build"],
        {
          env: {
            ...process.env,
            ...SAUGE_FIXTURE_ENV
          }
        }
      );
      if (buildExitCode !== 0) {
        process.exitCode = buildExitCode;
        return;
      }
    }

    if (!skipWebServer) {
      if (!useDevelopmentServer && !(await hasProductionBuild())) {
        throw new Error(
          "A production E2E group requires .next/BUILD_ID. Run `npm run build` first or pass `--build` explicitly."
        );
      }

      const port = parsedBaseURL.port || (parsedBaseURL.protocol === "https:" ? "443" : "80");
      server = spawn(
        process.execPath,
        [
          "./node_modules/next/dist/bin/next",
          useDevelopmentServer ? "dev" : "start",
          ...(useDevelopmentServer ? ["--webpack"] : []),
          "-p",
          port,
          "-H",
          "127.0.0.1"
        ],
        {
          stdio: "inherit",
          windowsHide: true,
          detached: process.platform !== "win32",
          env: {
            ...process.env,
            ...(includesSaugeNoireFixture ? SAUGE_FIXTURE_ENV : {}),
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
        ...(requestsWebkit ? { PLAYWRIGHT_INCLUDE_WEBKIT: "1" } : {}),
        VISTAIRE_OWNER_E2E_AUTH_BYPASS_TOKEN: OWNER_E2E_TOKEN
      }
    });

    process.exitCode = exitCode;
  } finally {
    stopChildren();
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    console.log(`Playwright group completed in ${durationSeconds}s (specs: ${playwrightInputArgs.join(" ")})`);
    process.removeListener("SIGINT", onTermination);
    process.removeListener("SIGTERM", onTermination);
  }
}

await main();
