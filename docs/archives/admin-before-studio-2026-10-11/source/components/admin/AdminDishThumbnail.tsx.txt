"use client";

import Image from "next/image";
import { useState } from "react";
import {
  buildAdminDishPhotoUrl,
  isAdminDishPhotoUrl
} from "@/lib/admin/dishPhotoUrl";
import { AvailableDishIcon } from "./system/AdminIcons";
import styles from "./AdminDishThumbnail.module.css";

type AdminDishThumbnailProps = {
  name: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  sizes?: string;
  compact?: boolean;
  priority?: boolean;
};

export function AdminDishThumbnail({
  name,
  thumbnailUrl,
  imageUrl,
  sizes = "(max-width: 700px) 112px, 160px",
  compact = false,
  priority = false
}: AdminDishThumbnailProps) {
  const requestedSource = thumbnailUrl || imageUrl;
  const source = buildAdminDishPhotoUrl(requestedSource);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showFallback = !source || failedSource === source;
  return (
    <span
      className={`${styles.frame} ${compact ? styles.compact : ""}`}
      data-admin-dish-thumbnail
    >
      {showFallback ? (
        <span
          className={styles.fallback}
          role="img"
          aria-label={`Aucune photo disponible pour ${name}`}
          data-admin-dish-thumbnail-fallback
        >
          <AvailableDishIcon />
        </span>
      ) : (
        // The authenticated admin route must receive the browser session cookie;
        // Next's server-side image optimizer cannot forward that cookie.
        <Image
          src={source}
          alt={`Photo de ${name}`}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={isAdminDishPhotoUrl(source)}
          className={thumbnailUrl ? styles.cover : styles.contain}
          onError={() => setFailedSource(source)}
        />
      )}
    </span>
  );
}
