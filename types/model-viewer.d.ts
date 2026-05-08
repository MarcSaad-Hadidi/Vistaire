import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  src?: string;
  "ios-src"?: string;
  alt?: string;
  "camera-controls"?: boolean | "";
  "auto-rotate"?: boolean | "";
  ar?: boolean | "";
  "ar-modes"?: string;
  "shadow-intensity"?: string;
  "environment-image"?: string;
  exposure?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps;
    }
  }
}

export {};
