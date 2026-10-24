"use client";
import { useSyncExternalStore } from "react";
import { getPublicTheme, subscribePublicTheme } from "@/lib/publicTheme";
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("vistaire-studio-theme", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("vistaire-studio-theme", notify);
  };
}
function snapshot() {
  try {
    return localStorage.getItem("vistaire-studio-theme") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}
export function useStudioTheme(demo = false) {
  return useSyncExternalStore(
    demo ? subscribePublicTheme : subscribe,
    demo ? getPublicTheme : snapshot,
    () => (demo ? "dark" : "light"),
  );
}

