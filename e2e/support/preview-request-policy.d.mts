export type RequestClassification =
  | "blocking"
  | "platform-cancellation"
  | "healthy-media-cancellation"
  | "explicit-prefetch-cancellation"
  | "http-error";

export type MediaState = {
  healthy: boolean;
  allowCancellation: boolean;
  reason?: string;
};

export type FailedRequestInput = {
  url: string;
  expectedOrigin: string;
  pathname?: string;
  method?: string;
  resourceType?: string;
  isNavigationRequest?: boolean;
  isMainFrame?: boolean;
  frame?: "main" | "secondary" | "unknown";
  failureCode?: string | null;
  responseStatus?: number | null;
  prefetchHeaders?: Record<string, string | undefined>;
  mediaState?: MediaState;
};

export type RequestDiagnostic = {
  url: string;
  pathname: string;
  method: string;
  resourceType: string;
  isNavigationRequest: boolean;
  frame: "main" | "secondary" | "unknown";
  isMainFrame: boolean;
  failureCode: string | null;
  prefetchHeaders: Record<string, string>;
  classification: RequestClassification;
  ignored: boolean;
  reason: string;
};

export const ERR_ABORTED: "net::ERR_ABORTED";
export const VERCEL_JWE_PATH: "/.well-known/vercel/jwe";
export const REQUEST_CLASSIFICATIONS: Readonly<{
  BLOCKING: "blocking";
  PLATFORM_CANCELLATION: "platform-cancellation";
  HEALTHY_MEDIA_CANCELLATION: "healthy-media-cancellation";
  EXPLICIT_PREFETCH_CANCELLATION: "explicit-prefetch-cancellation";
  HTTP_ERROR: "http-error";
}>;
export function pickPrefetchHeaders(headers?: Record<string, string | undefined>): Record<string, string>;
export function hasExplicitPrefetchMarker(headers?: Record<string, string | undefined>): boolean;
export function isMediaCurrentSrcCoherent(currentSrc: string, sources: string[], baseUrl: string): boolean;
export function classifyFailedRequest(input: FailedRequestInput): RequestDiagnostic;
export function classifyFailedResponse(input: FailedRequestInput & { status: number }): RequestDiagnostic;
export function classifyRuntimeSignal(input: { kind: "console" | "pageerror"; message: string }): {
  kind: "console error" | "pageerror";
  message: string;
  classification: "blocking";
  ignored: false;
  reason: string;
};
export function sanitizeDiagnosticText(value: unknown): string;
export function sanitizeDiagnosticUrl(value: unknown): string;
