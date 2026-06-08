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

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  outputFileTracingRoot: PROJECT_ROOT,
  turbopack: {
    root: PROJECT_ROOT,
  },
  images: {
    qualities: [75, 90, 92, 100],
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
