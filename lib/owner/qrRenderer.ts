import {
  DEFAULT_OWNER_QR_STYLE,
  monogramFromName,
  normalizeOwnerQrStyle
} from "@/lib/owner/qrStyle";
import type { OwnerQrStyle, OwnerQrTargetKind } from "@/lib/owner/types";

export type OwnerQrRenderMode = "preview" | "download";

export type OwnerQrRenderInput = {
  /** The opaque QR redirect URL (never the readable destination URL). */
  url: string;
  style?: Partial<OwnerQrStyle> | OwnerQrStyle;
  restaurantName?: string;
  targetKind?: OwnerQrTargetKind;
  dimensions?: number;
  mode?: OwnerQrRenderMode;
  qrId?: string;
  configVersion?: number;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function styleForRender(
  input: Partial<OwnerQrStyle> | OwnerQrStyle | undefined,
  restaurantName: string
): OwnerQrStyle {
  const candidate = input && typeof input === "object" ? input : {};
  return normalizeOwnerQrStyle({
    ...candidate,
    logoText:
      typeof candidate.logoText === "string" && candidate.logoText.trim()
        ? candidate.logoText
        : monogramFromName(restaurantName) || DEFAULT_OWNER_QR_STYLE.logoText
  });
}

function addDiagnostics(
  svg: string,
  input: Pick<OwnerQrRenderInput, "qrId" | "configVersion" | "targetKind">
): string {
  const attrs = [
    input.qrId ? ` data-qr-id="${escapeXml(input.qrId)}"` : "",
    typeof input.configVersion === "number"
      ? ` data-qr-config-version="${input.configVersion}"`
      : "",
    input.targetKind ? ` data-qr-target-kind="${input.targetKind}"` : ""
  ].join("");
  return attrs ? svg.replace("<svg", `<svg${attrs}`) : svg;
}

function injectLogo(svg: string, style: OwnerQrStyle): string {
  if (style.logoMode === "none") return svg;
  const viewBoxMatch = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const size = viewBoxMatch ? Number(viewBoxMatch[1]) : 0;
  if (!size) return svg;

  const logoSize = (size * style.logoSizePercent) / 100;
  const plate = logoSize * 1.32;
  const center = size / 2;
  const x = center - plate / 2;
  const y = center - plate / 2;

  let inner = "";
  if (style.logoMode === "monogram") {
    inner = `<text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif" font-size="${(
      logoSize * 0.66
    ).toFixed(2)}" font-weight="700" fill="${escapeXml(
      style.foregroundColor
    )}">${escapeXml(style.logoText || "V")}</text>`;
  } else if (style.logoMode === "imageUrl" && style.logoImageUrl) {
    const ix = center - logoSize / 2;
    const iy = center - logoSize / 2;
    inner = `<image href="${escapeXml(
      style.logoImageUrl
    )}" x="${ix}" y="${iy}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />`;
  }

  const overlay = `<g><rect x="${x}" y="${y}" width="${plate}" height="${plate}" rx="${(
    plate * 0.18
  ).toFixed(2)}" fill="${escapeXml(style.backgroundColor)}" stroke="${escapeXml(
    style.accentColor
  )}" stroke-width="${(size * 0.01).toFixed(2)}" />${inner}</g>`;
  return svg.replace("</svg>", `${overlay}</svg>`);
}

/**
 * The single QR renderer used by owner previews and exports. Keeping qrcode
 * options and logo injection here prevents the publication and customizer
 * routes from silently drifting apart.
 */
export async function renderOwnerQrSvg(input: OwnerQrRenderInput): Promise<string> {
  const restaurantName = input.restaurantName ?? "Vistaire";
  const style = styleForRender(input.style, restaurantName);
  const dimensions = Number.isFinite(input.dimensions) && (input.dimensions ?? 0) > 0
    ? Math.round(input.dimensions as number)
    : 236;
  const QRCode = await import("qrcode");
  const base = await QRCode.toString(input.url, {
    type: "svg",
    errorCorrectionLevel: style.errorCorrectionLevel,
    margin: style.padding,
    width: dimensions,
    color: {
      dark: style.foregroundColor,
      light: style.backgroundColor
    }
  });
  return addDiagnostics(injectLogo(base, style), input);
}
