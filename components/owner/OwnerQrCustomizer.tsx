"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "@/components/owner/OwnerCockpit.module.css";
import {
  DEFAULT_OWNER_QR_STYLE,
  OWNER_QR_LOGO_MAX_PERCENT,
  OWNER_QR_LOGO_MIN_PERCENT,
  OWNER_QR_PADDING_MAX,
  OWNER_QR_PADDING_MIN,
  OWNER_QR_PRESETS,
  QR_MIN_SAFE_CONTRAST,
  monogramFromName,
  normalizeOwnerQrStyle,
  qrContrastRatio
} from "@/lib/owner/qrStyle";
import type {
  OwnerQrCodeRecord,
  OwnerQrStyle,
  OwnerQrTargetKind
} from "@/lib/owner/types";

type OwnerQrCustomizerProps = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  targetKind: OwnerQrTargetKind;
  targetLabel: string;
  targetUsage: string;
  targetBadgeLabel: string;
  targetPath: string;
  targetDisplayUrl: string;
  initialQrStyle?: Partial<OwnerQrStyle>;
  className?: string;
};

type QrLifecycleStatus = "active" | "paused" | "archived" | "revoked";
type ConfigVersion = number;
type QrLifecycleRecord = Omit<OwnerQrCodeRecord, "status"> & {
  status: QrLifecycleStatus;
  configVersion?: ConfigVersion;
};
type SafeHistoryRecord = Pick<
  QrLifecycleRecord,
  | "id"
  | "label"
  | "status"
  | "isCanonical"
  | "recoverable"
  | "scanCount"
  | "createdAt"
  | "updatedAt"
>;

type QrMachineState =
  | "loading"
  | "absent"
  | "creating"
  | "active-recoverable-clean"
  | "active-recoverable-dirty"
  | "unrecoverable"
  | "updating"
  | "paused"
  | "rotating"
  | "archived"
  | "revoked"
  | "stale-conflict"
  | "failed";

type Operation = "creating" | "updating" | "rotating" | null;
type Outcome =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };
type DialogAction = "rotate" | "archive" | "revoke";
type StatusAction = "pause" | "resume" | "archive" | "revoke";
type PreviousDisposition = "keep-active" | "pause" | "revoke";

type QrApiPayload = {
  ok: boolean;
  error?: string;
  code?: string;
  found?: boolean;
  recoverable?: boolean;
  configVersion?: ConfigVersion;
  canonical?: QrLifecycleRecord | null;
  record?: QrLifecycleRecord | null;
  current?: QrLifecycleRecord | null;
  previous?: QrLifecycleRecord | null;
  history?: QrLifecycleRecord[];
  redirectUrl?: string;
  targetPath?: string;
  targetKind?: OwnerQrTargetKind;
  persisted?: boolean;
};

type QrInventoryPayload = {
  ok: boolean;
  error?: string;
  canonicalId?: string | null;
  canonical?: { id?: string } | null;
  records?: unknown[];
  inventory?: unknown[];
  history?: unknown[];
};

const STATUS_LABELS: Record<QrLifecycleStatus, string> = {
  active: "Actif",
  paused: "En pause",
  archived: "Archivé",
  revoked: "Révoqué"
};

function isOpaqueQrRedirect(value: string): boolean {
  try {
    const url = new URL(value, "https://vistaire.local");
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      /^\/q\/[A-Za-z0-9._~-]+$/.test(url.pathname) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function isLifecycleStatus(value: unknown): value is QrLifecycleStatus {
  return (
    value === "active" ||
    value === "paused" ||
    value === "archived" ||
    value === "revoked"
  );
}

function canonicalFromPayload(payload: QrApiPayload): QrLifecycleRecord | null {
  const candidate = payload.canonical ?? payload.record ?? payload.current ?? null;
  return candidate && isLifecycleStatus(candidate.status) ? candidate : null;
}

function configVersionFromPayload(
  payload: QrApiPayload,
  record: QrLifecycleRecord | null
): ConfigVersion | null {
  const value = payload.configVersion ?? record?.configVersion;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? value
    : null;
}

function normalizeSafeHistory(
  records: unknown[],
  scope: {
    restaurantId: string;
    targetKind: OwnerQrTargetKind;
    canonicalId?: string | null;
  }
): SafeHistoryRecord[] {
  return records.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return [];
    }
    const record = candidate as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      record.restaurantId !== scope.restaurantId ||
      record.targetKind !== scope.targetKind ||
      record.purposeKey !== "default" ||
      !isLifecycleStatus(record.status) ||
      record.isCanonical === true ||
      record.id === scope.canonicalId
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        label: typeof record.label === "string" ? record.label : "",
        status: record.status,
        isCanonical: false,
        recoverable: Boolean(record.recoverable),
        scanCount:
          typeof record.scanCount === "number" && Number.isFinite(record.scanCount)
            ? record.scanCount
            : 0,
        createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : ""
      }
    ];
  });
}

