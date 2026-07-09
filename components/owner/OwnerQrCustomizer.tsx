"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  DEFAULT_OWNER_QR_STYLE,
  OWNER_QR_LOGO_MAX_PERCENT,
  OWNER_QR_LOGO_MIN_PERCENT,
  OWNER_QR_PADDING_MAX,
  OWNER_QR_PADDING_MIN,
  OWNER_QR_PRESETS,
  QR_MIN_SAFE_CONTRAST,
  monogramFromName,
  qrContrastRatio
} from "@/lib/owner/qrStyle";
import type {
  OwnerQrCodeRecord,
  OwnerQrStyle,
  OwnerQrTargetKind
} from "@/lib/owner/types";

type OwnerQrCustomizerProps = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  targetKind: OwnerQrTargetKind;
  targetLabel: string;
  targetUsage: string;
  targetBadgeLabel: string;
  targetPath: string;
  targetDisplayUrl: string;
  initialQrStyle?: Partial<OwnerQrStyle>;
  className?: string;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | {
      kind: "saved";
      persisted: boolean;
      redirectUrl: string;
      targetPath: string;
      targetKind: OwnerQrTargetKind;
      record?: OwnerQrCodeRecord;
    }
  | { kind: "error"; message: string };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export function OwnerQrCustomizer({
  restaurantId,
  restaurantName,
  restaurantSlug,
  targetKind,
  targetLabel,
  targetUsage,
  targetBadgeLabel,
  targetPath,
  targetDisplayUrl,
  initialQrStyle,
  className = ""
}: OwnerQrCustomizerProps) {
  const [style, setStyle] = useState<OwnerQrStyle>(() => ({
    ...DEFAULT_OWNER_QR_STYLE,
    logoText: monogramFromName(restaurantName),
    ...initialQrStyle
  }));
  const [svgMarkup, setSvgMarkup] = useState("");
  const [qrValue, setQrValue] = useState(targetDisplayUrl);
  const [tokenPreview, setTokenPreview] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const contrast = useMemo(() => qrContrastRatio(style), [style]);
  const lowContrast = contrast > 0 && contrast < QR_MIN_SAFE_CONTRAST;
  const fileSlug = restaurantSlug || "restaurant";
  const exactDestinationUrl = useMemo(
    () => targetDisplayUrl || targetPath,
    [targetDisplayUrl, targetPath]
  );

  const qrValueForBrowser = useCallback((value: string): string => {
    if (!value.startsWith("/") || typeof window === "undefined") return value;
    return new URL(value, window.location.origin).toString();
  }, []);

  useEffect(() => {
    let active = true;
    async function render() {
      try {
        const QRCode = await import("qrcode");
        const base = await QRCode.toString(qrValueForBrowser(qrValue), {
          type: "svg",
          errorCorrectionLevel: style.errorCorrectionLevel,
          margin: style.padding,
          color: {
            dark: style.foregroundColor,
            light: style.backgroundColor
          }
        });
        if (active) setSvgMarkup(injectLogo(base, style));
      } catch {
        if (active) setSvgMarkup("");
      }
    }
    void render();
    return () => {
      active = false;
    };
  }, [qrValue, qrValueForBrowser, style]);

  const update = useCallback((patch: Partial<OwnerQrStyle>) => {
    setStyle((prev) => {
      const next = { ...prev, ...patch };
      if (next.logoMode !== "none") next.errorCorrectionLevel = "H";
      return next;
    });
  }, []);

  function applyPreset(presetId: string) {
    const preset = OWNER_QR_PRESETS.find((item) => item.id === presetId);
    if (preset) update(preset.style);
  }

  function reset() {
    setStyle({
      ...DEFAULT_OWNER_QR_STYLE,
      logoText: monogramFromName(restaurantName)
    });
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(qrValueForBrowser(qrValue));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function downloadSvg() {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(URL.createObjectURL(blob), `vistaire-qr-${fileSlug}.svg`);
  }

  function downloadPng() {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 720;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(image, 0, 0, size, size);
      try {
        triggerDownload(canvas.toDataURL("image/png"), `vistaire-qr-${fileSlug}.png`);
      } catch {
        setSaveState({
          kind: "error",
          message: "Export PNG indisponible avec un logo image distant. Utilisez le SVG."
        });
      }
      URL.revokeObjectURL(url);
    };
    image.onerror = () => URL.revokeObjectURL(url);
    image.src = url;
  }

  async function saveStyle() {
    setSaveState({ kind: "saving" });
    try {
      const response = await fetch("/api/owner/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          label: targetLabel,
          targetKind,
          targetPath,
          style: { ...style, updatedAt: new Date().toISOString() }
        })
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        token?: string;
        redirectUrl?: string;
        targetPath?: string;
        targetKind?: OwnerQrTargetKind;
        persisted?: boolean;
        record?: OwnerQrCodeRecord;
      };
      if (!response.ok || !payload.ok || !payload.redirectUrl) {
        setSaveState({
          kind: "error",
          message: payload.error || "Sauvegarde QR impossible."
        });
        return;
      }
      setQrValue(payload.redirectUrl);
      setTokenPreview(payload.token ? `${payload.token.slice(0, 6)}...` : "");
      setSaveState({
        kind: "saved",
        persisted: Boolean(payload.persisted),
        redirectUrl: payload.redirectUrl,
        targetPath: payload.targetPath || payload.record?.targetPath || targetPath,
        targetKind: payload.targetKind || payload.record?.targetKind || targetKind,
        record: payload.record
      });
    } catch {
      setSaveState({ kind: "error", message: "Erreur reseau pendant la sauvegarde." });
    }
  }

  return (
    <div className={`${styles.qrCustomizer} ${className}`}>
      <div className={styles.qrPreviewCol}>
        <div
          className={styles.qrPreviewFrame}
          role="img"
          aria-label={`QR pour ${restaurantName}`}
        >
          {svgMarkup ? (
            <span dangerouslySetInnerHTML={{ __html: svgMarkup }} />
          ) : (
            <span>QR...</span>
          )}
        </div>
        <div className={styles.qrUrlBox}>
          <strong>URL QR :</strong> {qrValue}
          {tokenPreview ? ` - token ${tokenPreview}` : ""}
        </div>
        <div className={styles.qrUrlBox}>
          <strong>Destination finale :</strong> {exactDestinationUrl}
        </div>
        <div className={styles.qrUrlBox}>
          <strong>Type :</strong> {targetLabel} - {targetBadgeLabel}
        </div>
        {targetKind === "admin" ? (
          <p className={styles.qrWarning}>
            Interne restaurant. Ne pas imprimer pour les clients. Ce QR ouvre le
            dashboard restaurant protege ; il ne contient aucun identifiant ni secret.
          </p>
        ) : null}
        {lowContrast ? (
          <p className={styles.qrWarning}>
            Contraste faible ({contrast.toFixed(1)}:1). Sous {QR_MIN_SAFE_CONTRAST}:1 le
            scan devient peu fiable - assombrissez le premier plan ou eclaircissez le
            fond.
          </p>
        ) : null}
      </div>

      <div className={styles.qrControlsCol}>
        <div>
          <p className={styles.fieldLabel}>Presets</p>
          <div className={styles.presetRow}>
            {OWNER_QR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={styles.presetButton}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.colorGrid}>
          <ColorField
            label="Premier plan"
            value={style.foregroundColor}
            onChange={(value) => update({ foregroundColor: value })}
          />
          <ColorField
            label="Fond"
            value={style.backgroundColor}
            onChange={(value) => update({ backgroundColor: value })}
          />
          <ColorField
            label="Accent"
            value={style.accentColor}
            onChange={(value) => update({ accentColor: value })}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Logo au centre</span>
          <select
            className={styles.select}
            value={style.logoMode}
            onChange={(event) =>
              update({ logoMode: event.target.value as OwnerQrStyle["logoMode"] })
            }
          >
            <option value="none">Aucun logo</option>
            <option value="monogram">Monogramme du restaurant</option>
            <option value="imageUrl">Logo image</option>
          </select>
        </label>

        {style.logoMode === "monogram" ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Texte monogramme</span>
            <input
              className={styles.input}
              maxLength={4}
              value={style.logoText}
              onChange={(event) => update({ logoText: event.target.value })}
            />
          </label>
        ) : null}

        {style.logoMode === "imageUrl" ? (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>URL du logo</span>
              <input
                className={styles.input}
                value={style.logoImageUrl ?? ""}
                placeholder="https://.../logo.png"
                onChange={(event) => update({ logoImageUrl: event.target.value })}
              />
            </label>
            <p className={styles.qrWarning}>
              Avec un logo image distant, le SVG reste recommande : certains
              navigateurs peuvent bloquer l&apos;export PNG.
            </p>
          </>
        ) : null}

        {style.logoMode !== "none" ? (
          <RangeField
            label={`Taille logo (${style.logoSizePercent}%)`}
            min={OWNER_QR_LOGO_MIN_PERCENT}
            max={OWNER_QR_LOGO_MAX_PERCENT}
            value={style.logoSizePercent}
            onChange={(value) => update({ logoSizePercent: value })}
          />
        ) : null}

        <RangeField
          label={`Marge (${style.padding})`}
          min={OWNER_QR_PADDING_MIN}
          max={OWNER_QR_PADDING_MAX}
          value={style.padding}
          onChange={(value) => update({ padding: value })}
        />

        <div className={styles.qrExportRow}>
          <button type="button" className={styles.btn} onClick={copyUrl}>
            {copyState === "copied" ? "URL copiee" : "Copier URL QR"}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={downloadSvg}
            disabled={!svgMarkup}
          >
            Telecharger SVG
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={downloadPng}
            disabled={!svgMarkup}
          >
            Telecharger PNG
          </button>
          <button type="button" className={styles.btn} onClick={reset}>
            Reinitialiser style
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={saveStyle}
            disabled={saveState.kind === "saving"}
          >
            {saveState.kind === "saving"
              ? "Sauvegarde..."
              : "Sauvegarder / Generer QR"}
          </button>
        </div>

        <p className={styles.qrStatusLine} aria-live="polite" role="status">
          {saveState.kind === "saved"
            ? saveState.persisted
              ? `QR securise enregistre. Type ${saveState.targetKind}; destination ${saveState.targetPath}.`
              : `QR genere non persiste. Type ${saveState.targetKind}; destination ${saveState.targetPath}.`
            : saveState.kind === "error"
              ? saveState.message
              : `Le QR encode ${targetUsage} Sauvegardez pour obtenir l'URL securisee /q.`}
        </p>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.colorField}>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={styles.cellSub}>{label}</span>
    </div>
  );
}

function RangeField({
  label,
  min,
  max,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.rangeField}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function triggerDownload(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  if (href.startsWith("blob:")) URL.revokeObjectURL(href);
}
