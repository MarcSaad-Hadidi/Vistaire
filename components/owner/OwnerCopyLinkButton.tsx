"use client";

import { useState } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";

export function OwnerCopyLinkButton({
  value,
  label = "Copier le lien"
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Lien copié.");
    } catch {
      setStatus("Copie indisponible.");
    }
  }

  return (
    <span className={styles.copyLinkControl}>
      <button type="button" className={styles.btn} onClick={copy}>
        {label}
      </button>
      {status ? (
        <span className={styles.qrStatus} role="status">
          {status}
        </span>
      ) : null}
    </span>
  );
}
