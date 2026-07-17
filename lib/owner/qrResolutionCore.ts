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

export function isQrMetadataRpcUnavailable(
  error: { code?: string | null; message?: string | null } | null
): boolean {
  if (!error) return false;
  const code = error.code?.trim();
  if (code) return code === "42883" || code === "PGRST202";

  const message = error.message ?? "";
  return (
    /(?:function\s+)?(?:public\.)?resolve_qr_code_scan_metadata(?:\s*\([^)]*\))?[\s\S]{0,80}(?:does not exist|not found)/i.test(
      message
    ) ||
    /(?:could not find|not found)[\s\S]{0,80}(?:the\s+)?function\s+(?:public\.)?resolve_qr_code_scan_metadata(?:\s*\([^)]*\))?[\s\S]{0,100}schema cache/i.test(
      message
    )
  );
}

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
  return resolveLegacyQrScan({ ...row, targetKind: "menu" }, expectedPath);
}

export function resolveLegacyQrScan(
  row: QrRowMetadata & { targetKind: OwnerQrTargetKind },
  expectedPath: string
): QrResolution {
  const normalizedExpectedPath = sanitizeOwnerQrTargetPath(expectedPath);
  if (!normalizedExpectedPath) return { ok: false };
  return resolveQrRowMetadata(row, normalizedExpectedPath);
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
