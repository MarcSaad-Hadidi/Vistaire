"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";

type MenuQrCodeProps = {
  menuUrl: string;
  restaurantName: string;
  className?: string;
  qrLabel?: string;
  copyLabel?: string;
  downloadLabel?: string;
  fileNamePrefix?: string;
};

function qrFileSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function MenuQrCode({
  menuUrl,
  restaurantName,
  className = "",
  qrLabel = "Menu QR",
  copyLabel = "Copier l'URL",
  downloadLabel = "Télécharger QR",
  fileNamePrefix = "vistaire-menu"
}: MenuQrCodeProps) {
  const [qrState, setQrState] = useState({ url: "", svgMarkup: "" });
  const [status, setStatus] = useState<"idle" | "copied" | "downloaded" | "error">(
    "idle"
  );
  const svgMarkup = qrState.url === menuUrl ? qrState.svgMarkup : "";
  const fileName = useMemo(
    () => `${fileNamePrefix}-${qrFileSlug(restaurantName) || "restaurant"}.svg`,
    [fileNamePrefix, restaurantName]
  );

  useEffect(() => {
    let isCurrent = true;

    async function renderQr() {
      try {
        const QRCode = await import("qrcode");
        const svg = await QRCode.toString(menuUrl, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 3,
          width: 236,
          color: {
            dark: "#080706",
            light: "#fff8ea"
          }
        });

        if (isCurrent) {
          setQrState({ url: menuUrl, svgMarkup: svg });
          setStatus("idle");
        }
      } catch {
        if (isCurrent) setStatus("error");
      }
    }

    void renderQr();

    return () => {
      isCurrent = false;
    };
  }, [menuUrl]);

  async function copyMenuUrl() {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  function downloadQr() {
    if (!svgMarkup) return;

    const blob = new Blob([svgMarkup], {
      type: "image/svg+xml;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("downloaded");
  }

  return (
    <div className={className ? `${styles.qrRoot} ${className}` : styles.qrRoot}>
      <div className={styles.qrBox}>
        <div
          className={styles.qrCanvas}
          aria-label={`${qrLabel} pour ${restaurantName}`}
          role="img"
        >
          {svgMarkup ? (
            <span
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          ) : (
            <span>
              {qrLabel}
            </span>
          )}
        </div>
      </div>

      <p className={styles.qrUrl}>
        {menuUrl}
      </p>

      <div className={styles.qrActions}>
        <button
          type="button"
          onClick={copyMenuUrl}
          className={styles.qrButton}
        >
          {copyLabel}
        </button>
        <button
          type="button"
          onClick={downloadQr}
          disabled={!svgMarkup}
          className={styles.qrButton}
        >
          {downloadLabel}
        </button>
      </div>

      <p
        aria-live="polite"
        className={styles.qrStatus}
      >
        {status === "copied"
          ? "URL copiée dans le presse-papiers."
          : status === "downloaded"
            ? "QR SVG téléchargé."
            : status === "error"
              ? "Action indisponible dans ce navigateur."
              : ""}
      </p>
    </div>
  );
}
