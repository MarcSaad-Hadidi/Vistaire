"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ArExperiencePhase } from "@/lib/ar/arExperience";
import { copyTextToClipboard } from "@/lib/menu/arBrowserHandoff";

export type ArFallbackPanelCopy = {
  title: string;
  body: string;
  copyLink: string;
  linkCopied: string;
  share: string;
  copyError: string;
  manualCopyLabel: string;
  selectLink: string;
};

export type ArFallbackPanelVariant =
  | "default"
  | "maison-elyse"
  | "sauge-noire";

export type ArFallbackPanelProps = {
  phase: Extract<
    ArExperiencePhase,
    | { kind: "handoff" }
    | { kind: "unsupported-device" }
    | { kind: "activation-failed" }
    | { kind: "asset-unavailable" }
    | { kind: "missing-usdz" }
    | { kind: "desktop-hint" }
  >;
  copy: ArFallbackPanelCopy;
  pageUrl: string;
  shareText: string;
  dishName: string;
  className?: string;
  variant?: ArFallbackPanelVariant;
};

type ArFallbackPanelVariantStyles = {
  root: string;
  title: string;
  body: string;
  primaryAction: string;
  secondaryAction: string;
  error: string;
  label: string;
  input: string;
};

const FALLBACK_PANEL_VARIANT_STYLES: Record<
  ArFallbackPanelVariant,
  ArFallbackPanelVariantStyles
> = {
  default: {
    root:
      "rounded-xl border border-champagne/25 bg-[#120e0b]/92 p-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne",
    title: "font-display text-base leading-tight text-cream",
    body: "mt-1.5 text-sm leading-relaxed text-[#eadcc6]",
    primaryAction:
      "inline-flex min-h-11 items-center justify-center rounded-full border border-champagne/45 px-3 text-xs font-semibold text-champagne transition hover:bg-champagne/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne",
    secondaryAction:
      "inline-flex min-h-11 items-center justify-center rounded-full border border-white/18 px-3 text-xs font-semibold text-cream transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne",
    error: "text-xs leading-relaxed text-[#d6c7af]",
    label: "block text-xs font-semibold text-cream",
    input:
      "min-h-11 w-full rounded-lg border border-white/18 bg-black/40 px-3 text-xs text-cream"
  },
  "maison-elyse": {
    root:
      "rounded-none border border-[#c9a45c]/35 bg-[#0a0a0a]/95 p-4 text-left shadow-[inset_0_1px_0_rgba(201,164,92,0.10),0_18px_48px_rgba(0,0,0,0.32)] backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dfc478]",
    title: "text-base font-medium leading-tight text-[#f2f2f2] sm:text-lg",
    body: "mt-2 text-sm leading-relaxed text-[#cfc9bf]",
    primaryAction:
      "inline-flex min-h-11 items-center justify-center border border-[#c9a45c]/55 bg-[#c9a45c]/10 px-4 text-xs font-semibold text-[#dfc478] transition hover:bg-[#c9a45c]/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dfc478]",
    secondaryAction:
      "inline-flex min-h-11 items-center justify-center border border-white/15 bg-white/[0.03] px-4 text-xs font-semibold text-[#f2f2f2] transition hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dfc478]",
    error: "text-xs leading-relaxed text-[#b8aea0]",
    label: "block text-xs font-semibold text-[#f2f2f2]",
    input:
      "min-h-11 w-full border border-[#c9a45c]/25 bg-black/45 px-3 text-xs text-[#f2f2f2]"
  },
  "sauge-noire": {
    root:
      "rounded-[26px] border border-[#b47a3c]/45 bg-[#faf4e9]/95 p-4 text-left shadow-[0_16px_38px_rgba(38,55,43,0.14)] backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b47a3c]",
    title: "text-base font-normal leading-tight text-[#26372b] sm:text-lg",
    body: "mt-2 text-sm leading-relaxed text-[#3f5144]",
    primaryAction:
      "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#26372b] bg-[#26372b] px-4 text-xs font-semibold text-[#faf4e9] transition hover:bg-[#324637] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b47a3c]",
    secondaryAction:
      "inline-flex min-h-11 items-center justify-center rounded-full border border-[#26372b]/30 bg-transparent px-4 text-xs font-semibold text-[#26372b] transition hover:bg-[#26372b]/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b47a3c]",
    error: "text-xs leading-relaxed text-[#5d6b60]",
    label: "block text-xs font-semibold text-[#26372b]",
    input:
      "min-h-11 w-full rounded-xl border border-[#26372b]/25 bg-[#fffaf1] px-3 text-xs text-[#26372b]"
  }
};

