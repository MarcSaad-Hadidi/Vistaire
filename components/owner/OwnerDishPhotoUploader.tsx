"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";

type OwnerDishPhotoUploaderProps = {
  restaurantId: string;
  dishId: string;
  dishName: string;
  initialImageUrl?: string;
};

export function OwnerDishPhotoUploader({
  restaurantId,
  dishId,
  dishName,
  initialImageUrl = ""
}: OwnerDishPhotoUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [status, setStatus] = useState(imageUrl ? "Photo prete" : "Photo manquante");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const statusId = `dish-photo-status-${dishId}`;
  const errorId = `dish-photo-error-${dishId}`;
  const describedBy = error ? `${statusId} ${errorId}` : statusId;

  async function upload(file: File) {
    setIsUploading(true);
    setError("");
    setStatus("Upload en cours");

    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch(
        `/api/owner/restaurants/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}/photo`,
        {
          method: "POST",
          body: formData
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        imageUrl?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.imageUrl) {
        throw new Error(payload.error || "Upload photo impossible.");
      }

      setImageUrl(payload.imageUrl);
      setStatus("Photo prete");
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload photo impossible.");
      setStatus(imageUrl ? "Photo prete" : "Photo manquante");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={styles.tableActions} aria-busy={isUploading}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={dishName}
          src={imageUrl}
          width={56}
          height={56}
          style={{
            borderRadius: 8,
            objectFit: "cover",
            border: "1px solid rgba(232, 207, 155, 0.2)"
          }}
        />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-describedby={describedBy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSmall}`}
        disabled={isUploading}
        aria-describedby={describedBy}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? "Upload..." : imageUrl ? "Remplacer photo" : "Ajouter photo"}
      </button>
      <span id={statusId} className={styles.cellSub} aria-live="polite">
        {status}
      </span>
      {error ? (
        <span id={errorId} className={styles.errorText} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
