import "server-only";

import type { NextRequest } from "next/server";

export type ModelLabMultipartFile = {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
};

export type ModelLabMultipartForm = {
  file: ModelLabMultipartFile | null;
  fields: Map<string, string>;
};

type MultipartResult =
  | { ok: true; form: ModelLabMultipartForm }
  | { ok: false; status: 400 | 413; error: string };

function parseBoundary(contentType: string | null): string {
  const match = contentType?.match(/;\s*boundary=(?:"([^"]+)"|([^;]+))/i);
  return (match?.[1] ?? match?.[2] ?? "").trim().replace(/^"|"$/g, "");
}

function parsePartHeaders(rawHeaders: string): Map<string, string> {
  const headers = new Map<string, string>();
  for (const line of rawHeaders.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim()
    );
  }
  return headers;
}

function dispositionValue(header: string, key: string): string {
  const match = header.match(new RegExp(`${key}\\*?=(?:"([^"]*)"|([^;]*))`, "i"));
  const value = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!value.includes("''")) return value;

  try {
    return decodeURIComponent(value.split("''", 2)[1] ?? value);
  } catch {
    return value;
  }
}

function findHeaderEnd(
  body: Buffer,
  from: number
): { index: number; length: 2 | 4 } | null {
  const crlf = body.indexOf("\r\n\r\n", from, "utf8");
  const lf = body.indexOf("\n\n", from, "utf8");

  if (crlf < 0 && lf < 0) return null;
  if (crlf >= 0 && (lf < 0 || crlf < lf)) return { index: crlf, length: 4 };
  return { index: lf, length: 2 };
}

function findBoundaryMarker(body: Buffer, marker: Buffer, from: number): number {
  let index = body.indexOf(marker, from);

  while (index >= 0) {
    const hasCrlfPrefix =
      index >= 2 && body[index - 2] === 0x0d && body[index - 1] === 0x0a;
    const hasLfPrefix = index >= 1 && body[index - 1] === 0x0a;
    if (index === 0 || hasCrlfPrefix || hasLfPrefix) return index;
    index = body.indexOf(marker, index + 1);
  }

  return -1;
}

function partDataEnd(body: Buffer, markerIndex: number): number {
  if (markerIndex >= 2 && body[markerIndex - 2] === 0x0d && body[markerIndex - 1] === 0x0a) {
    return markerIndex - 2;
  }
  if (markerIndex >= 1 && body[markerIndex - 1] === 0x0a) {
    return markerIndex - 1;
  }
  return markerIndex;
}

export async function readModelLabMultipartRequest(
  request: NextRequest,
  maxBodyBytes: number
): Promise<MultipartResult> {
  const boundary = parseBoundary(request.headers.get("content-type"));
  if (!boundary) {
    return {
      ok: false,
      status: 400,
      error: "Model Lab multipart form is required."
    };
  }

  const declaredContentLength = Number(request.headers.get("content-length") ?? 0);
  const body = Buffer.from(await request.arrayBuffer());
  if (
    Number.isFinite(declaredContentLength) &&
    declaredContentLength > 0 &&
    body.byteLength < declaredContentLength
  ) {
    return {
      ok: false,
      status: 413,
      error: "Model Lab request body was truncated before it reached the API."
    };
  }
  if (body.byteLength > maxBodyBytes) {
    return {
      ok: false,
      status: 413,
      error: "GLB is larger than the configured Model Lab request cap."
    };
  }

  const delimiter = Buffer.from(`--${boundary}`, "utf8");
  const form: ModelLabMultipartForm = {
    file: null,
    fields: new Map<string, string>()
  };

  let markerIndex = findBoundaryMarker(body, delimiter, 0);
  if (markerIndex < 0) {
    return {
      ok: false,
      status: 400,
      error: "Model Lab multipart boundary is missing."
    };
  }

  while (markerIndex >= 0 && markerIndex < body.byteLength) {
    let cursor = markerIndex + delimiter.byteLength;
    if (body.subarray(cursor, cursor + 2).toString("utf8") === "--") break;
    if (body.subarray(cursor, cursor + 2).toString("utf8") === "\r\n") cursor += 2;
    else if (body[cursor] === 0x0a) cursor += 1;

    const headerEnd = findHeaderEnd(body, cursor);
    if (!headerEnd) {
      return {
        ok: false,
        status: 400,
        error: "Model Lab multipart part headers are invalid."
      };
    }

    const headers = parsePartHeaders(
      body.subarray(cursor, headerEnd.index).toString("latin1")
    );
    const dataStart = headerEnd.index + headerEnd.length;
    const nextMarkerIndex = findBoundaryMarker(body, delimiter, dataStart);
    if (nextMarkerIndex < 0) {
      return {
        ok: false,
        status: 400,
        error: "Model Lab multipart part is incomplete."
      };
    }
    const dataEnd = partDataEnd(body, nextMarkerIndex);

    const disposition = headers.get("content-disposition") ?? "";
    const name = dispositionValue(disposition, "name");
    const filename = dispositionValue(disposition, "filename");
    const partBytes = Buffer.from(body.subarray(dataStart, dataEnd));

    if (name === "file" && filename) {
      if (form.file) {
        return {
          ok: false,
          status: 400,
          error: "Only one GLB file can be inspected at a time."
        };
      }
      form.file = {
        name: filename,
        type: headers.get("content-type") ?? "",
        size: partBytes.byteLength,
        bytes: partBytes
      };
    } else if (name) {
      form.fields.set(name, partBytes.toString("utf8").trim());
    }

    markerIndex = nextMarkerIndex;
  }

  return { ok: true, form };
}
