import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CONTROLLED_ADMIN_E2E_FIXTURES = Object.freeze({
  restaurantA: "Vistaire E2E Restaurant A",
  restaurantB: "Vistaire E2E Restaurant B"
});

const REQUIRED_SECRET_NAMES = [
  "VISTAIRE_ADMIN_E2E_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_OTHER_QR_TOKEN",
  "VISTAIRE_ADMIN_E2E_SUSPENDED_QR_TOKEN"
];

function fail(message) {
  throw new Error(`[admin-e2e fixture contract] ${message}`);
}

function parsePreviewUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} must be a valid HTTPS URL.`);
  }

  if (url.protocol !== "https:") {
    fail(`${name} must use HTTPS.`);
  }
  if (url.username || url.password) {
    fail(`${name} must not contain URL credentials.`);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "vistaire.ca" ||
    hostname.endsWith(".vistaire.ca")
  ) {
    fail(`${name} must target a controlled preview, never the production client.`);
  }

  return url;
}

export function validateControlledAdminE2EContract(env = process.env) {
  if (env.VISTAIRE_ADMIN_E2E_ENABLED !== "true") {
    fail("VISTAIRE_ADMIN_E2E_ENABLED must be exactly true.");
  }

  const baseUrl = parsePreviewUrl(
    requiredFrom(env, "VISTAIRE_ADMIN_E2E_BASE_URL"),
    "VISTAIRE_ADMIN_E2E_BASE_URL"
  );
  const playwrightBaseUrl = env.PLAYWRIGHT_BASE_URL;
  if (playwrightBaseUrl) {
    const playwrightUrl = parsePreviewUrl(playwrightBaseUrl, "PLAYWRIGHT_BASE_URL");
    if (playwrightUrl.origin !== baseUrl.origin) {
      fail("PLAYWRIGHT_BASE_URL must match VISTAIRE_ADMIN_E2E_BASE_URL.");
    }
  }

  const restaurantA = requiredFrom(env, "VISTAIRE_ADMIN_E2E_RESTAURANT_NAME");
  const restaurantB = requiredFrom(env, "VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME");
  if (restaurantA !== CONTROLLED_ADMIN_E2E_FIXTURES.restaurantA) {
    fail("VISTAIRE_ADMIN_E2E_RESTAURANT_NAME must name the dedicated Restaurant A fixture.");
  }
  if (restaurantB !== CONTROLLED_ADMIN_E2E_FIXTURES.restaurantB) {
    fail("VISTAIRE_ADMIN_E2E_OTHER_RESTAURANT_NAME must name the dedicated Restaurant B fixture.");
  }
  if (/trouvable|client|production|demo/i.test(`${restaurantA} ${restaurantB}`)) {
    fail("fixture names must not identify a client or demo restaurant.");
  }

  const tokens = REQUIRED_SECRET_NAMES.map((name) => validateSecretFrom(env, name));
  if (new Set(tokens).size !== tokens.length) {
    fail("active A, active B, and suspended QR tokens must be distinct.");
  }

  return {
    baseOrigin: baseUrl.origin,
    restaurantA,
    restaurantB,
    secretNames: [...REQUIRED_SECRET_NAMES]
  };
}

function requiredFrom(env, name) {
  const value = env[name];
  if (!value || !value.trim()) fail(`${name} is required.`);
  return value;
}

function validateSecretFrom(env, name) {
  const value = requiredFrom(env, name);
  if (value.trim() !== value || /\s/.test(value)) {
    fail(`${name} must be one opaque token without whitespace.`);
  }
  if (value.length < 16) {
    fail(`${name} is shorter than the controlled QR token minimum.`);
  }
  if (/trouvable|demo|production/i.test(value)) {
    fail(`${name} has a forbidden client/demo marker.`);
  }
  return value;
}

function run() {
  const contract = validateControlledAdminE2EContract();
  console.log(
    `Controlled admin E2E contract valid for ${contract.restaurantA} and ${contract.restaurantB} at ${contract.baseOrigin}. QR values were not printed.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Admin E2E fixture contract failed.");
    process.exitCode = 1;
  }
}
