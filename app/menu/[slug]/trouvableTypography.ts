import { Inter, Noto_Serif_Display } from "next/font/google";

export const trouvableUiFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--trouvable-font-ui",
  fallback: ["Arial", "sans-serif"]
});

export const trouvableDisplayFont = Noto_Serif_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--trouvable-font-display",
  fallback: ["Georgia", "serif"],
  style: ["normal", "italic"]
});

export const trouvableTypographyClassName = `${trouvableUiFont.variable} ${trouvableDisplayFont.variable}`;
