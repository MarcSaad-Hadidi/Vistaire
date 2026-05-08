import type { Metadata, Viewport } from "next";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MenuAlive — Le menu qui donne vie à vos plats",
  description:
    "MenuAlive transforme le QR code restaurant en menu digital premium, visuel, interactif et immersif avec expérience 3D / AR."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080706"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
