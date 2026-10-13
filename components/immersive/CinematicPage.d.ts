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

export type CinematicScene = {
  dish?: "homard" | "huitres" | "sushi" | "chocolat-fume" | "poutine" | "burger";
  phoneDemo?: "maison-elyse" | "trouvable" | "sauge-noire";
  collection?: "acrylique" | "sculpte" | "carre" | "signature";
};

export function CinematicPage(props: { chapters: CinematicChapter[]; scene?: CinematicScene; children?: ReactNode }): ReactNode;
