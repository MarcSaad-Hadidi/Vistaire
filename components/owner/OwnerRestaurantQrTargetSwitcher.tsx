"use client";

import type { KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./OwnerRestaurantQrTargetSwitcher.module.css";

export type OwnerRestaurantQrTarget = "menu" | "admin";

const TARGETS: readonly OwnerRestaurantQrTarget[] = ["menu", "admin"];

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

  function moveSelection(
    event: KeyboardEvent<HTMLButtonElement>,
    nextTarget: OwnerRestaurantQrTarget
  ) {
    event.preventDefault();
    selectTarget(nextTarget);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-qr-target="${nextTarget}"]`)
      ?.focus();
  }

  function handleRadioKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTarget: OwnerRestaurantQrTarget
  ) {
    const currentIndex = TARGETS.indexOf(currentTarget);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      moveSelection(event, TARGETS[(currentIndex + 1) % TARGETS.length]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      moveSelection(
        event,
        TARGETS[(currentIndex - 1 + TARGETS.length) % TARGETS.length]
      );
    } else if (event.key === "Home") {
      moveSelection(event, TARGETS[0]);
    } else if (event.key === "End") {
      moveSelection(event, TARGETS[TARGETS.length - 1]);
    }
  }

  return (
    <div
      className={styles.root}
      role="radiogroup"
      aria-label="Cible du QR code"
      data-restaurant-id={restaurantId}
    >
      <button
        type="button"
        role="radio"
        className={targetKind === "menu" ? styles.active : styles.button}
        aria-checked={targetKind === "menu"}
        data-qr-target="menu"
        tabIndex={targetKind === "menu" ? 0 : -1}
        onClick={() => selectTarget("menu")}
        onKeyDown={(event) => handleRadioKeyDown(event, "menu")}
      >
        <strong>QR client public</strong>
        <span>Ouvre le menu du restaurant</span>
      </button>
      <button
        type="button"
        role="radio"
        className={targetKind === "admin" ? styles.active : styles.button}
        aria-checked={targetKind === "admin"}
        data-qr-target="admin"
        tabIndex={targetKind === "admin" ? 0 : -1}
        onClick={() => selectTarget("admin")}
        onKeyDown={(event) => handleRadioKeyDown(event, "admin")}
      >
        <strong>QR admin privé</strong>
        <span>Ouvre l’accès owner sécurisé</span>
      </button>
    </div>
  );
}
