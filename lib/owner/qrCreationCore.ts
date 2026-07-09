import { buildQrRedirectPath } from "./menuUrlCore.ts";
import { DEFAULT_OWNER_QR_STYLE, normalizeOwnerQrStyle } from "./qrStyle.ts";
import type {
  CreateOwnerQrCodeResult,
  OwnerQrCodeRecord,
  OwnerQrTargetKind
} from "./types.ts";

export type CreateOwnerQrCodeArgs = {
  restaurantId: string;
  label: string;
  targetPath: string;
  targetKind?: OwnerQrTargetKind;
  style?: unknown;
};

type CreationDependencies = {
  persistQrCode: (args: CreateOwnerQrCodeArgs) => Promise<CreateOwnerQrCodeResult>;
  createSignedMenuFallback: (
    args: CreateOwnerQrCodeArgs
  ) => string | CreateOwnerQrCodeResult;
};

export async function createOwnerQrCodeWithDependencies(
  args: CreateOwnerQrCodeArgs,
  dependencies: CreationDependencies
): Promise<CreateOwnerQrCodeResult> {
  const persisted = await dependencies.persistQrCode(args);
  if (persisted.ok || args.targetKind === "admin") return persisted;

  const fallback = dependencies.createSignedMenuFallback(args);
  if (typeof fallback !== "string") return fallback;

  const now = new Date().toISOString();
  const style = args.style ? normalizeOwnerQrStyle(args.style) : DEFAULT_OWNER_QR_STYLE;
  const record: OwnerQrCodeRecord = {
    id: `local-${fallback.slice(0, 6)}`,
    restaurantId: args.restaurantId,
    label: args.label,
    targetKind: "menu",
    tokenPreview: `${fallback.slice(0, 6)}...`,
    targetPath: args.targetPath,
    redirectUrl: buildQrRedirectPath(fallback),
    status: "active",
    scanCount: 0,
    lastScannedAt: null,
    style,
    persisted: false,
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, record, token: fallback, persisted: false };
}
