import {
  inferOwnerQrTargetKind,
  isOwnerQrTargetPathAllowed,
  sanitizeOwnerQrTargetPath,
  type OwnerQrTargetKind
} from "./menuUrlCore.ts";

export type QrResolution =
  | {
      ok: true;
      qrId: string;
      restaurantId: string;
      targetKind: OwnerQrTargetKind;
      targetPath: string;
    }
  | { ok: false };

type QrRowMetadata = {
  qrId: string;
  restaurantId: string;
  status: string;
  targetKind?: OwnerQrTargetKind;
  targetPath: string;
};

export function resolveQrRowMetadata(
  row: QrRowMetadata,
  expectedPath?: string
): QrResolution {
  const targetPath = sanitizeOwnerQrTargetPath(row.targetPath);
  if (!row.qrId.trim() || row.status !== "active" || !targetPath) {
    return { ok: false };
  }
  if (expectedPath && targetPath !== expectedPath) return { ok: false };

  const targetKind = row.targetKind ?? inferOwnerQrTargetKind(targetPath);
  if (targetKind === "admin" && !row.restaurantId.trim()) return { ok: false };
  if (!isOwnerQrTargetPathAllowed(targetKind, targetPath)) {
    return { ok: false };
  }
  return {
    ok: true,
    qrId: row.qrId,
    restaurantId: row.restaurantId,
    targetKind,
    targetPath
  };
}

export function resolveLegacyMenuQrScan(
  row: Omit<QrRowMetadata, "targetKind">,
  expectedPath: string
): QrResolution {
  const targetPath = sanitizeOwnerQrTargetPath(row.targetPath);
  const normalizedExpectedPath = sanitizeOwnerQrTargetPath(expectedPath);
  if (
    !row.qrId.trim() ||
    row.status !== "active" ||
    !targetPath ||
    !normalizedExpectedPath ||
    targetPath !== normalizedExpectedPath ||
    !isOwnerQrTargetPathAllowed("menu", targetPath)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    qrId: row.qrId,
    restaurantId: row.restaurantId,
    targetKind: "menu",
    targetPath
  };
}

export function resolveSignedMenuFallback(input: {
  restaurantId: string;
  targetPath: string;
}): QrResolution {
  const targetPath = sanitizeOwnerQrTargetPath(input.targetPath);
  if (!targetPath || !isOwnerQrTargetPathAllowed("menu", targetPath)) {
    return { ok: false };
  }
  return {
    ok: true,
    qrId: "signed-menu-fallback",
    restaurantId: input.restaurantId,
    targetKind: "menu",
    targetPath
  };
}
