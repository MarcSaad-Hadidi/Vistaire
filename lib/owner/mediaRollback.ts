export type PotentiallyCreatedMediaObject = {
  path: string;
  bytes: number;
  creation: "confirmed" | "ambiguous";
};

export type MediaRollbackResult = {
  removedPaths: string[];
  retainedPaths: string[];
  retainedBytes: number;
  errors: string[];
};

export function potentiallyCreatedMediaObjectBytes(
  objects: PotentiallyCreatedMediaObject[]
): number {
  const byPath = new Map<string, number>();
  for (const candidate of objects) {
    const storagePath = candidate.path.trim();
    if (
      !storagePath ||
      !Number.isSafeInteger(candidate.bytes) ||
      candidate.bytes < 0 ||
      !["confirmed", "ambiguous"].includes(candidate.creation)
    ) {
      throw new TypeError("potentially created media object is invalid");
    }
    byPath.set(storagePath, Math.max(byPath.get(storagePath) ?? 0, candidate.bytes));
  }
  return [...byPath.values()].reduce((total, bytes) => total + bytes, 0);
}

export async function rollbackPotentiallyCreatedMediaObjects(args: {
  potentiallyCreated: PotentiallyCreatedMediaObject[];
}): Promise<MediaRollbackResult> {
  const byPath = new Map<string, PotentiallyCreatedMediaObject>();
  for (const candidate of args.potentiallyCreated) {
    potentiallyCreatedMediaObjectBytes([candidate]);
    const storagePath = candidate.path.trim();
    const prior = byPath.get(storagePath);
    byPath.set(storagePath, {
      path: storagePath,
      bytes: Math.max(prior?.bytes ?? 0, candidate.bytes),
      creation:
        prior?.creation === "ambiguous" || candidate.creation === "ambiguous"
          ? "ambiguous"
          : "confirmed"
    });
  }

  // These paths are immutable and intentionally shared across dishes. A
  // point-in-time reference query cannot see another instance that already
  // reused an object but has not committed its metadata yet. Deleting here
  // would create a dangling reference in that concurrent transaction, so all
  // attempted content-addressed objects remain retained and capacity-billed
  // until an offline, quiescent reconciliation proves them orphaned.
  const retained = [...byPath.values()];
  return {
    removedPaths: [],
    retainedPaths: retained.map((candidate) => candidate.path),
    retainedBytes: retained.reduce((total, candidate) => total + candidate.bytes, 0),
    errors: retained.length
      ? ["content-addressed Storage objects retained for cross-instance safety"]
      : []
  };
}
