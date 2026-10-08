import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { Locale } from "./i18n";

export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 };

const photoData = await readFile(
  join(process.cwd(), "public/images/pricing/vistaire-acrylique.jpg"),
  "base64"
);
const logoData = await readFile(join(process.cwd(), "app/icon.svg"), "base64");

export function buildVistaireSocialImage(locale: Locale) {
  const english = locale === "en";

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#080706", color: "#f4eedf" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700, padding: "64px 58px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* ImageResponse embeds local assets directly in the generated PNG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/svg+xml;base64,${logoData}`} width={72} height={72} alt="" />
          <span style={{ fontSize: 72, letterSpacing: -3 }}>Vistaire</span>
        </div>
        <div style={{ display: "flex", fontSize: 49, lineHeight: 1.15, maxWidth: 560 }}>
          {english ? "Premium digital menus for restaurants" : "Carte digitale premium pour restaurants"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "#d9b879", fontSize: 24 }}>
          <span>{english ? "QR displays · Mobile menu · Guided setup" : "Supports QR · Carte mobile · Accompagnement"}</span>
          <span style={{ fontSize: 21, color: "#f4eedf" }}>vistaire.ca</span>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/jpeg;base64,${photoData}`}
        width={500}
        height={630}
        style={{ objectFit: "cover", objectPosition: "50% 50%" }}
        alt=""
      />
    </div>,
    SOCIAL_IMAGE_SIZE
  );
}
