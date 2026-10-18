import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".worktrees/**",
      "playwright-report/**",
      "test-results/**",
      "public/immersive-assets/draco/**",
      "tmp_*",
      "tmp_*/**"
    ]
  },
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["components/immersive/**/*.{js,jsx}"],
    // Keep the original renderer textures, runtime QR data URLs and Quick Look's
    // required single image child; Next Image is inappropriate for these assets.
    rules: { "@next/next/no-img-element": "off" }
  }
];

export default eslintConfig;
