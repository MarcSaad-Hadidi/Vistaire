/**
 * Wire built Meshy restaurant assets into Supabase menu_dishes metadata.
 *
 * Usage:
 *   node scripts/owner/sync-restaurant-meshy-dish.mjs \
 *     --restaurant trouvable \
 *     --dish dejeuner-classique-maison \
 *     --manifest public/models/restaurants/trouvable/principal/dejeuner-classique-maison/meshy-20260619/manifest.json
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const options = { restaurant: "", dish: "", manifest: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--restaurant") options.restaurant = argv[++index] ?? "";
    else if (arg.startsWith("--restaurant=")) options.restaurant = arg.split("=")[1] ?? "";
    else if (arg === "--dish") options.dish = argv[++index] ?? "";
    else if (arg.startsWith("--dish=")) options.dish = arg.split("=")[1] ?? "";
    else if (arg === "--manifest") options.manifest = argv[++index] ?? "";
    else if (arg.startsWith("--manifest=")) options.manifest = arg.split("=")[1] ?? "";
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/owner/sync-restaurant-meshy-dish.mjs --restaurant trouvable --dish dejeuner-classique-maison --manifest <path>"
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.restaurant || !options.dish || !options.manifest) {
    throw new Error("Required: --restaurant, --dish, --manifest");
  }
  return options;
}

function getMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value)
    : {};
}

async function main() {
  loadEnvLocal();
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = join(ROOT, options.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const assets = manifest.assets ?? {};
  if (!assets.webModel3dUrl || !assets.arUsdzUrl) {
    throw new Error("Manifest missing webModel3dUrl or arUsdzUrl.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Supabase sync."
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("id,slug,name")
    .eq("slug", options.restaurant)
    .maybeSingle();
  if (restaurantError) throw new Error(restaurantError.message);
  if (!restaurant) throw new Error(`Restaurant introuvable: ${options.restaurant}`);

  const { data: dish, error: dishError } = await client
    .from("menu_dishes")
    .select("id,slug,name,metadata")
    .eq("restaurant_id", restaurant.id)
    .eq("slug", options.dish)
    .maybeSingle();
  if (dishError) throw new Error(dishError.message);
  if (!dish) {
    throw new Error(
      `Plat introuvable pour ${options.restaurant}: ${options.dish}`
    );
  }

  const metadata = getMetadata(dish.metadata);
  const nextMetadata = {
    ...metadata,
    model3dUrl: assets.model3dUrl ?? assets.webModel3dUrl,
    webModel3dUrl: assets.webModel3dUrl,
    arModel3dUrl: assets.arModel3dUrl ?? "",
    arUsdzUrl: assets.arUsdzUrl,
    usdzUrl: "",
    modelStatus: "ready",
    meshyManifestVersion: manifest.version ?? "",
    meshyManifestPath: options.manifest.replace(/\\/g, "/")
  };

  const { error: updateError } = await client
    .from("menu_dishes")
    .update({
      has_immersive_view: true,
      metadata: nextMetadata
    })
    .eq("id", dish.id);
  if (updateError) throw new Error(updateError.message);

  console.log(`OK ${restaurant.name} / ${dish.name}`);
  console.log(JSON.stringify(nextMetadata, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
