"use client";

import { useEffect } from "react";

export function useTrouvableDocumentLanguage(
  locale: string,
  direction: "ltr" | "rtl"
) {
  useEffect(() => {
    const root = document.documentElement;
    const previousLang = root.lang;
    const previousDir = root.getAttribute("dir");

    root.lang = locale;
    root.setAttribute("dir", direction);

    return () => {
      root.lang = previousLang;
      if (previousDir === null) {
        root.removeAttribute("dir");
      } else {
        root.setAttribute("dir", previousDir);
      }
    };
  }, [direction, locale]);
}
