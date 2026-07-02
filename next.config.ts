import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import {
  DEFAULT_MODEL_LAB_INSPECTION_MAX_BYTES,
  DEFAULT_MODEL_LAB_OPTIMIZATION_MAX_BYTES,
  MODEL_LAB_MULTIPART_OVERHEAD_BYTES,
  parseModelLabInspectionMaxBytes,
  parseModelLabOptimizationMaxBytes
} from "./lib/owner/modelLab/modelLabLimits.ts";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const MODEL_LAB_INSPECTION_LIMIT_FOR_PROXY = parseModelLabInspectionMaxBytes(process.env);
const MODEL_LAB_OPTIMIZATION_LIMIT_FOR_PROXY = parseModelLabOptimizationMaxBytes(process.env);
const MODEL_LAB_PROXY_CLIENT_MAX_BODY_SIZE =
  Math.max(
    MODEL_LAB_INSPECTION_LIMIT_FOR_PROXY.ok
      ? MODEL_LAB_INSPECTION_LIMIT_FOR_PROXY.maxBytes
      : DEFAULT_MODEL_LAB_INSPECTION_MAX_BYTES,
    MODEL_LAB_OPTIMIZATION_LIMIT_FOR_PROXY.ok
      ? MODEL_LAB_OPTIMIZATION_LIMIT_FOR_PROXY.maxBytes
      : DEFAULT_MODEL_LAB_OPTIMIZATION_MAX_BYTES
  ) + MODEL_LAB_MULTIPART_OVERHEAD_BYTES;

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
  "/api/owner/model-lab/optimize",
] as const;

const OWNER_MODEL_PIPELINE_SCRIPT_TRACE_INCLUDES = [
  "lib/owner/modelLab/optimizeWorker.mjs",
  "scripts/shared/gltf-transform-cli.mjs",
  "scripts/shared/ios-quicklook-promotion.mjs",
  "scripts/owner/build-restaurant-meshy-dish.mjs",
  "scripts/build-demo-ar-lite-assets.mjs",
  "scripts/build-ios-quicklook-ultra-assets.mjs",
  "scripts/optimize-usdz-binary-layers.py",
] as const;

