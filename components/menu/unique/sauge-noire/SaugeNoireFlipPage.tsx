"use client";

import {
  createContext,
  forwardRef,
  type ForwardedRef,
  type ReactNode,
  useCallback,
  useContext,
  useRef
} from "react";
import styles from "./SaugeNoireBookMenu.module.css";

export type SaugeNoireFlipPageDensity = "hard" | "soft";

type SaugeNoireOriginalPageRegistry = {
  bookId: string;
  register: (index: number, element: HTMLElement) => void;
  unregister: (index: number, element: HTMLElement) => void;
};

export const SaugeNoireOriginalPageRegistryContext =
  createContext<SaugeNoireOriginalPageRegistry | null>(null);

const SAUGE_REACT_ORIGINAL_PAGE = Symbol.for(
  "vistaire.sauge-noire.react-original-page"
);

type SaugeNoireOriginalPageElement = HTMLElement & {
  [SAUGE_REACT_ORIGINAL_PAGE]?: true;
};

export function isSaugeNoireOriginalPage(
  element: HTMLElement
): element is SaugeNoireOriginalPageElement {
  return (
    (element as SaugeNoireOriginalPageElement)[SAUGE_REACT_ORIGINAL_PAGE] === true
  );
}

export function resolveSaugeNoireOriginalPage(
  root: ParentNode,
  pageIndex: number | string
): HTMLElement | null {
  return (
    [...root.querySelectorAll<HTMLElement>(
      `[data-sauge-flip-page-index="${pageIndex}"]`
    )].find(isSaugeNoireOriginalPage) ?? null
  );
}

export function listSaugeNoireOriginalPages(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-sauge-flip-page-index]")]
    .filter(isSaugeNoireOriginalPage);
}

function assignForwardedRef(
  ref: ForwardedRef<HTMLDivElement>,
  element: HTMLDivElement | null
) {
  if (typeof ref === "function") {
    ref(element);
  } else if (ref) {
    ref.current = element;
  }
}

type SaugeNoireFlipPageProps = {
  children: ReactNode;
  density: SaugeNoireFlipPageDensity;
  index: number;
};

/**
 * StPageFlip owns the page element after mount. Keeping this wrapper small
 * lets the existing Sauge Noire page components remain the only content
 * source while still exposing the real HTML page to the engine.
 */
export const SaugeNoireFlipPage = forwardRef<HTMLDivElement, SaugeNoireFlipPageProps>(
  function SaugeNoireFlipPage({ children, density, index }, ref) {
    const registry = useContext(SaugeNoireOriginalPageRegistryContext);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const registerPage = useCallback(
      (element: HTMLDivElement | null) => {
        const previous = elementRef.current;
        if (previous && previous !== element) {
          registry?.unregister(index, previous);
          delete (previous as SaugeNoireOriginalPageElement)[SAUGE_REACT_ORIGINAL_PAGE];
        }

        elementRef.current = element;
        if (element) {
          (element as SaugeNoireOriginalPageElement)[SAUGE_REACT_ORIGINAL_PAGE] = true;
          registry?.register(index, element);
        }
        assignForwardedRef(ref, element);
      },
      [index, ref, registry]
    );

    return (
      <div
        ref={registerPage}
        className={styles.pageFlipPage}
        data-density={density}
        data-sauge-flip-page-index={index}
        data-sauge-page-origin="react-original"
        data-sauge-page-instance-id={
          registry ? `${registry.bookId}:${index}` : `sauge-page:${index}`
        }
      >
        {children}
      </div>
    );
  }
);

SaugeNoireFlipPage.displayName = "SaugeNoireFlipPage";
