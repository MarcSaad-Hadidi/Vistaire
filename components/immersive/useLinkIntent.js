import { useEffect } from "react";
import { useRouter } from "next/navigation.js";

/** The path a click opens in this tab on another page of the site, else null. */
export function internalDestination(anchor, event, location = window.location) {
  if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return null;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return null;
  const destination = url.pathname + url.search;
  const current = new URL(location.href);
  return destination === current.pathname + current.search ? null : destination;
}

/**
 * Links stay prefetch={false} (no bulk downloads on load). Instead a page is
 * fetched as soon as a pointer, finger or focus reaches its link, and a click
 * that leaves the page calls onLeave at once, so the visitor never keeps
 * exploring a page that is about to change. Once the page is ready, the
 * navigation's own destinations prefetch while the browser is idle.
 */
export function useLinkIntent(onLeave, ready) {
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const idle = window.requestIdleCallback ?? ((callback) => setTimeout(callback, 1200));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const handle = idle(() => {
      const paths = new Set([...document.querySelectorAll("[data-vistaire-chrome] a[href]")]
        .map((anchor) => internalDestination(anchor, { button: 0, defaultPrevented: false }))
        .filter(Boolean));
      for (const path of paths) router.prefetch(path);
    });
    return () => cancel(handle);
  }, [router, ready]);
  useEffect(() => {
    const prefetched = new Set();
    const intent = (event) => {
      const anchor = event.target.closest?.("a[href]");
      const destination = anchor && internalDestination(anchor, { button: 0, defaultPrevented: false });
      if (!destination || prefetched.has(destination)) return;
      prefetched.add(destination);
      router.prefetch(destination);
    };
    const click = (event) => {
      if (internalDestination(event.target.closest?.("a[href]"), event)) onLeave();
    };
    const options = { passive: true, capture: true };
    for (const type of ["pointerover", "touchstart", "focusin"]) document.addEventListener(type, intent, options);
    // Capture: next/link cancels the native click to route itself, so a later
    // listener would see every in-site link click as prevented.
    document.addEventListener("click", click, true);
    return () => {
      for (const type of ["pointerover", "touchstart", "focusin"]) document.removeEventListener(type, intent, options);
      document.removeEventListener("click", click, true);
    };
  }, [router, onLeave]);
}