const OWNER_MODEL_PIPELINE_PACKAGE_TRACE_INCLUDES = [
  // The owner pipeline runs as child Node processes, so Next cannot infer these imports.
  // Keep this as the package-lock dependency closure for the runtime script/toolchain roots.
  "node_modules/@babylonjs/**/*",
  "node_modules/@colors/**/*",
  "node_modules/@dabh/**/*",
  "node_modules/@donmccurdy/**/*",
  "node_modules/@emnapi/**/*",
  "node_modules/@gltf-transform/**/*",
  "node_modules/@img/**/*",
  "node_modules/@isaacs/**/*",
  "node_modules/@pkgjs/**/*",
  "node_modules/@so-ric/**/*",
  "node_modules/@types/**/*",
  "node_modules/ajv/**/*",
  "node_modules/ansi-escapes/**/*",
  "node_modules/ansi-regex/**/*",
  "node_modules/ansi-styles/**/*",
  "node_modules/astral-regex/**/*",
  "node_modules/async/**/*",
  "node_modules/asynckit/**/*",
  "node_modules/babylonjs-gltf2interface/**/*",
  "node_modules/balanced-match/**/*",
  "node_modules/brace-expansion/**/*",
  "node_modules/braces/**/*",
  "node_modules/call-bind-apply-helpers/**/*",
  "node_modules/cli-cursor/**/*",
  "node_modules/cli-table3/**/*",
  "node_modules/cli-truncate/**/*",
  "node_modules/color/**/*",
  "node_modules/color-convert/**/*",
  "node_modules/color-name/**/*",
  "node_modules/color-string/**/*",
  "node_modules/colorette/**/*",
  "node_modules/combined-stream/**/*",
  "node_modules/concat-map/**/*",
  "node_modules/cross-spawn/**/*",
  "node_modules/csv-stringify/**/*",
  "node_modules/cwise-compiler/**/*",
  "node_modules/data-uri-to-buffer/**/*",
  "node_modules/delayed-stream/**/*",
  "node_modules/detect-libc/**/*",
  "node_modules/draco3dgltf/**/*",
  "node_modules/dunder-proto/**/*",
  "node_modules/eastasianwidth/**/*",
  "node_modules/emoji-regex/**/*",
  "node_modules/enabled/**/*",
  "node_modules/environment/**/*",
  "node_modules/es-define-property/**/*",
  "node_modules/es-errors/**/*",
  "node_modules/es-object-atoms/**/*",
  "node_modules/es-set-tostringtag/**/*",
  "node_modules/eventemitter3/**/*",
  "node_modules/fast-deep-equal/**/*",
  "node_modules/fast-json-stable-stringify/**/*",
  "node_modules/fecha/**/*",
  "node_modules/fetch-blob/**/*",
  "node_modules/fflate/**/*",
  "node_modules/fill-range/**/*",
  "node_modules/fn.name/**/*",
  "node_modules/foreground-child/**/*",
  "node_modules/form-data/**/*",
  "node_modules/formdata-polyfill/**/*",
  "node_modules/function-bind/**/*",
  "node_modules/get-east-asian-width/**/*",
  "node_modules/get-intrinsic/**/*",
  "node_modules/get-proto/**/*",
  "node_modules/glob/**/*",
  "node_modules/gltf-validator/**/*",
  "node_modules/gopd/**/*",
  "node_modules/has-flag/**/*",
  "node_modules/has-symbols/**/*",
  "node_modules/has-tostringtag/**/*",
  "node_modules/hasown/**/*",
  "node_modules/inherits/**/*",
  "node_modules/iota-array/**/*",
  "node_modules/is-buffer/**/*",
  "node_modules/is-fullwidth-code-point/**/*",
  "node_modules/is-number/**/*",
  "node_modules/is-stream/**/*",
  "node_modules/isexe/**/*",
  "node_modules/jackspeak/**/*",
  "node_modules/json-schema-traverse/**/*",
  "node_modules/keyframe-resample/**/*",
  "node_modules/kleur/**/*",
  "node_modules/ktx-parse/**/*",
  "node_modules/kuler/**/*",
  "node_modules/language-subtag-registry/**/*",
  "node_modules/language-tags/**/*",
  "node_modules/listr2/**/*",
  "node_modules/lodash/**/*",
  "node_modules/log-update/**/*",
  "node_modules/logform/**/*",
  "node_modules/math-intrinsics/**/*",
  "node_modules/meshoptimizer/**/*",
  "node_modules/micromatch/**/*",
  "node_modules/mikktspace/**/*",
  "node_modules/mime-db/**/*",
  "node_modules/mime-types/**/*",
  "node_modules/mimic-function/**/*",
  "node_modules/minipass/**/*",
  "node_modules/ms/**/*",
  "node_modules/ndarray/**/*",
  "node_modules/ndarray-lanczos/**/*",
  "node_modules/ndarray-ops/**/*",
  "node_modules/ndarray-pixels/**/*",
  "node_modules/node-domexception/**/*",
  "node_modules/node-fetch/**/*",
  "node_modules/one-time/**/*",
  "node_modules/onetime/**/*",
  "node_modules/package-json-from-dist/**/*",
  "node_modules/path-key/**/*",
  "node_modules/path-scurry/**/*",
  "node_modules/picomatch/**/*",
  "node_modules/prompts/**/*",
  "node_modules/property-graph/**/*",
  "node_modules/punycode/**/*",
  "node_modules/readable-stream/**/*",
  "node_modules/restore-cursor/**/*",
  "node_modules/rfdc/**/*",
  "node_modules/safe-buffer/**/*",
  "node_modules/safe-stable-stringify/**/*",
  "node_modules/sharp/**/*",
  "node_modules/shebang-command/**/*",
  "node_modules/shebang-regex/**/*",
  "node_modules/signal-exit/**/*",
  "node_modules/sisteransi/**/*",
  "node_modules/slice-ansi/**/*",
  "node_modules/stack-trace/**/*",
  "node_modules/string-width/**/*",
  "node_modules/string-width-cjs/**/*",
  "node_modules/string_decoder/**/*",
  "node_modules/strip-ansi/**/*",
  "node_modules/strip-ansi-cjs/**/*",
  "node_modules/supports-color/**/*",
  "node_modules/table/**/*",
  "node_modules/text-hex/**/*",
  "node_modules/tmp/**/*",
  "node_modules/to-regex-range/**/*",
  "node_modules/triple-beam/**/*",
  "node_modules/tslib/**/*",
  "node_modules/undici-types/**/*",
  "node_modules/uniq/**/*",
  "node_modules/uri-js/**/*",
  "node_modules/util-deprecate/**/*",
  "node_modules/watlas/**/*",
  "node_modules/web-streams-polyfill/**/*",
  "node_modules/which/**/*",
  "node_modules/winston/**/*",
  "node_modules/winston-transport/**/*",
  "node_modules/wrap-ansi/**/*",
  "node_modules/wrap-ansi-cjs/**/*",
  "node_modules/yocto-queue/**/*",
] as const;

const OWNER_MODEL_PIPELINE_TRACE_INCLUDES = [
  ...OWNER_MODEL_PIPELINE_SCRIPT_TRACE_INCLUDES,
  ...OWNER_MODEL_PIPELINE_PACKAGE_TRACE_INCLUDES,
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
  experimental: {
    proxyClientMaxBodySize: MODEL_LAB_PROXY_CLIENT_MAX_BODY_SIZE,
  },
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