function inventoryRecords(payload: QrInventoryPayload): unknown[] {
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.inventory)) return payload.inventory;
  if (Array.isArray(payload.history)) return payload.history;
  return [];
}

function mutationError(payload: QrApiPayload, fallback: string): string {
  return payload.error?.trim() || fallback;
}

function statusAfterAction(action: StatusAction): QrLifecycleStatus {
  if (action === "pause") return "paused";
  if (action === "resume") return "active";
  if (action === "archive") return "archived";
  return "revoked";
}

export function OwnerQrCustomizer({
  restaurantId,
  restaurantName,
  restaurantSlug,
  targetKind,
  targetLabel,
  targetUsage,
  targetBadgeLabel,
  targetPath,
  targetDisplayUrl,
  initialQrStyle,
  className = ""
}: OwnerQrCustomizerProps) {
  const [style, setStyle] = useState<OwnerQrStyle>(() => ({
    ...DEFAULT_OWNER_QR_STYLE,
    logoText: monogramFromName(restaurantName),
    ...initialQrStyle
  }));
  const [svgMarkup, setSvgMarkup] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [canonicalRecord, setCanonicalRecord] =
    useState<QrLifecycleRecord | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [operation, setOperation] = useState<Operation>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [configVersion, setConfigVersion] = useState<ConfigVersion | null>(null);
  const [history, setHistory] = useState<SafeHistoryRecord[]>([]);
  const [historyLoadState, setHistoryLoadState] =
    useState<"loading" | "ready" | "error">("loading");
  const [savedStyleFingerprint, setSavedStyleFingerprint] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);
  const [previousDisposition, setPreviousDisposition] =
    useState<PreviousDisposition>("keep-active");
  const styleTouchedDuringLoad = useRef(false);
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const loadSequence = useRef(0);

  const contrast = useMemo(() => qrContrastRatio(style), [style]);
  const styleFingerprint = useMemo(
    () => JSON.stringify(normalizeOwnerQrStyle(style)),
    [style]
  );
  const lowContrast = contrast > 0 && contrast < QR_MIN_SAFE_CONTRAST;
  const fileSlug = restaurantSlug || "restaurant";
  const exactDestinationUrl = useMemo(
    () => targetDisplayUrl || targetPath,
    [targetDisplayUrl, targetPath]
  );
  const safeDestinationUrl =
    targetKind === "admin"
      ? qrValue || "Indisponible — URL opaque non récupérable"
      : exactDestinationUrl;
  const canExportQr = Boolean(
    qrValue &&
      svgMarkup &&
      canonicalRecord?.isCanonical === true &&
      canonicalRecord?.status === "active"
  );
  const styleDirty = Boolean(
    canonicalRecord && savedStyleFingerprint !== styleFingerprint
  );
  const machineState: QrMachineState = useMemo(() => {
    if (loadState === "loading") return "loading";
    if (outcome.kind === "conflict") return "stale-conflict";
    if (loadState === "error" || outcome.kind === "error") return "failed";
    if (operation) return operation;
    if (!canonicalRecord) return "absent";
    if (canonicalRecord.status === "archived") return "archived";
    if (canonicalRecord.status === "revoked") return "revoked";
    if (!canonicalRecord.recoverable || !qrValue) return "unrecoverable";
    if (canonicalRecord.status === "paused") return "paused";
    return styleDirty
      ? "active-recoverable-dirty"
      : "active-recoverable-clean";
  }, [canonicalRecord, loadState, operation, outcome.kind, qrValue, styleDirty]);
  const mutationBusy = operation !== null;
  const statusReasonId = `qr-status-reason-${targetKind}`;
  const terminalState =
    canonicalRecord?.status === "archived" || canonicalRecord?.status === "revoked";
  const requiresReload =
    machineState === "stale-conflict" || machineState === "failed";
  const styleControlsDisabled =
    mutationBusy ||
    loadState !== "ready" ||
    terminalState ||
    machineState === "unrecoverable" ||
    requiresReload;
  const stateCopy = useMemo(() => {
    const copy: Record<QrMachineState, string> = {
      loading: "Chargement du QR canonique…",
      absent: "Aucun QR n’existe encore pour cette destination.",
      creating: "Création sécurisée du QR en cours…",
      "active-recoverable-clean": "QR actif. Le style enregistré est à jour.",
      "active-recoverable-dirty": "QR actif. Le style contient des modifications non enregistrées.",
      unrecoverable:
        "QR trouvé, mais son URL sécurisée ne peut pas être récupérée. Aucune URL n’est affichée.",
      updating: "Mise à jour du QR en cours…",
      paused: "QR en pause. Les scans sont bloqués jusqu’à sa reprise.",
      rotating: "Rotation sécurisée du QR en cours…",
      archived: "QR archivé. Cet état est définitif.",
      revoked: "QR révoqué. Son accès est définitivement invalidé.",
      "stale-conflict": "Conflit avec une version plus récente du serveur.",
      failed: "État QR indisponible. Aucune action sensible n’est autorisée."
    };
    return copy[machineState];
  }, [machineState]);

  const qrValueForBrowser = useCallback((value: string): string => {
    if (!value.startsWith("/") || typeof window === "undefined") return value;
    return new URL(value, window.location.origin).toString();
  }, []);

  useEffect(() => {
    if (!qrValue) return;
    let active = true;
    async function render() {
      try {
        const { renderOwnerQrSvg } = await import("@/lib/owner/qrRenderer");
        const svg = await renderOwnerQrSvg({
          url: qrValueForBrowser(qrValue),
          style,
          restaurantName,
          targetKind,
          qrId: canonicalRecord?.id,
          configVersion: canonicalRecord?.configVersion,
          dimensions: 320,
          mode: "preview"
        });
        if (active) setSvgMarkup(svg);
      } catch {
        if (active) setSvgMarkup("");
      }
    }
    void render();
    return () => {
      active = false;
    };
  }, [canonicalRecord?.configVersion, canonicalRecord?.id, qrValue, qrValueForBrowser, restaurantName, style, targetKind]);

  const loadCanonicalQr = useCallback(async () => {
    const sequence = ++loadSequence.current;
    await Promise.resolve();
    if (sequence !== loadSequence.current) return;
    styleTouchedDuringLoad.current = false;
    setLoadState("loading");
    setOperation(null);
    setOutcome({ kind: "idle" });
    setCanonicalRecord(null);
    setSavedStyleFingerprint("");
    setConfigVersion(null);
    setHistory([]);
    setHistoryLoadState("loading");
    setQrValue("");
    try {
      const query = new URLSearchParams({
        restaurantId,
        targetKind,
        purposeKey: "default"
      });
      const inventoryQuery = new URLSearchParams({ restaurantId });
      const canonicalRequest = fetch(`/api/owner/qr-codes?${query}`, {
        cache: "no-store"
      });
      const inventoryRequest = fetch(
        `/api/owner/qr-codes/inventory?${inventoryQuery}`,
        { cache: "no-store" }
      )
        .then(async (inventoryResponse) => {
          try {
            const inventoryPayload =
              (await inventoryResponse.json()) as QrInventoryPayload;
            return { inventoryResponse, inventoryPayload };
          } catch {
            return null;
          }
        })
        .catch(() => null);
      const response = await canonicalRequest;
      const payload = (await response.json()) as QrApiPayload;
      const inventoryResult = await inventoryRequest;
      if (sequence !== loadSequence.current) return;
      if (!response.ok || !payload.ok) {
        setLoadState("error");
        setOutcome({
          kind: "error",
          message: mutationError(payload, "Chargement du QR canonique impossible.")
        });
        return;
      }
      if (
        inventoryResult?.inventoryResponse.ok &&
        inventoryResult.inventoryPayload.ok &&
        Array.isArray(inventoryResult.inventoryPayload.records)
      ) {
        const inventoryPayload = inventoryResult.inventoryPayload;
        setHistory(
          normalizeSafeHistory(inventoryRecords(inventoryPayload), {
            restaurantId,
            targetKind,
            canonicalId:
              inventoryPayload.canonicalId ??
              inventoryPayload.canonical?.id ??
              payload.canonical?.id ??
              payload.record?.id ??
              null
          })
        );
        setHistoryLoadState("ready");
      } else {
        setHistory([]);
        setHistoryLoadState("error");
      }
      if (payload.found === false) {
        setLoadState("ready");
        return;
      }
      const record = canonicalFromPayload(payload);
      if (!record) {
        setLoadState("error");
        setOutcome({
          kind: "error",
          message: "Réponse QR canonique invalide. Rechargez avant toute action."
        });
        return;
      }
      const nextConfigVersion = configVersionFromPayload(payload, record);
      setCanonicalRecord(record);
      setConfigVersion(nextConfigVersion);
      if (!styleTouchedDuringLoad.current) setStyle(record.style);
      setSavedStyleFingerprint(
        JSON.stringify(normalizeOwnerQrStyle(record.style))
      );
      const recoverable = payload.recoverable ?? record.recoverable;
      if (
        recoverable &&
        record.status !== "archived" &&
        record.status !== "revoked" &&
        record.redirectUrl &&
        isOpaqueQrRedirect(record.redirectUrl)
      ) {
        setQrValue(record.redirectUrl);
      }
      setLoadState("ready");
    } catch {
      if (sequence !== loadSequence.current) return;
      setLoadState("error");
      setHistoryLoadState("error");
      setOutcome({
        kind: "error",
        message: "Erreur réseau pendant le chargement du QR."
      });
    }
  }, [restaurantId, targetKind]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadCanonicalQr(), 0);
    return () => {
      window.clearTimeout(timeout);
      loadSequence.current += 1;
    };
  }, [loadCanonicalQr]);

  const update = useCallback((patch: Partial<OwnerQrStyle>) => {
    styleTouchedDuringLoad.current = true;
    setOutcome({ kind: "idle" });
    setStyle((prev) => {
      const next = { ...prev, ...patch };
      if (next.logoMode !== "none") next.errorCorrectionLevel = "H";
      return next;
    });
  }, []);

  function applyPreset(presetId: string) {
    const preset = OWNER_QR_PRESETS.find((item) => item.id === presetId);
    if (preset) update(preset.style);
  }

  function reset() {
    styleTouchedDuringLoad.current = true;
    setStyle({
      ...DEFAULT_OWNER_QR_STYLE,
      logoText: monogramFromName(restaurantName)
    });
  }

  async function copyUrl() {
    if (!qrValue) return;
    try {
      await navigator.clipboard.writeText(qrValueForBrowser(qrValue));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function downloadSvg() {
    if (!canExportQr) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(URL.createObjectURL(blob), `vistaire-qr-${fileSlug}.svg`);
  }

  function downloadPng() {
    if (!canExportQr) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 720;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(image, 0, 0, size, size);
      try {
        triggerDownload(canvas.toDataURL("image/png"), `vistaire-qr-${fileSlug}.png`);
      } catch {
        setOutcome({
          kind: "error",
          message: "Export PNG indisponible avec un logo image distant. Utilisez le SVG."
        });
      }
      URL.revokeObjectURL(url);
    };
    image.onerror = () => URL.revokeObjectURL(url);
    image.src = url;
  }

  function applyCanonicalResponse(
    payload: QrApiPayload,
    options: { preserveKnownUrl?: boolean } = {}
  ): QrLifecycleRecord | null {
    const record = canonicalFromPayload(payload);
    if (!record || record.targetKind !== targetKind) return null;
    const persisted = Boolean(payload.persisted ?? record.persisted);
    if (targetKind === "admin" && !persisted) return null;
    const responseUrl = payload.redirectUrl ?? record.redirectUrl;
    const nextQrValue =
      responseUrl && isOpaqueQrRedirect(responseUrl)
        ? responseUrl
        : options.preserveKnownUrl && canonicalRecord?.id === record.id
          ? qrValue
          : "";
    const recoverable =
      payload.recoverable ??
      record.recoverable ??
      (options.preserveKnownUrl && canonicalRecord?.id === record.id
        ? canonicalRecord.recoverable
        : false);
    if (recoverable && !nextQrValue) return null;

    setCanonicalRecord({
      ...record,
      recoverable: Boolean(recoverable)
    });
    setConfigVersion(configVersionFromPayload(payload, record));
    if (payload.history) {
      setHistory(
        normalizeSafeHistory(payload.history, {
          restaurantId,
          targetKind,
          canonicalId: record.id
        })
      );
      setHistoryLoadState("ready");
    }
    setStyle(record.style);
    setSavedStyleFingerprint(
      JSON.stringify(normalizeOwnerQrStyle(record.style))
    );
    setQrValue(
      recoverable && record.status !== "archived" && record.status !== "revoked"
        ? nextQrValue
        : ""
    );
    return record;
  }

  function handleMutationFailure(
    response: Response,
    payload: QrApiPayload,
    fallback: string
  ) {
    if (response.status === 409) {
      setOutcome({
        kind: "conflict",
        message:
          "Le QR a changé sur le serveur. Rechargez sa version actuelle avant de continuer."
      });
      return;
    }
    setOutcome({ kind: "error", message: mutationError(payload, fallback) });
  }

  async function saveStyle() {
    if (loadState !== "ready" || mutationBusy) return;
    const isUpdate = Boolean(canonicalRecord?.id);
    if (isUpdate && !styleDirty) return;
    if (isUpdate && configVersion === null) {
      setOutcome({
        kind: "error",
        message: "Version de configuration absente. Rechargez avant d’enregistrer."
      });
      return;
    }
    setOperation(isUpdate ? "updating" : "creating");
    setOutcome({ kind: "idle" });
    try {
      const response = await fetch(
        isUpdate
          ? `/api/owner/qr-codes/${encodeURIComponent(canonicalRecord!.id)}`
          : "/api/owner/qr-codes",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isUpdate
              ? {
                  style: normalizeOwnerQrStyle(style),
                  expectedConfigVersion: configVersion
                }
              : {
                  restaurantId,
                  label: targetLabel,
                  targetKind,
                  purposeKey: "default",
                  style: normalizeOwnerQrStyle(style)
                }
          )
        }
      );
      const payload = (await response.json()) as QrApiPayload;
      if (!response.ok || !payload.ok) {
        handleMutationFailure(response, payload, "Sauvegarde QR impossible.");
        return;
      }
      const record = applyCanonicalResponse(payload, {
        preserveKnownUrl: isUpdate
      });
      if (!record) {
        setOutcome({
          kind: "error",
          message: "Réponse QR invalide. Aucune modification n’est confirmée."
        });
        return;
      }
      setOutcome({
        kind: "success",
        message: isUpdate
          ? "Style du QR enregistré."
          : record.targetKind === "admin"
            ? "QR sécurisé créé et enregistré. URL opaque /q/... disponible."
            : `QR sécurisé créé et enregistré. Type ${record.targetKind}; destination ${record.targetPath}.`
      });
    } catch {
      setOutcome({
        kind: "error",
        message: "Erreur réseau pendant la sauvegarde."
      });
    } finally {
      setOperation(null);
    }
  }

  async function mutateStatus(action: StatusAction) {
    if (!canonicalRecord || mutationBusy) return;
    if (configVersion === null) {
      setOutcome({
        kind: "error",
        message: "Version de configuration absente. Rechargez avant l’action QR."
      });
      return;
    }
    const expectedConfigVersion = configVersion;
    const idempotencyKey = crypto.randomUUID();
    setOperation("updating");
    setOutcome({ kind: "idle" });
    try {
      const response = await fetch(
        `/api/owner/qr-codes/${encodeURIComponent(canonicalRecord.id)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            expectedConfigVersion,
            idempotencyKey
          })
        }
      );
      const payload = (await response.json()) as QrApiPayload;
      if (!response.ok || !payload.ok) {
        handleMutationFailure(response, payload, "Action QR impossible.");
        return;
      }
      const responseRecord = canonicalFromPayload(payload);
      const nextConfigVersion = configVersionFromPayload(payload, responseRecord);
      if (nextConfigVersion === null || nextConfigVersion <= expectedConfigVersion) {
        setOutcome({
          kind: "error",
          message: "Version QR de réponse invalide. Rechargez avant toute autre action."
        });
        return;
      }
      const record = applyCanonicalResponse(payload, { preserveKnownUrl: true });
      if (!record || record.status !== statusAfterAction(action)) {
        setOutcome({
          kind: "error",
          message: "État QR inattendu. Rechargez avant toute autre action."
        });
        return;
      }
      const messages: Record<StatusAction, string> = {
        pause: "QR mis en pause.",
        resume: "QR réactivé.",
        archive: "QR archivé.",
        revoke: "QR révoqué définitivement."
      };
      setOutcome({ kind: "success", message: messages[action] });
    } catch {
      setOutcome({ kind: "error", message: "Erreur réseau pendant l’action QR." });
    } finally {
      setOperation(null);
    }
  }

  async function rotateQr() {
    if (!canonicalRecord || mutationBusy) return;
    closeDialog();
    if (configVersion === null) {
      setOutcome({
        kind: "error",
        message: "Version de configuration absente. Rechargez avant la rotation."
      });
      return;
    }
    setOperation("rotating");
    setOutcome({ kind: "idle" });
    try {
      const response = await fetch(
        `/api/owner/qr-codes/${encodeURIComponent(canonicalRecord.id)}/rotate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmed: true,
            idempotencyKey: crypto.randomUUID(),
            previousDisposition,
            expectedConfigVersion: configVersion
          })
        }
      );
      const payload = (await response.json()) as QrApiPayload;
      if (!response.ok || !payload.ok) {
        handleMutationFailure(response, payload, "Rotation du QR impossible.");
        return;
      }
      const record = applyCanonicalResponse(payload);
      if (!record || record.status !== "active") {
        setOutcome({
          kind: "error",
          message: "Nouveau QR invalide. La rotation n’est pas confirmée."
        });
        return;
      }
      if (!payload.history && payload.previous && isLifecycleStatus(payload.previous.status)) {
        const previous = payload.previous;
        setHistory((current) => [
          ...current.filter((item) => item.id !== previous.id),
          ...normalizeSafeHistory([previous], {
            restaurantId,
            targetKind,
            canonicalId: record.id
          })
        ]);
      }
      setOutcome({
        kind: "success",
        message: "Nouveau QR actif. La disposition de l’ancien QR a été appliquée."
      });
    } catch {
      setOutcome({ kind: "error", message: "Erreur réseau pendant la rotation." });
    } finally {
      setOperation(null);
    }
  }

  function openDialog(action: DialogAction, trigger: HTMLButtonElement) {
    dialogTriggerRef.current = trigger;
    setDialogAction(action);
  }

  const closeDialog = useCallback(() => {
    setDialogAction(null);
    window.setTimeout(() => dialogTriggerRef.current?.focus(), 0);
  }, []);

  function confirmDialog() {
    if (dialogAction === "rotate") void rotateQr();
    if (dialogAction === "archive") {
      closeDialog();
      void mutateStatus("archive");
    }
    if (dialogAction === "revoke") {
      closeDialog();
      void mutateStatus("revoke");
    }
  }

  const createActionLabel =
    targetKind === "menu" ? "Créer le QR menu" : "Créer le QR admin";
  const rotationActionLabel =
    machineState === "unrecoverable"
      ? "Créer une nouvelle version sécurisée"
      : "Régénérer le lien sécurisé";
  const dialogTitle =
    dialogAction === "rotate"
      ? rotationActionLabel
      : dialogAction === "archive"
        ? "Archiver le QR"
        : "Révoquer définitivement";
  const dialogDescription =
    dialogAction === "rotate"
      ? "Un nouveau QR canonique sera créé. Choisissez explicitement le sort de l’ancien QR."
      : dialogAction === "archive"
        ? "L’archivage arrête ce QR et ne peut pas être annulé depuis cet écran."
        : "La révocation invalide définitivement ce QR. Cette action est irréversible.";

  return (
    <div className={`${styles.qrCustomizer} ${className}`}>
      <div className={styles.qrPreviewCol}>
        <div className={styles.qrPreviewFrame} aria-busy={machineState === "loading"}>
          {qrValue && svgMarkup ? (
            <span
              role="img"
              aria-label={`QR pour ${restaurantName}`}
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          ) : (
            <span className={styles.qrEmptyPreview}>
              {machineState === "loading"
                ? "Vérification en cours"
                : machineState === "unrecoverable"
                  ? "Aperçu indisponible"
                  : "Aucun QR à afficher"}
            </span>
          )}
        </div>
        <div className={styles.qrUrlBox}>
          <strong>URL QR :</strong>{" "}
          {qrValue
            ? qrValue
            : machineState === "unrecoverable"
              ? "Indisponible — jeton non récupérable"
              : machineState === "archived" || machineState === "revoked"
                ? "Masquée pour ce QR inactif"
                : "Aucune URL créée"}
        </div>
        <div className={styles.qrUrlBox}>
          <strong>Destination finale :</strong> {safeDestinationUrl}
        </div>
        <div className={styles.qrUrlBox}>
          <strong>Type :</strong> {targetLabel} - {targetBadgeLabel}
        </div>
        <div className={styles.qrStateSummary} data-state={machineState}>
          <span>{canonicalRecord ? STATUS_LABELS[canonicalRecord.status] : "Non créé"}</span>
          <p>{stateCopy}</p>
        </div>
        {targetKind === "admin" ? (
          <p className={styles.qrWarning}>
            Interne restaurant. Ne pas imprimer pour les clients. Ce QR ouvre le
            dashboard restaurant protégé. Son jeton d’accès est confidentiel :
            toute personne qui le photographie peut ouvrir une session tant que le QR
            reste actif.
          </p>
        ) : null}
        {lowContrast ? (
          <p className={styles.qrWarning}>
            Contraste faible ({contrast.toFixed(1)}:1). Sous {QR_MIN_SAFE_CONTRAST}:1 le
            scan devient peu fiable - assombrissez le premier plan ou eclaircissez le
            fond.
          </p>
        ) : null}
      </div>

      <div className={styles.qrControlsCol}>
        <div>
          <p className={styles.fieldLabel}>Presets</p>
          <div className={styles.presetRow}>
            {OWNER_QR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={styles.presetButton}
                onClick={() => applyPreset(preset.id)}
                disabled={styleControlsDisabled}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.colorGrid}>
          <ColorField
            label="Premier plan"
            value={style.foregroundColor}
            onChange={(value) => update({ foregroundColor: value })}
            disabled={styleControlsDisabled}
          />
          <ColorField
            label="Fond"
            value={style.backgroundColor}
            onChange={(value) => update({ backgroundColor: value })}
            disabled={styleControlsDisabled}
          />
          <ColorField
            label="Accent"
            value={style.accentColor}
            onChange={(value) => update({ accentColor: value })}
            disabled={styleControlsDisabled}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Logo au centre</span>
          <select
            className={styles.select}
            value={style.logoMode}
            disabled={styleControlsDisabled}
            onChange={(event) =>
              update({ logoMode: event.target.value as OwnerQrStyle["logoMode"] })
            }
          >
            <option value="none">Aucun logo</option>
            <option value="monogram">Monogramme du restaurant</option>
            <option value="imageUrl">Logo image</option>
          </select>
        </label>

        {style.logoMode === "monogram" ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Texte monogramme</span>
            <input
              className={styles.input}
              maxLength={4}
              value={style.logoText}
              disabled={styleControlsDisabled}
              onChange={(event) => update({ logoText: event.target.value })}
            />
          </label>
        ) : null}

        {style.logoMode === "imageUrl" ? (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>URL du logo</span>
              <input
                className={styles.input}
                value={style.logoImageUrl ?? ""}
                disabled={styleControlsDisabled}
                placeholder="https://.../logo.png"
                onChange={(event) => update({ logoImageUrl: event.target.value })}
              />
            </label>
            <p className={styles.qrWarning}>
              Avec un logo image distant, le SVG reste recommande : certains
              navigateurs peuvent bloquer l&apos;export PNG.
            </p>
          </>
        ) : null}

        {style.logoMode !== "none" ? (
          <RangeField
            label={`Taille logo (${style.logoSizePercent}%)`}
            min={OWNER_QR_LOGO_MIN_PERCENT}
            max={OWNER_QR_LOGO_MAX_PERCENT}
            value={style.logoSizePercent}
            onChange={(value) => update({ logoSizePercent: value })}
            disabled={styleControlsDisabled}
          />
        ) : null}

        <RangeField
          label={`Marge (${style.padding})`}
          min={OWNER_QR_PADDING_MIN}
          max={OWNER_QR_PADDING_MAX}
          value={style.padding}
          onChange={(value) => update({ padding: value })}
          disabled={styleControlsDisabled}
        />

        <div className={styles.qrExportRow}>
          <button
            type="button"
            className={styles.btn}
            onClick={copyUrl}
            disabled={!canExportQr || mutationBusy}
            aria-describedby={!canExportQr ? statusReasonId : undefined}
          >
            {copyState === "copied" ? "URL copiee" : "Copier URL QR"}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={downloadSvg}
            disabled={!canExportQr || mutationBusy}
            aria-describedby={!canExportQr ? statusReasonId : undefined}
          >
            Télécharger SVG
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={downloadPng}
            disabled={!canExportQr || mutationBusy}
            aria-describedby={!canExportQr ? statusReasonId : undefined}
          >
            Télécharger PNG
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={reset}
            disabled={styleControlsDisabled}
          >
            Réinitialiser le style
          </button>
          {!canonicalRecord ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={saveStyle}
              disabled={machineState !== "absent"}
              aria-describedby={machineState !== "absent" ? statusReasonId : undefined}
            >
              {machineState === "creating" ? "Création…" : createActionLabel}
            </button>
          ) : (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={saveStyle}
              disabled={
                mutationBusy ||
                !styleDirty ||
                configVersion === null ||
                terminalState ||
                machineState === "unrecoverable" ||
                requiresReload
              }
              aria-describedby={statusReasonId}
            >
              {operation === "updating" ? "Enregistrement…" : "Enregistrer le style"}
            </button>
          )}
        </div>

        {canonicalRecord ? (
          <div className={styles.qrLifecycleActions} aria-label="Cycle de vie du QR">
            {!terminalState ? (
              <button
                type="button"
                className={styles.btn}
                disabled={mutationBusy || requiresReload}
                onClick={(event) => openDialog("rotate", event.currentTarget)}
                aria-describedby={statusReasonId}
              >
                {rotationActionLabel}
              </button>
            ) : null}
            {canonicalRecord.status === "active" ? (
              <button
                type="button"
                className={styles.btn}
                disabled={mutationBusy || requiresReload}
                onClick={() => void mutateStatus("pause")}
                aria-describedby={statusReasonId}
              >
                Suspendre temporairement
              </button>
            ) : null}
            {canonicalRecord.status === "paused" ? (
              <button
                type="button"
                className={styles.btn}
                disabled={mutationBusy || requiresReload}
                onClick={() => void mutateStatus("resume")}
                aria-describedby={statusReasonId}
              >
                Réactiver
              </button>
            ) : null}
            {canonicalRecord.status === "active" || canonicalRecord.status === "paused" ? (
              <>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={mutationBusy || requiresReload}
                  onClick={(event) => openDialog("archive", event.currentTarget)}
                  aria-describedby={statusReasonId}
                >
                  Archiver
                </button>
                <button
                  type="button"
                  className={styles.qrDangerButton}
                  disabled={mutationBusy || requiresReload}
                  onClick={(event) => openDialog("revoke", event.currentTarget)}
                  aria-describedby={statusReasonId}
                >
                  Révoquer définitivement
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {requiresReload ? (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void loadCanonicalQr()}
            disabled={mutationBusy}
          >
            Recharger
          </button>
        ) : null}

        <p
          id={statusReasonId}
          className={styles.qrStatusLine}
          aria-live="polite"
          role="status"
        >
          {outcome.kind === "idle" ? stateCopy : outcome.message}
          {outcome.kind === "idle" && machineState === "absent"
            ? ` Le QR encodera ${targetUsage}`
            : ""}
        </p>

        <section className={styles.qrHistory} aria-labelledby={`qr-history-${targetKind}`}>
            <div className={styles.qrHistoryHeader}>
              <h3 id={`qr-history-${targetKind}`}>Historique sûr</h3>
              <span>{history.length} QR précédent{history.length > 1 ? "s" : ""}</span>
            </div>
            {historyLoadState === "loading" ? (
              <p className={styles.qrHistoryNotice}>Chargement de l’historique…</p>
            ) : historyLoadState === "error" ? (
              <p className={styles.qrHistoryNotice}>
                Historique indisponible. Aucune donnée sensible n’est affichée.
              </p>
            ) : history.length ? (
              <ul>
                {history.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.label || "QR sans libellé"}</strong>
                      <span>{STATUS_LABELS[item.status]}</span>
                    </div>
                    <p>
                      {item.scanCount} scan{item.scanCount > 1 ? "s" : ""} · aucune
                      donnée de jeton exposée
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.qrHistoryNotice}>Aucun QR précédent pour ce type.</p>
            )}
          </section>
      </div>

      {dialogAction ? (
        <QrConfirmationDialog
          title={dialogTitle}
          description={dialogDescription}
          confirmLabel={
            dialogAction === "rotate"
              ? "Confirmer la rotation"
              : dialogAction === "archive"
                ? "Confirmer l’archivage"
                : "Confirmer la révocation"
          }
          danger={dialogAction !== "rotate"}
          onCancel={closeDialog}
          onConfirm={confirmDialog}
        >
          {dialogAction === "rotate" ? (
            <fieldset className={styles.qrDispositionFieldset}>
              <legend>Disposition de l’ancien QR</legend>
              <label>
                <input
                  type="radio"
                  name="previousDisposition"
                  value="keep-active"
                  checked={previousDisposition === "keep-active"}
                  onChange={() => setPreviousDisposition("keep-active")}
                />
                Conserver l’ancien QR actif
              </label>
              <label>
                <input
                  type="radio"
                  name="previousDisposition"
                  value="pause"
                  checked={previousDisposition === "pause"}
                  onChange={() => setPreviousDisposition("pause")}
                />
                Mettre l’ancien QR en pause
              </label>
              <label>
                <input
                  type="radio"
                  name="previousDisposition"
                  value="revoke"
                  checked={previousDisposition === "revoke"}
                  onChange={() => setPreviousDisposition("revoke")}
                />
                Révoquer définitivement l’ancien QR
              </label>
              {targetKind === "admin" ? (
                <p className={styles.qrWarning}>
                  Sécurité admin : conserver l’ancien QR actif maintient l’accès pour
                  toute personne qui en possède une photo ou une impression.
                </p>
              ) : null}
            </fieldset>
          ) : null}
        </QrConfirmationDialog>
      ) : null}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.colorField}>
      <input
        type="color"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className={styles.cellSub}>{label}</span>
    </div>
  );
}

function RangeField({
  label,
  min,
  max,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.rangeField}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function QrConfirmationDialog({
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
  children
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
    focusable()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.qrDialogBackdrop} role="presentation">
      <div
        ref={dialogRef}
        className={styles.qrDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className={styles.qrDialogHeader}>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
        {children}
        <div className={styles.qrDialogActions}>
          <button type="button" className={styles.btn} onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className={danger ? styles.qrDangerButton : styles.btnPrimary}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function triggerDownload(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  if (href.startsWith("blob:")) URL.revokeObjectURL(href);
}
