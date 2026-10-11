import { forwardRef, type ImgHTMLAttributes } from "react";
import { resolveMedia } from "./media.js";
export type StaticImageData =
  string | { src: string; width?: number; height?: number };
type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: StaticImageData;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  unoptimized?: boolean;
};
const Image = forwardRef<HTMLImageElement, Props>(function Image(
  {
    src,
    fill,
    priority,
    quality: _quality,
    unoptimized: _unoptimized,
    style,
    loading,
    ...props
  },
  ref,
) {
  return (
    <img
      {...props}
      ref={ref}
      src={resolveMedia(src)}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : (loading ?? "lazy")}
      style={{
        ...(fill
          ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
          : {}),
        ...style,
      }}
    />
  );
});
export default Image;
