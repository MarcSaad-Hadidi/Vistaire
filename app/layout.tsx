import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import {
  vistaireClerkAppearance,
  vistaireClerkLocalization
} from "@/lib/clerkAppearance";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vistaire — Le menu qui donne vie à vos plats",
  description:
    "Vistaire transforme le QR code restaurant en menu vivant, visuel, interactif et immersif avec expérience 3D / AR."
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
        <ClerkProvider
          appearance={vistaireClerkAppearance}
          localization={vistaireClerkLocalization}
          telemetry={false}
          signInUrl="/sign-in"
          signUpUrl="/sign-in"
          afterSignOutUrl="/"
        >
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
