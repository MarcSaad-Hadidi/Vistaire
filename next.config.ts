import type { NextConfig } from "next";

/** Quick Look iOS attend souvent ce MIME pour les USDZ servis en HTTPS. */
const USDZ_DEMO_HEADERS = [
  { key: "Content-Type", value: "model/vnd.usdz+zip" },
  { key: "Content-Disposition", value: "inline" },
] as const;

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    qualities: [75, 90, 92],
  },
  async headers() {
    return [
      {
        source: "/models/demo/:path*.usdz",
        headers: [...USDZ_DEMO_HEADERS],
      },
    ];
  },
};

export default nextConfig;
