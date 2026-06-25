import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));

/** Quick Look iOS attend souvent ce MIME pour les USDZ servis en HTTPS. */
const USDZ_MODEL_HEADERS = [
  { key: "Content-Type", value: "model/vnd.usdz+zip" },
  { key: "Content-Disposition", value: "inline" },
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
] as const;

const STATIC_ASSET_HEADERS = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
] as const;

const GLB_MODEL_HEADERS = [
  { key: "Content-Type", value: "model/gltf-binary" },
  ...STATIC_ASSET_HEADERS,
] as const;

const OWNER_MODEL_PIPELINE_ROUTES = [
  "/api/owner/restaurants/*/dishes/*/model/glb",
  "/api/owner/restaurants/*/dishes/*/model/publish",
] as const;

const OWNER_MODEL_PIPELINE_TRACE_INCLUDES = [
  "scripts/shared/gltf-transform-cli.mjs",
  "scripts/owner/build-restaurant-meshy-dish.mjs",
  "scripts/build-demo-ar-lite-assets.mjs",
  "scripts/build-ios-quicklook-ultra-assets.mjs",
  "scripts/optimize-usdz-binary-layers.py",
  "node_modules/@gltf-transform/cli/**/*",
  "node_modules/@gltf-transform/core/**/*",
  "node_modules/@gltf-transform/extensions/**/*",
  "node_modules/@gltf-transform/functions/**/*",
  "node_modules/@babylonjs/core/**/*",
  "node_modules/@babylonjs/loaders/**/*",
  "node_modules/@babylonjs/serializers/**/*",
  "node_modules/fflate/**/*",
  "node_modules/@donmccurdy/caporal/**/*",
  "node_modules/cli-table3/**/*",
  "node_modules/csv-stringify/**/*",
  "node_modules/draco3dgltf/**/*",
  "node_modules/gltf-validator/**/*",
  "node_modules/keyframe-resample/**/*",
  "node_modules/ktx-parse/**/*",
  "node_modules/language-tags/**/*",
  "node_modules/listr2/**/*",
  "node_modules/meshoptimizer/**/*",
  "node_modules/micromatch/**/*",
  "node_modules/mikktspace/**/*",
  "node_modules/node-fetch/**/*",
  "node_modules/p-limit/**/*",
  "node_modules/prompts/**/*",
  "node_modules/sharp/**/*",
  "node_modules/@img/**/*",
  "node_modules/tmp/**/*",
  "node_modules/watlas/**/*",
] as const;

const OWNER_MODEL_PIPELINE_TRACE_EXCLUDES = OWNER_MODEL_PIPELINE_ROUTES.reduce<
  NonNullable<NextConfig["outputFileTracingExcludes"]>
>((routes, route) => {
  routes[route] = ["public/**/*"];
  return routes;
}, {});

const OWNER_MODEL_PIPELINE_TRACE_INCLUDES_BY_ROUTE = OWNER_MODEL_PIPELINE_ROUTES.reduce<
  NonNullable<NextConfig["outputFileTracingIncludes"]>
>((routes, route) => {
  routes[route] = [...OWNER_MODEL_PIPELINE_TRACE_INCLUDES];
  return routes;
}, {});

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  outputFileTracingRoot: PROJECT_ROOT,
  outputFileTracingIncludes: OWNER_MODEL_PIPELINE_TRACE_INCLUDES_BY_ROUTE,
  outputFileTracingExcludes: OWNER_MODEL_PIPELINE_TRACE_EXCLUDES,
  turbopack: {
    root: PROJECT_ROOT,
  },
  images: {
    qualities: [75, 90, 92, 100],
  },
  async redirects() {
    return [
      {
        source: "/carte-vistaire",
        destination: "/demo",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/models/demo/:path*.usdz",
        headers: [...USDZ_MODEL_HEADERS],
      },
      {
        source: "/models/demo/:path*.glb",
        headers: [...GLB_MODEL_HEADERS],
      },
      {
        source: "/models/restaurants/:path*.usdz",
        headers: [...USDZ_MODEL_HEADERS],
      },
      {
        source: "/models/restaurants/:path*.glb",
        headers: [...GLB_MODEL_HEADERS],
      },
      {
        source: "/images/demo/:path*",
        headers: [...STATIC_ASSET_HEADERS],
      },
      {
        source: "/model-viewer/:path*.js",
        headers: [...STATIC_ASSET_HEADERS],
      },
    ];
  },
};

export default nextConfig;
