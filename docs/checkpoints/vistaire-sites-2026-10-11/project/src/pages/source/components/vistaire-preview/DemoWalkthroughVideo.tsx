"use client";
import { resolveMedia } from "../../../media.js";
import VideoSurface from "../../../../VideoSurface.jsx";
export function DemoWalkthroughVideo({
  label,
  poster,
  src,
  playLabel,
}: {
  label: string;
  poster: string;
  src: string;
  playLabel?: string;
}) {
  return (
    <div className="public-film-frame">
      <VideoSurface
        src={resolveMedia(src)}
        poster={resolveMedia(poster)}
        label={label}
        posterClass="public-film-poster"
        playLabel={playLabel}
      />
    </div>
  );
}
