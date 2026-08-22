import fs from "node:fs";

function replaceExactly(path, before, after) {
  const source = fs.readFileSync(path, "utf8");
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${path}: expected one integration patch target, found ${occurrences}.`);
  }
  fs.writeFileSync(path, source.replace(before, after));
}

function replaceTailFromMarker(path, marker, replacement) {
  const source = fs.readFileSync(path, "utf8");
  const first = source.indexOf(marker);
  const last = source.lastIndexOf(marker);
  if (first < 0 || first !== last) {
    throw new Error(`${path}: expected one tail marker, found ${first < 0 ? 0 : 2}.`);
  }
  fs.writeFileSync(path, `${source.slice(0, first)}${replacement}`);
}

const packagePath = "package.json";
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const auditTestPath = "tests/supabase-usage-audit-safety.test.mjs";
const efficiencyKey = "test:supabase-efficiency-v2";
if (typeof pkg.scripts?.[efficiencyKey] !== "string") {
  throw new Error(`${efficiencyKey} is missing after integration.`);
}
if (!pkg.scripts[efficiencyKey].includes(auditTestPath)) {
  pkg.scripts[efficiencyKey] = `${pkg.scripts[efficiencyKey]} ${auditTestPath}`;
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

replaceExactly(
  "lib/landing/landingMenuUiPreview.ts",
  'from "./landingDishIdentity";',
  'from "./landingDishIdentity.ts";'
);

replaceExactly(
  "lib/landing/landingDishIdentity.ts",
  'from "../cache/publicCacheSafety";',
  'from "../cache/publicCacheSafety.ts";'
);

replaceExactly(
  "tests/helpers/owner-photo-route-runtime.mjs",
  `      "owner-photo-test:revalidation": \`
        export const revalidateOwnerMenuMutationPaths = async () => { globalThis.__OWNER_PHOTO_TEST__.events.push("revalidate"); };
      \``,
  `      "owner-photo-test:revalidation": \`
        export const resolvePublicMutationIdentity = async ({ restaurantId, dishId, dishSlug }) => {
          globalThis.__OWNER_PHOTO_TEST__.events.push("identity");
          return {
            restaurantId,
            restaurantSlug: "test-restaurant",
            restaurantKey: "test-restaurant",
            featuredExperienceId: null,
            dishId: dishId ?? "",
            dishSlug: dishSlug ?? ""
          };
        };
        export const invalidateCommittedPublicMutation = async () => {
          globalThis.__OWNER_PHOTO_TEST__.events.push("revalidate");
          return { attempted: 1, queuedCallReturned: 1, enqueueErrors: [] };
        };
        export const revalidateOwnerMenuMutationPaths = invalidateCommittedPublicMutation;
      \``
);

replaceExactly(
  "tests/menu-content-route-invalidation.test.mjs",
  'test("photo upload and delete invalidate after metadata commit, before cleanup, and catch cleanup throws", async () => {\n  for (const method of ["POST", "DELETE"]) {',
  'test("photo delete invalidates after metadata commit, before cleanup, and catches cleanup throws", async () => {\n  process.env.VISTAIRE_MEDIA_WRITES_ENABLED = "true";\n  process.env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF = "project-a";\n  for (const method of ["DELETE"]) {'
);

replaceTailFromMarker(
  "lib/owner/menuMutationRevalidation.ts",
  "export async function revalidateOwnerMenuMutationPaths(",
  `export async function revalidateOwnerMenuMutationPaths(
  args: {
    client: SupabaseClient;
    restaurantId: string;
    dishId?: string;
    dishSlug?: string;
  },
  dependencies: MenuMutationRevalidationDependencies = {}
): Promise<MenuMutationRevalidationResult> {
  const failures: MenuMutationRevalidationFailure[] = [];
  const invalidatedPaths: string[] = [];
  let invalidatedAssetMetadataEntries = 0;

  const invalidateAssetMetadata =
    dependencies.invalidateAssetMetadata ?? invalidatePublicDishAssetMetadataCache;
  try {
    invalidatedAssetMetadataEntries = invalidateAssetMetadata({
      restaurantId: args.restaurantId,
      ...(args.dishId ? { dishId: args.dishId } : {})
    });
  } catch {
    recordFailure(failures, "asset-metadata-invalidation");
  }

  if (dependencies.revalidateMenuCache) {
    try {
      const byRestaurant = await dependencies.revalidateMenuCache({
        restaurantId: args.restaurantId
      });
      if (!byRestaurant.ok) recordFailure(failures, "restaurant-cache");
    } catch {
      recordFailure(failures, "restaurant-cache");
    }
  }

  const identity = await resolvePublicMutationIdentity(args);
  if (!identity) {
    recordFailure(failures, "restaurant-lookup");
    await emitMenuMutationRetrySignal(
      {
        kind: "menu-revalidation-retry-required",
        restaurantId: args.restaurantId,
        ...(args.dishId ? { dishId: args.dishId } : {})
      },
      dependencies.signalRetry
    );
    return {
      ok: false,
      retryRequired: true,
      restaurantSlug: null,
      invalidatedAssetMetadataEntries,
      invalidatedPaths,
      failures
    };
  }

  const restaurantSlug = identity.restaurantSlug;
  const dishSlug = identity.dishSlug;

  if (dependencies.revalidateMenuCache) {
    try {
      const bySlug = await dependencies.revalidateMenuCache({
        slug: restaurantSlug,
        restaurantId: args.restaurantId
      });
      if (!bySlug.ok) recordFailure(failures, "slug-cache");
    } catch {
      recordFailure(failures, "slug-cache");
    }
  }

  const menuPath = `/menu/${restaurantSlug}`;
  const dishPath = dishSlug
    ? `/menu/${restaurantSlug}/dishes/${dishSlug}`
    : "";
  const schedulePath = dependencies.revalidatePath ?? revalidatePath;
  const scheduleTag = dependencies.revalidateTag ?? revalidateTag;

  const report = await invalidateCommittedPublicMutation(identity, {
    callbacks: {
      revalidateTag: scheduleTag,
      revalidatePath: async (path) => {
        await schedulePath(path);
        if (path === menuPath || (dishPath && path === dishPath)) {
          invalidatedPaths.push(path);
        }
      }
    },
    invalidateAssetMetadata: () => 0,
    emitRetrySignal: false
  });

  if (report.enqueueErrors.some((error) => error.kind === "path")) {
    recordFailure(failures, "path-revalidation");
  }
  if (report.enqueueErrors.some((error) => error.kind === "tag")) {
    recordFailure(failures, "slug-cache");
  }

  if (failures.length > 0) {
    await emitMenuMutationRetrySignal(
      {
        kind: "menu-revalidation-retry-required",
        restaurantId: args.restaurantId,
        ...(args.dishId ? { dishId: args.dishId } : {})
      },
      dependencies.signalRetry
    );
  }

  return {
    ok: failures.length === 0,
    retryRequired: failures.length > 0,
    restaurantSlug,
    invalidatedAssetMetadataEntries,
    invalidatedPaths,
    failures
  };
}
`
);
