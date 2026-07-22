export type ArHandoffPlatform = "ios" | "android" | "other";

export type NavigatorPlatformInput = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentDataPlatform?: string;
};

export type ArClipboard = Pick<Clipboard, "writeText">;

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

export async function copyTextToClipboard(
  text: string,
  clipboard?: ArClipboard
): Promise<boolean> {
  const clipboardApi =
    clipboard ??
    (typeof navigator !== "undefined" ? navigator.clipboard : undefined);

  if (!clipboardApi?.writeText) return false;

  try {
    await clipboardApi.writeText(text);
    return true;
  } catch {
    return false;
  }
}
