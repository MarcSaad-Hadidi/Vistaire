import Image from "next/image";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

export function PublicPreviewDishImage({
  alt,
  src,
  sizes = "80px"
}: {
  alt: string;
  src: string;
  sizes?: string;
}) {
  return (
    <span className={styles.dishImage} data-preview-dish-image>
      <Image alt={alt} fill sizes={sizes} src={src} />
    </span>
  );
}
