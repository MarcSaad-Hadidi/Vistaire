"use client";

import styles from "@/components/owner/OwnerCockpit.module.css";

export function ModelLabDropzone({
  file,
  disabled,
  onFile
}: {
  file: File | null;
  disabled: boolean;
  onFile: (file: File | null) => void;
}) {
  return (
    <label className={styles.sourceUploadDrop}>
      <span className={styles.sourceUploadEyebrow}>GLB source</span>
      <input
        data-testid="model-lab-file-input"
        type="file"
        accept=".glb,model/gltf-binary"
        disabled={disabled}
        onChange={(event) => onFile(event.currentTarget.files?.[0] ?? null)}
      />
      <span>
        {file
          ? `${file.name} - ${formatBytes(file.size)}`
          : "GLB local uniquement. Aucun fichier n'est stocke."}
      </span>
    </label>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
