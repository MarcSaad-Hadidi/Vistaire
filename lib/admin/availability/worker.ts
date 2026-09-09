import "server-only";
import { timingSafeEqual } from "node:crypto";
export function validWorkerAuthorization(header: string | null, secret: string | undefined) { if (!header?.startsWith("Bearer ") || !secret) return false; const supplied = Buffer.from(header.slice(7)); const expected = Buffer.from(secret); return supplied.length === expected.length && timingSafeEqual(supplied, expected); }
export function boundedWorkerBatch(value: unknown) { return typeof value === "number" && Number.isInteger(value) ? Math.max(1, Math.min(value, 100)) : 25; }
