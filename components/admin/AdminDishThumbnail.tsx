import Image from "next/image";
import { AvailableDishIcon } from "./system/AdminIcons";
import styles from "./AdminDishThumbnail.module.css";

export function AdminDishThumbnail({ name, thumbnailUrl, imageUrl, sizes = "(max-width: 700px) 112px, 160px", compact = false }: { name: string; thumbnailUrl?: string | null; imageUrl?: string | null; sizes?: string; compact?: boolean }) {
  const source = thumbnailUrl || imageUrl;
  return <span className={`${styles.frame} ${compact ? styles.compact : ""}`} data-admin-dish-thumbnail>{source ? <Image src={source} alt={`Présentation de ${name}`} fill sizes={sizes} className={thumbnailUrl ? styles.cover : styles.contain}/> : <span className={styles.fallback} role="img" aria-label={`Aucune photo disponible pour ${name}`}><AvailableDishIcon/></span>}</span>;
}
