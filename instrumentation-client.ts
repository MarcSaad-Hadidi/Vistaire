import { shouldStopMicrosoftClarityBeforeNavigation } from "@/lib/analytics/microsoftClarityRoutes";

declare global {
  interface Window {
    __vistaireClarityBlocked?: boolean;
    __vistaireClarityPathname?: string;
    clarity?: (...args: unknown[]) => void;
  }
}

type NavigationType = "push" | "replace" | "traverse";

window.__vistaireClarityPathname = window.location.pathname;

function stopMicrosoftClarityBeforeSensitiveRoute(
  sourcePathname: string,
  targetUrl: URL
) {
  if (
    targetUrl.origin !== window.location.origin ||
    !shouldStopMicrosoftClarityBeforeNavigation(
      sourcePathname,
      targetUrl.pathname
    )
  ) {
    return;
  }

  window.__vistaireClarityBlocked = true;
  window.clarity?.("stop");
}

window.addEventListener("popstate", () => {
  const targetPathname = window.location.pathname;
  const sourcePathname =
    window.__vistaireClarityPathname ?? targetPathname;

  stopMicrosoftClarityBeforeSensitiveRoute(
    sourcePathname,
    new URL(window.location.href)
  );
  window.__vistaireClarityPathname = targetPathname;
});

export function onRouterTransitionStart(
  url: string,
  navigationType: NavigationType
) {
  const targetUrl = new URL(url, window.location.href);
  const sourcePathname =
    navigationType === "traverse"
      ? (window.__vistaireClarityPathname ?? window.location.pathname)
      : window.location.pathname;

  stopMicrosoftClarityBeforeSensitiveRoute(sourcePathname, targetUrl);
}
