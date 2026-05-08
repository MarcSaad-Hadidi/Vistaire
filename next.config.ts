import type { NextConfig } from "next";

/** Quick Look iOS attend souvent ce MIME pour les USDZ servis en HTTPS. */
const USDZ_DEMO_HEADERS = [
  { key: "Content-Type", value: "model/vnd.usdz+zip" },
  { key: "Content-Disposition", value: "inline" },
] as const;

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    qualities: [75, 90],
  },
  async headers() {
    const demoUsdz = [
      "ravioles-chevre-miel.usdz",
      "homard-bisque.usdz",
      "souffle-chocolat.usdz",
      "maison-elyse-n1.usdz",
    ];
    return demoUsdz.map((file) => ({
      source: `/models/demo/${file}`,
      headers: [...USDZ_DEMO_HEADERS],
    }));
  },
};

export default nextConfig;
