import type { CSSProperties } from "react";
import { MAISON_ELYSE_PALETTE } from "./menuThemePresets.ts";
import type { MenuUiConfig } from "./menuUiConfig.ts";

const MAISON_ELYSE_NEUTRALS = {
  black: "#000000",
  backgroundSoft: "#050505",
  surfaceElevated: "#111111",
  border: "rgba(255, 255, 255, 0.12)",
  borderStrong: "rgba(201, 164, 92, 0.46)",
  goldBorder: "rgba(201, 164, 92, 0.22)",
  overlay: "rgba(0, 0, 0, 0.72)",
  overlayStrong: "rgba(0, 0, 0, 0.88)",
  focus: "#DFC478"
} as const;

/** Canonical Maison Elyse tokens shared by the menu, phone preview and dish detail. */
export function maisonElyseThemeStyle(_config?: MenuUiConfig): CSSProperties {
  // The public resolver normalizes Maison Elyse to this palette; keep the optional
  // config argument for the shared component contract without allowing stale custom
  // colors to reintroduce the retired warm skin.
  void _config;
  const palette = MAISON_ELYSE_PALETTE;

  return {
    "--menu-bg": palette.background,
    "--menu-surface": palette.surface,
    "--menu-text": palette.text,
    "--menu-muted": palette.muted,
    "--menu-accent": palette.accent,
    "--menu-accent-2": palette.accent2,
    "--menu-accent-3": palette.accent3,
    "--menu-border": palette.border,
    "--menu-success": palette.success,
    "--menu-warning": palette.warning,
    "--menu-danger": palette.danger,
    "--elyse-black": MAISON_ELYSE_NEUTRALS.black,
    "--elyse-bg": palette.background,
    "--elyse-bg-soft": MAISON_ELYSE_NEUTRALS.backgroundSoft,
    "--elyse-surface": palette.surface,
    "--elyse-surface-elevated": MAISON_ELYSE_NEUTRALS.surfaceElevated,
    "--elyse-surface-soft": palette.surface,
    "--elyse-white": palette.text,
    "--elyse-text": palette.text,
    "--elyse-muted": palette.muted,
    "--elyse-gold": palette.accent,
    "--elyse-gold-light": palette.accent2,
    "--elyse-border": MAISON_ELYSE_NEUTRALS.border,
    "--elyse-border-strong": MAISON_ELYSE_NEUTRALS.borderStrong,
    "--elyse-gold-border": MAISON_ELYSE_NEUTRALS.goldBorder,
    "--elyse-overlay": MAISON_ELYSE_NEUTRALS.overlay,
    "--elyse-overlay-strong": MAISON_ELYSE_NEUTRALS.overlayStrong,
    "--elyse-focus": MAISON_ELYSE_NEUTRALS.focus
  } as CSSProperties;
}
