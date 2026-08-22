import fs from "node:fs";

function replaceExactly(path, before, after) {
  const source = fs.readFileSync(path, "utf8");
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${path}: expected one integration patch target, found ${occurrences}.`);
  }
  fs.writeFileSync(path, source.replace(before, after));
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
