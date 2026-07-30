#!/usr/bin/env node

import {
  formatRuntimeAssetReport,
  validateRuntimeAssetPreview
} from "./runtime-assets/preview-validator.mjs";

const FLAG_TO_KEY = new Map([
  ["--base-url", "baseUrl"],
  ["--dish-id", "dishId"],
  ["--asset-version", "assetVersion"],
  ["--expected-storage-host", "expectedStorageHost"],
  ["--photo-url", "photoUrl"],
  ["--glb-url", "glbUrl"],
  ["--usdz-url", "usdzUrl"],
  ["--missing-asset-url", "missingAssetUrl"],
  ["--timeout-ms", "timeoutMs"]
]);

const HELP = `Validate Vistaire runtime asset redirects against a read-only Preview.

Usage:
  node scripts/validate-runtime-asset-preview.mjs \\
    --base-url https://preview.example \\
    --dish-id <public-dish-id> \\
    --asset-version <version> \\
    --expected-storage-host <project>.supabase.co \\
    [--missing-asset-url /api/public/menu-dishes/<missing-id>/photo] [--json]

Environment equivalents:
  VISTAIRE_RUNTIME_BASE_URL
  VISTAIRE_RUNTIME_DISH_ID
  VISTAIRE_RUNTIME_ASSET_VERSION
  VISTAIRE_RUNTIME_STORAGE_HOST
  VISTAIRE_RUNTIME_PHOTO_URL
  VISTAIRE_RUNTIME_GLB_URL
  VISTAIRE_RUNTIME_USDZ_URL
  VISTAIRE_RUNTIME_MISSING_ASSET_URL
  VISTAIRE_RUNTIME_TIMEOUT_MS

Only unsigned public Vistaire URLs are accepted as inputs. Signed Storage Location
queries are discovered from 307 responses and redacted from all output.`;

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      values.help = true;
      continue;
    }
    if (argument === "--json") {
      values.json = true;
      continue;
    }
    const key = FLAG_TO_KEY.get(argument);
    if (!key) throw new TypeError("unknown option");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new TypeError(`${argument} requires a value`);
    }
    values[key] = value;
    index += 1;
  }
  return values;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== "");
}

function createOptions(cli, env) {
  const timeoutRaw = firstDefined(cli.timeoutMs, env.VISTAIRE_RUNTIME_TIMEOUT_MS);
  const assetUrls = {
    photo: firstDefined(cli.photoUrl, env.VISTAIRE_RUNTIME_PHOTO_URL),
    glb: firstDefined(cli.glbUrl, env.VISTAIRE_RUNTIME_GLB_URL),
    usdz: firstDefined(cli.usdzUrl, env.VISTAIRE_RUNTIME_USDZ_URL)
  };
  for (const key of Object.keys(assetUrls)) {
    if (!assetUrls[key]) delete assetUrls[key];
  }
  return {
    baseUrl: firstDefined(cli.baseUrl, env.VISTAIRE_RUNTIME_BASE_URL),
    dishId: firstDefined(cli.dishId, env.VISTAIRE_RUNTIME_DISH_ID),
    assetVersion: firstDefined(
      cli.assetVersion,
      env.VISTAIRE_RUNTIME_ASSET_VERSION
    ),
    expectedStorageHost: firstDefined(
      cli.expectedStorageHost,
      env.VISTAIRE_RUNTIME_STORAGE_HOST
    ),
    missingAssetUrl: firstDefined(
      cli.missingAssetUrl,
      env.VISTAIRE_RUNTIME_MISSING_ASSET_URL
    ),
    assetUrls,
    ...(timeoutRaw === undefined ? {} : { timeoutMs: Number(timeoutRaw) })
  };
}

async function main() {
  let cli;
  try {
    cli = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR ${error instanceof Error ? error.message : "invalid arguments"}`);
    console.error("Run with --help for usage.");
    process.exitCode = 2;
    return;
  }

  if (cli.help) {
    console.log(HELP);
    return;
  }

  try {
    const result = await validateRuntimeAssetPreview(createOptions(cli, process.env));
    console.log(cli.json ? JSON.stringify(result, null, 2) : formatRuntimeAssetReport(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(
      `ERROR ${error instanceof Error ? error.message : "validation could not start"}`
    );
    process.exitCode = 2;
  }
}

await main();
