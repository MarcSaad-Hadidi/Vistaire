import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import http from "node:http";
import { maisonRestaurantId } from "../e2e/support/sauge-noire-fixture-data.mjs";

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
const useMaisonPublicMenuFixture = playwrightInputArgs.some((argument) =>
  argument
    .replaceAll("\\", "/")
    .endsWith("e2e/maison-elyse-public-menu.spec.ts")
);
const includesSaugeNoireBrowserFlow = playwrightInputArgs
  .some((argument) => {
    const normalized = argument.replaceAll("\\", "/");
    return (
      /(?:^|\/)sauge-noire-[^/]+\.spec\.ts$/.test(normalized) ||
      /(?:^|\/)demo-restaurant-experiences\.spec\.ts$/.test(normalized) ||
      /(?:^|\/)seo-interactive-showcases\.spec\.ts$/.test(normalized) ||
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
const useAdminVisualFixture = process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE === "1";
const useDevelopmentServer =
  process.env.VISTAIRE_E2E_DEV_SERVER === "1" ||
  useAdminVisualFixture ||
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
  NEXT_PUBLIC_DEMO_RESTAURANT_ID: maisonRestaurantId,
  VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF: "",
  VISTAIRE_EXCHANGE_RATES_FIXTURE_JSON:
    '{"CAD":1,"USD":0.72,"EUR":0.6225}'
};
const ADMIN_FIXTURE_PORT = process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT ?? "3110";
const ADMIN_FIXTURE_ORIGIN = `http://127.0.0.1:${ADMIN_FIXTURE_PORT}`;
const ADMIN_FIXTURE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: ADMIN_FIXTURE_ORIGIN,
  SUPABASE_SERVICE_ROLE_KEY: "visual-fixture-service-role-key",
  NEXT_PUBLIC_DEMO_RESTAURANT_ID: "11111111-1111-1111-1111-111111111111",
  VISTAIRE_ADMIN_VISUAL_NOW: "2026-07-10T12:00:00.000Z",
  VISTAIRE_LOCAL_PREVIEW_SECRET: "admin-visual-fixture-preview-secret-2026"
};
let activeChild = null;

function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    let settled = false;
    let retryTimer = null;
    const retry = (error) => {
      if (settled || retryTimer) return;
      if (Date.now() > deadline) {
        settled = true;
        reject(error);
        return;
      }
      retryTimer = setTimeout(() => {
        retryTimer = null;
        poll();
      }, 500);
    };
    const poll = () => {
      const request = http.get(url, (response) => {
        response.once("error", retry);
        response.once("aborted", () => retry(new Error(`Response aborted while waiting for ${url}`)));
        response.once("end", () => {
          if (settled) return;
          settled = true;
          resolve();
        });
        response.resume();
      });

      request.once("error", retry);

      request.setTimeout(2_000, () => {
        request.destroy(new Error(`Timed out waiting for ${url}`));
      });
    };

    poll();
  });
}

function isServerAvailable(url) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      resolve(available);
    };
    const request = http.get(url, (response) => {
      response.once("error", () => finish(false));
      response.once("aborted", () => finish(false));
      response.once("end", () => finish(true));
      response.resume();
    });
    request.once("error", () => finish(false));
    request.setTimeout(1_000, () => {
      request.destroy(new Error(`Timed out checking ${url}`));
    });
  });
}

function waitForExit(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once("exit", onExit);
  });
}

async function waitForServerStop(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isServerAvailable(url))) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
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

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    const taskkill = spawn(
      "taskkill.exe",
      ["/pid", String(child.pid), "/T", "/F"],
      { stdio: "ignore", windowsHide: true }
    );
    if (!(await waitForExit(taskkill, 10_000))) taskkill.kill();
    if (!(await waitForExit(child, 3_000))) child.kill();
    await waitForExit(child, 2_000);
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  if (await waitForExit(child, 5_000)) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
  await waitForExit(child, 2_000);
}

async function main() {
  let server = null;
  let saugeFixture = null;
  let adminFixture = null;
  const startedAt = Date.now();

  const stopChildren = async () => {
    await stopProcess(activeChild);
    await stopProcess(server);
    await stopProcess(adminFixture);
    await stopProcess(saugeFixture);
  };
  const onTermination = () => {
    void stopChildren();
  };
  process.once("SIGINT", onTermination);
  process.once("SIGTERM", onTermination);

  try {
    if (useAdminVisualFixture) {
      if (
        (await isServerAvailable(`${ADMIN_FIXTURE_ORIGIN}/rest/v1/restaurants`)) ||
        (await isServerAvailable(baseURL))
      ) {
        throw new Error(
          `Admin E2E requires unused fixture and app ports (${ADMIN_FIXTURE_PORT}, ${parsedBaseURL.port || "80"}).`
        );
      }
      adminFixture = spawn(
        process.execPath,
        ["e2e/support/admin-visual-fixture-server.mjs"],
        {
          stdio: "inherit",
          windowsHide: true,
          detached: process.platform !== "win32",
          env: {
            ...process.env,
            VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT: ADMIN_FIXTURE_PORT
          }
        }
      );
      await waitForServer(`${ADMIN_FIXTURE_ORIGIN}/rest/v1/restaurants`, 30_000);
    }

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
            ...(useAdminVisualFixture ? ADMIN_FIXTURE_ENV : {}),
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
              : {}),
            ...(useMaisonPublicMenuFixture
              ? { VISTAIRE_E2E_MAISON_PUBLIC_MENU: "1" }
              : {})
          }
        }
      );

      await waitForServer(baseURL);
      if (useAdminVisualFixture) {
        for (const route of ["/admin", "/admin/availability", "/menu/maison-elyse"]) {
          await waitForServer(new URL(route, baseURL).toString());
        }
      }
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
    await stopChildren();
    if (useAdminVisualFixture) {
      const [fixtureStopped, appStopped] = await Promise.all([
        waitForServerStop(`${ADMIN_FIXTURE_ORIGIN}/rest/v1/restaurants`),
        waitForServerStop(baseURL)
      ]);
      if (!fixtureStopped || !appStopped) {
        console.error("Admin E2E teardown left a fixture or app listener running.");
        process.exitCode = 1;
      }
    }
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    console.log(`Playwright group completed in ${durationSeconds}s (specs: ${playwrightInputArgs.join(" ")})`);
    process.removeListener("SIGINT", onTermination);
    process.removeListener("SIGTERM", onTermination);
  }
}

await main();
