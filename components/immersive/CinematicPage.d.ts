import type { ReactNode } from "react";

export type CinematicChapter = {
  /** Anchor id of the section. */
  id: string;
  /** Scene shot name, from Scene.jsx baseComposition; unique per page. */
  shot: string;
  align?: "left" | "right" | "center";
  titleId?: string;
  content: ReactNode;
};

export function CinematicPage(props: { chapters: CinematicChapter[]; children?: ReactNode }): ReactNode;
