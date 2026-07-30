"use client";

import Image from "next/image";
import { useState } from "react";

const PUBLIC_DISH_PHOTO_PATH =
  /^\/api\/public\/menu-dishes\/[0-9a-f-]{36}\/photo(?:\?|$)/i;

function shouldBypassNextImageOptimizer(src: string) {
  return PUBLIC_DISH_PHOTO_PATH.test(src) || /^https?:\/\//i.test(src);
}

export function PublicDishImage({
  alt,
  className,
  fallbackSrc,
  objectPosition = "center",
  priority = false,
  quality,
  sizes,
  src
}: {
  alt: string;
  className?: string;
  fallbackSrc?: string;
  objectPosition?: string;
  priority?: boolean;
  quality?: number;
  sizes: string;
  src?: string | null;
}) {
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const primarySrc = src?.trim() ?? "";
  const safeFallback = fallbackSrc?.trim() ?? "";
  const currentSrc =
    primarySrc && !failedSources.has(primarySrc)
      ? primarySrc
      : safeFallback && !failedSources.has(safeFallback)
        ? safeFallback
        : "";

  if (!currentSrc) {
    return (
      <span
        aria-label={alt}
        className={className}
        data-image-state="unavailable"
        role="img"
      />
    );
  }

  return (
    <Image
      alt={alt}
      className={className}
      data-image-state={currentSrc === primarySrc ? "ready" : "fallback"}
      data-public-dish-image=""
      fill
      onError={() => {
        setFailedSources((current) => {
          if (current.has(currentSrc)) return current;
          return new Set([...current, currentSrc]);
        });
      }}
      priority={priority}
      quality={quality}
      sizes={sizes}
      src={currentSrc}
      style={{ objectPosition }}
      unoptimized={shouldBypassNextImageOptimizer(currentSrc)}
    />
  );
}
