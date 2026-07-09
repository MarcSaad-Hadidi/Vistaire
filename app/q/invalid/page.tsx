import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

export default function InvalidQrPage() {
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        background: "#0d0805",
        color: "#fff7ea",
        fontFamily: "Neue Montreal, system-ui, sans-serif",
        padding: "32px",
        textAlign: "center"
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(232, 207, 155, 0.82)"
          }}
        >
          Vistaire
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: 26, fontWeight: 600 }}>
          QR introuvable ou désactivé
        </h1>
        <p style={{ margin: "0 0 20px", color: "rgba(255, 250, 240, 0.72)" }}>
          Ce QR n&apos;est plus actif. Demandez au restaurant un QR à jour.
        </p>
        <Link
          href="/"
          prefetch={false}
          style={{
            display: "inline-block",
            padding: "10px 18px",
            borderRadius: 999,
            border: "1px solid rgba(232, 207, 155, 0.4)",
            color: "#e8cf9b",
            textDecoration: "none"
          }}
        >
          Accueil Vistaire
        </Link>
      </div>
    </main>
  );
}
