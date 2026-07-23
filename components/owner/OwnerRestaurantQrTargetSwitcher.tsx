"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./OwnerRestaurantQrTargetSwitcher.module.css";

export type OwnerRestaurantQrTarget = "menu" | "admin";

export function OwnerRestaurantQrTargetSwitcher({
  restaurantId,
  targetKind
}: {
  restaurantId: string;
  targetKind: OwnerRestaurantQrTarget;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectTarget(nextTarget: OwnerRestaurantQrTarget) {
    if (nextTarget === targetKind) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("target", nextTarget);
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <div
      className={styles.root}
      role="group"
      aria-label="Cible du QR code"
      data-restaurant-id={restaurantId}
    >
      <button
        type="button"
        className={targetKind === "menu" ? styles.active : styles.button}
        aria-pressed={targetKind === "menu"}
        onClick={() => selectTarget("menu")}
      >
        <strong>QR client public</strong>
        <span>Ouvre le menu du restaurant</span>
      </button>
      <button
        type="button"
        className={targetKind === "admin" ? styles.active : styles.button}
        aria-pressed={targetKind === "admin"}
        onClick={() => selectTarget("admin")}
      >
        <strong>QR admin privé</strong>
        <span>Ouvre l’accès owner sécurisé</span>
      </button>
    </div>
  );
}
