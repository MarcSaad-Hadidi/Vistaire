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

if (missing.length > 0) {
  console.error(
    `Missing runtime Preview E2E configuration: ${missing.join(", ")}`
  );
  process.exitCode = 2;
}
