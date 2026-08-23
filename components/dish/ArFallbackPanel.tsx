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
  className = ""
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
  const canShare = useSyncExternalStore(
    () => () => undefined,
    () => typeof navigator.share === "function",
    () => false
  );

  useEffect(() => {
    if (!isAlert) return;
    rootRef.current?.focus();
  }, [isAlert, phase.kind]);

  return (
    <aside
      ref={rootRef}
      tabIndex={-1}
      className={`rounded-xl border border-champagne/25 bg-[#120e0b]/92 p-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne ${className}`.trim()}
      data-ar-experience={phase.kind}
      data-ar-recommended-browser={
        phase.kind === "handoff" ? phase.recommendedBrowser : undefined
      }
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className="font-display text-base leading-tight text-cream">
        {copy.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#eadcc6]">{copy.body}</p>
      {showHandoffActions ? (
        <div className={`mt-3 grid gap-2 ${canShare ? "sm:grid-cols-2" : ""}`}>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-champagne/45 px-3 text-xs font-semibold text-champagne transition hover:bg-champagne/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
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
          {canShare ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/18 px-3 text-xs font-semibold text-cream transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
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
          <p className="text-xs leading-relaxed text-[#d6c7af]" role="status">
            {copy.copyError}
          </p>
          <label className="block text-xs font-semibold text-cream" htmlFor={manualId}>
            {copy.manualCopyLabel}
          </label>
          <input
            id={manualId}
            type="url"
            readOnly
            value={pageUrl}
            className="min-h-11 w-full rounded-lg border border-white/18 bg-black/40 px-3 text-xs text-cream"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/18 px-3 text-xs font-semibold text-cream"
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
