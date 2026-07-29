"use client";

import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type ReactNode,
  type UIEventHandler
} from "react";
import styles from "./SaugeNoireReadingSurface.module.css";

export type SaugeNoireReadingKind = "menu" | "dish" | "route-preview";

type SaugeNoireReadingSurfaceProps = {
  children: ReactNode;
  kind: SaugeNoireReadingKind;
  pageIndex?: number;
  visible: boolean;
  preview?: boolean;
  onScroll?: UIEventHandler<HTMLDivElement>;
} & Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "inert" | "onScroll"
>;

export const SaugeNoireReadingSurface = forwardRef<
  HTMLDivElement,
  SaugeNoireReadingSurfaceProps
>(function SaugeNoireReadingSurface(
  {
    children,
    className,
    kind,
    pageIndex,
    visible,
    preview = false,
    onScroll,
    ...surfaceProps
  },
  ref
) {
  return (
    <div
      {...surfaceProps}
      ref={ref}
      className={`${styles.surface} ${className ?? ""}`}
      data-sauge-reading-surface="true"
      data-sauge-scroll-owner={visible ? "true" : "false"}
      data-sauge-reading-visible={visible ? "true" : "false"}
      data-sauge-reading-page-index={pageIndex}
      data-sauge-reading-kind={kind}
      aria-hidden={preview || !visible || undefined}
      inert={!visible ? true : undefined}
      onScroll={onScroll}
    >
      {children}
    </div>
  );
});
