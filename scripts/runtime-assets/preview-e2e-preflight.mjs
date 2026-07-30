const REQUIRED_EXACT = [
  ["VISTAIRE_RUNTIME_E2E", "1"],
  ["PLAYWRIGHT_SKIP_WEB_SERVER", "1"]
];
const REQUIRED_VALUES = [
  "PLAYWRIGHT_BASE_URL",
  "VISTAIRE_RUNTIME_DISH_PATH",
  "VISTAIRE_RUNTIME_DISH_ID",
  "VISTAIRE_RUNTIME_ASSET_VERSION",
  "VISTAIRE_RUNTIME_STORAGE_HOST"
];

const missing = [
  ...REQUIRED_EXACT
    .filter(([name, value]) => process.env[name] !== value)
    .map(([name, value]) => `${name}=${value}`),
  ...REQUIRED_VALUES.filter((name) => !process.env[name]?.trim())
];

const baseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
let invalidBaseUrl = false;
if (baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    const hostname = parsed.hostname.toLowerCase();
    invalidBaseUrl =
      parsed.protocol !== "https:" ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "[::1]" ||
      hostname === "::1" ||
      hostname.startsWith("127.");
  } catch {
    invalidBaseUrl = true;
  }
}

if (missing.length > 0 || invalidBaseUrl) {
  const invalid = invalidBaseUrl
    ? [...missing, "PLAYWRIGHT_BASE_URL (absolute HTTPS non-loopback URL)"]
    : missing;
  console.error(
    `Missing or invalid runtime Preview E2E configuration: ${invalid.join(", ")}`
  );
  process.exitCode = 2;
}
