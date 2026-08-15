type StorageRemovalBucket = {
  remove: (paths: string[]) => PromiseLike<{ data: unknown; error: unknown }>;
};

export type CreatedMediaObject = {
  path: string;
  bytes: number;
};

export type MediaRollbackResult = {
  removedPaths: string[];
  retainedPaths: string[];
  retainedBytes: number;
  errors: string[];
};

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  const message = String(error ?? "").trim();
  return message || "Storage remove failed";
}

export async function rollbackCreatedMediaObjects(args: {
  bucket: StorageRemovalBucket;
  created: CreatedMediaObject[];
  referencedPaths: ReadonlySet<string> | null;
}): Promise<MediaRollbackResult> {
  const objects = new Map<string, number>();
  for (const candidate of args.created) {
    const storagePath = candidate.path.trim();
    if (
      !storagePath ||
      !Number.isSafeInteger(candidate.bytes) ||
      candidate.bytes < 0
    ) {
      throw new TypeError("created media object must have a path and non-negative byte size");
    }
    objects.set(storagePath, Math.max(objects.get(storagePath) ?? 0, candidate.bytes));
  }
  if (objects.size === 0) {
    return { removedPaths: [], retainedPaths: [], retainedBytes: 0, errors: [] };
  }

  const allPaths = [...objects.keys()];
  if (!args.referencedPaths) {
    return {
      removedPaths: [],
      retainedPaths: allPaths,
      retainedBytes: [...objects.values()].reduce((total, bytes) => total + bytes, 0),
      errors: ["reference lookup unavailable"]
    };
  }

  const retainedPaths = allPaths.filter((storagePath) => args.referencedPaths?.has(storagePath));
  const rollbackPaths = allPaths.filter((storagePath) => !args.referencedPaths?.has(storagePath));
  if (rollbackPaths.length > 0) {
    try {
      const removed = await args.bucket.remove(rollbackPaths);
      if (removed.error) {
        return {
          removedPaths: [],
          retainedPaths: allPaths,
          retainedBytes: [...objects.values()].reduce((total, bytes) => total + bytes, 0),
          errors: [errorMessage(removed.error)]
        };
      }
    } catch (error) {
      return {
        removedPaths: [],
        retainedPaths: allPaths,
        retainedBytes: [...objects.values()].reduce((total, bytes) => total + bytes, 0),
        errors: [errorMessage(error)]
      };
    }
  }

  return {
    removedPaths: rollbackPaths,
    retainedPaths,
    retainedBytes: retainedPaths.reduce(
      (total, storagePath) => total + (objects.get(storagePath) ?? 0),
      0
    ),
    errors: []
  };
}
