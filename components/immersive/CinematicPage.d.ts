import type { ReactNode } from "react";

type PhoneDemo = "maison-elyse" | "trouvable" | "sauge-noire";
type Collection = "acrylique" | "sculpte" | "carre" | "signature";

export type CinematicChapter = {
  /** Anchor id of the section. */
  id: string;
  /** Scene shot name, from Scene.jsx baseComposition or PageShots.js; unique per page. */
  shot: string;
  align?: "left" | "right" | "center";
  titleId?: string;
  content: ReactNode;
  /** Objects this chapter owns, changed while hidden between chapters. */
  scene?: { phoneDemo?: PhoneDemo; collection?: Collection };
  /** Laptop lid opening across the chapter, 0 closed to 1 open. */
  laptopLid?: [number, number];
};

export type CinematicScene = {
  dish?: "homard" | "souffle" | "huitres" | "sushi" | "chocolat-fume" | "poutine" | "burger";
  phoneDemo?: PhoneDemo;
  collection?: Collection;
};

export function CinematicPage(props: { chapters: CinematicChapter[]; scene?: CinematicScene; children?: ReactNode; footer?: ReactNode; mainProps?: Record<`data-${string}`, string> }): ReactNode;
