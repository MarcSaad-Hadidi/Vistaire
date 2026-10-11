import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowUpRight, ScanLine } from "lucide-react";
import { getDishHref } from "./dishDestinations";
import { useLandingLocale } from "./locale.jsx";

export function isIOSDevice(device = globalThis.navigator) {
  if (!device) return false;
  const identity = `${device.userAgent ?? ""} ${device.platform ?? ""}`;
  return (
    /iPhone|iPad|iPod/i.test(identity) ||
    (/Macintosh|MacIntel/i.test(identity) && device.maxTouchPoints > 1)
  );
}

export function ARAction({ item, disabled, onLaunch, ios, className = "" }) {
  const { t } = useLandingLocale();
  if (item.iosModel && ios) {
    return (
      <span
        className={`ar-action ${className}`}
        style={{ position: "relative" }}
      >
        {/* Quick Look requires a rel=ar anchor with a single img/picture child. */}
        <a
          rel="ar"
          href={item.iosModel}
          aria-label={t("Voir à ma table")}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            zIndex: 1,
          }}
        >
          <img
            src={`/immersive-assets/${item.image}.webp`}
            alt=""
            style={{
              width: 1,
              height: 1,
              position: "absolute",
              opacity: 0,
            }}
          />
        </a>
        <span aria-hidden="true" style={{ display: "contents" }}>
          <ScanLine size={17} />
          {t("Voir à ma table")}
          <ArrowUpRight size={15} />
        </span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`ar-action ${className}`}
      disabled={disabled}
      onClick={onLaunch}
    >
      <ScanLine size={17} />
      {t("Voir à ma table")}
      <ArrowUpRight size={15} />
    </button>
  );
}

export function DishDetailLink({ item, className = "detail-link" }) {
  const { t, href: localizeHref } = useLandingLocale();
  const destination = getDishHref(item);
  const href = destination ? localizeHref(destination) : null;
  if (!href) return null;
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t("Voir la fiche du plat")}
      <ArrowUpRight size={15} />
    </a>
  );
}

export function ARHelp({ item, error }) {
  const { t, locale } = useLandingLocale();
  const [qr, setQr] = useState("");
  const url = new URL(typeof location === "undefined" ? "https://www.vistaire.ca" : location.href);
  url.searchParams.set("dish", item.id);
  url.hash = "grip";
  const href = url.href;
  useEffect(() => {
    let stopped = false;
    QRCode.toDataURL(href, {
      width: 360,
      margin: 3,
      color: { dark: "#101a20", light: "#f5ead7" },
      errorCorrectionLevel: "M",
    })
      .then((data) => {
        if (!stopped) setQr(data);
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [href]);
  return (
    <div className="ar-help">
      <span className="eyebrow">
        {t("Réalité augmentée ·")} {item.label}
      </span>
      <h2>
        {t("Invitez ce plat")}
        <br />
        <em>{t("à votre table.")}</em>
      </h2>
      {error && (
        <p className="ar-feedback" role="status">
          {error}
        </p>
      )}
      <p>
        {t(
          "Ouvrez cette page sur votre téléphone, choisissez « Voir à ma table », puis dirigez la caméra vers une surface dégagée.",
        )}
      </p>
      {qr && (
        <img
          className="ar-qr"
          src={qr}
          alt={
            locale === "en"
              ? `QR code to view ${item.label} on your phone`
              : `QR code pour afficher ${item.label} sur votre téléphone`
          }
        />
      )}
      <p>
        <strong>{t("iPhone ou iPad :")}</strong> {t("ouvrez dans Safari.")}{" "}
        <strong>{t("Android :")}</strong>{" "}
        {t(
          "ouvrez dans Chrome sur un appareil compatible avec la réalité augmentée.",
        )}
      </p>
      <a href={href} className="ar-page-link">
        {t("Ouvrir ce plat")}
        <ArrowUpRight size={15} />
      </a>
    </div>
  );
}
