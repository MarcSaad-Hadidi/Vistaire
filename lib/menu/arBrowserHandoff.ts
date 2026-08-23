export type ArHandoffPlatform = "ios" | "android" | "other";

export type NavigatorPlatformInput = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentDataPlatform?: string;
};

export type ArClipboard = Pick<Clipboard, "writeText">;

export type ArDocument = Pick<
  Document,
  "body" | "createElement" | "execCommand"
>;

function copyWithLegacyDocument(
  text: string,
  documentApi: ArDocument | undefined
): boolean {
  if (!documentApi?.body || typeof documentApi.execCommand !== "function") {
    return false;
  }

  const textarea = documentApi.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  documentApi.body.appendChild(textarea);
  textarea.select();

  try {
    return documentApi.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export function detectArHandoffPlatform(
  input: NavigatorPlatformInput
): ArHandoffPlatform {
  const userAgent = input.userAgent ?? "";
  const platform = input.platform ?? "";
  const userAgentDataPlatform = input.userAgentDataPlatform ?? "";
  const platformHints = `${platform} ${userAgentDataPlatform}`;

  if (/android/i.test(userAgent) || /android/i.test(userAgentDataPlatform)) {
    return "android";
  }

  if (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    /iPhone|iPad|iPod|iOS|iPadOS/i.test(userAgentDataPlatform)
  ) {
    return "ios";
  }

  const isIpadOsDesktopMode =
    input.maxTouchPoints !== undefined &&
    input.maxTouchPoints > 1 &&
    (/Macintosh|MacIntel/i.test(userAgent) || /Macintosh|MacIntel/i.test(platformHints));

  return isIpadOsDesktopMode ? "ios" : "other";
}

export type LocationLike = {
  href: string;
  origin: string;
  protocol: string;
};

/**
 * Copy only the current page URL. Rejects javascript: and cross-origin values
 * so handoff never forwards an arbitrary URL into another browser.
 * Strips the model-viewer Scene Viewer failure hash so a copied dish link
 * cannot reopen the fallback state in Chrome.
 *
 * Android `intent://` / `googlechrome://` deep links are intentionally omitted:
 * they fail silently in many in-app WebViews, can target an arbitrary URL if
 * built from untrusted input, and still require copy/share as fallback.
 */
export function getSafeCurrentPageUrl(
  locationLike?: LocationLike
): string {
  const current =
    locationLike ??
    (typeof window !== "undefined"
      ? {
          href: window.location.href,
          origin: window.location.origin,
          protocol: window.location.protocol
        }
      : undefined);
  if (!current) return "";
  if (current.protocol !== "http:" && current.protocol !== "https:") return "";
  try {
    const url = new URL(current.href);
    if (url.origin !== current.origin) return "";
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.hash === "#model-viewer-no-ar-fallback") {
      url.hash = "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

export async function copyTextToClipboard(
  text: string,
  clipboard?: ArClipboard,
  documentApi?: ArDocument
): Promise<boolean> {
  const clipboardApi =
    clipboard ??
    (typeof navigator !== "undefined" ? navigator.clipboard : undefined);

  if (clipboardApi?.writeText) {
    try {
      await clipboardApi.writeText(text);
      return true;
    } catch {
      // Some embedded browsers expose Clipboard but reject writes. Try the
      // legacy document path before presenting the manual-copy fallback.
    }
  }

  return copyWithLegacyDocument(
    text,
    documentApi ?? (typeof document !== "undefined" ? document : undefined)
  );
}
