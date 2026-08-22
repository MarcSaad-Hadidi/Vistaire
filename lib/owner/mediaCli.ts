function strictIntegerOption(args: string[], options: {
  name: string;
  defaultValue: number;
  minimum: number;
  maximum: number;
}): number {
  const prefix = `${options.name}=`;
  if (args.includes(options.name)) {
    throw new Error(`${options.name} requires an integer value with ${prefix}<value>.`);
  }
  const matches = args.filter((value) => value.startsWith(prefix));
  if (matches.length > 1) throw new Error(`${options.name} may be provided only once.`);
  if (matches.length === 0) return options.defaultValue;
  const raw = matches[0].slice(prefix.length);
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw)) {
    throw new Error(`${options.name} must be a finite integer.`);
  }
  const value = Number(raw);
  if (
    !Number.isSafeInteger(value) ||
    value < options.minimum ||
    value > options.maximum
  ) {
    throw new Error(
      `${options.name} must be between ${options.minimum} and ${options.maximum}.`
    );
  }
  return value;
}

export function parseBackfillNumericOptions(args: string[]) {
  return {
    rowLimit: strictIntegerOption(args, {
      name: "--limit",
      defaultValue: Number.POSITIVE_INFINITY,
      minimum: 1,
      maximum: 100_000
    }),
    concurrency: strictIntegerOption(args, {
      name: "--concurrency",
      defaultValue: 2,
      minimum: 1,
      maximum: 4
    }),
    verifyMaxObjects: strictIntegerOption(args, {
      name: "--verify-max-objects",
      defaultValue: 10_000,
      minimum: 1,
      maximum: 100_000
    }),
    verifyMaxBytes: strictIntegerOption(args, {
      name: "--verify-max-bytes",
      defaultValue: 256 * 1024 * 1024,
      minimum: 1,
      maximum: 1024 * 1024 * 1024
    }),
    verifyTimeoutMs: strictIntegerOption(args, {
      name: "--verify-timeout-ms",
      defaultValue: 10_000,
      minimum: 1_000,
      maximum: 60_000
    })
  };
}

export function parseUsageAuditNumericOptions(args: string[]) {
  return {
    storagePageSize: strictIntegerOption(args, {
      name: "--storage-limit",
      defaultValue: 1_000,
      minimum: 50,
      maximum: 1_000
    }),
    concurrency: strictIntegerOption(args, {
      name: "--concurrency",
      defaultValue: 2,
      minimum: 1,
      maximum: 4
    }),
    verifyMaxObjects: strictIntegerOption(args, {
      name: "--verify-max-objects",
      defaultValue: 10_000,
      minimum: 1,
      maximum: 100_000
    }),
    verifyMaxBytes: strictIntegerOption(args, {
      name: "--verify-max-bytes",
      defaultValue: 256 * 1024 * 1024,
      minimum: 1,
      maximum: 1024 * 1024 * 1024
    }),
    verifyTimeoutMs: strictIntegerOption(args, {
      name: "--verify-timeout-ms",
      defaultValue: 10_000,
      minimum: 1_000,
      maximum: 60_000
    })
  };
}