function isHandoff(
  phase: ArFallbackPanelProps["phase"]
): phase is Extract<ArExperiencePhase, { kind: "handoff" }> {
  return phase.kind === "handoff";
}

export function ArFallbackPanel({
  phase,
  copy,
  pageUrl,
  shareText,
  dishName,
  className = "",
  variant = "default"
}: ArFallbackPanelProps) {
  const titleId = useId();
  const manualId = useId();
  const copySessionKey = `${phase.kind}:${pageUrl}`;
  const [copyUi, setCopyUi] = useState({
    key: copySessionKey,
    confirmed: false,
    failed: false
  });
  if (copyUi.key !== copySessionKey) {
    setCopyUi({ key: copySessionKey, confirmed: false, failed: false });
  }
  const copyConfirmed = copyUi.confirmed;
  const copyFailed = copyUi.failed;
  const showHandoffActions = isHandoff(phase);
  const isAlert =
    phase.kind === "unsupported-device" ||
    phase.kind === "activation-failed" ||
    phase.kind === "asset-unavailable";
  const rootRef = useRef<HTMLElement>(null);
  const browserCanShare = useSyncExternalStore(
    () => () => undefined,
    () => typeof navigator.share === "function",
    () => false
  );
  const showShareAction = browserCanShare && variant === "default";
  const variantStyles = FALLBACK_PANEL_VARIANT_STYLES[variant];
  const brandedTitleStyle =
    variant === "default"
      ? undefined
      : { fontFamily: '"BT Suave", Georgia, serif' };
  const primaryActionStyle =
    variant === "sauge-noire"
      ? {
          color: "#faf4e9",
          fontFamily: '"Neue Montreal", Arial, sans-serif',
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.08em"
        }
      : undefined;

  useEffect(() => {
    if (!isAlert) return;
    rootRef.current?.focus();
  }, [isAlert, phase.kind]);

  return (
    <aside
      ref={rootRef}
      tabIndex={-1}
      className={`${variantStyles.root} ${className}`.trim()}
      data-ar-experience={phase.kind}
      data-ar-fallback-variant={variant}
      data-ar-recommended-browser={
        phase.kind === "handoff" ? phase.recommendedBrowser : undefined
      }
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      aria-labelledby={titleId}
    >
      <h3
        id={titleId}
        className={variantStyles.title}
        style={brandedTitleStyle}
      >
        {copy.title}
      </h3>
      <p className={variantStyles.body}>{copy.body}</p>
      {showHandoffActions ? (
        <div className={`mt-3 grid gap-2 ${showShareAction ? "sm:grid-cols-2" : ""}`}>
          <button
            type="button"
            className={variantStyles.primaryAction}
            style={primaryActionStyle}
            onClick={() => {
              void copyTextToClipboard(pageUrl).then((ok) => {
                setCopyUi({
                  key: copySessionKey,
                  confirmed: ok,
                  failed: !ok
                });
                if (ok) {
                  window.setTimeout(() => {
                    setCopyUi((current) =>
                      current.key === copySessionKey && current.confirmed
                        ? { ...current, confirmed: false }
                        : current
                    );
                  }, 1800);
                }
              });
            }}
          >
            {copyConfirmed ? copy.linkCopied : copy.copyLink}
          </button>
          {showShareAction ? (
            <button
              type="button"
              className={variantStyles.secondaryAction}
              onClick={() => {
                if (!pageUrl || typeof navigator.share !== "function") {
                  setCopyUi({
                    key: copySessionKey,
                    confirmed: false,
                    failed: true
                  });
                  return;
                }
                void navigator
                  .share({ title: dishName, text: shareText, url: pageUrl })
                  .catch((error: unknown) => {
                    const name =
                      typeof error === "object" &&
                      error !== null &&
                      "name" in error &&
                      typeof error.name === "string"
                        ? error.name
                        : "";
                    if (name === "AbortError") return;
                    setCopyUi({
                      key: copySessionKey,
                      confirmed: false,
                      failed: true
                    });
                  });
              }}
            >
              {copy.share}
            </button>
          ) : null}
        </div>
      ) : null}
      {copyFailed && showHandoffActions ? (
        <div className="mt-3 space-y-2">
          <p className={variantStyles.error} role="status">
            {copy.copyError}
          </p>
          <label className={variantStyles.label} htmlFor={manualId}>
            {copy.manualCopyLabel}
          </label>
          <input
            id={manualId}
            type="url"
            readOnly
            value={pageUrl}
            className={variantStyles.input}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className={variantStyles.secondaryAction}
            onClick={(event) => {
              const input = event.currentTarget
                .closest("aside")
                ?.querySelector("input");
              input?.focus();
              input?.select();
            }}
          >
            {copy.selectLink}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
