const SCHEMA_ORIGIN = "https://schema.org";

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|amp|quot|apos|lt|gt);/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      const named: Record<string, string> = {
        "&amp;": "&",
        "&quot;": '"',
        "&apos;": "'",
        "&lt;": "<",
        "&gt;": ">"
      };
      return named[entity.toLowerCase()] ?? entity;
    }
  );
}

export function readAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const attributePattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(attributePattern)) {
    const name = match[1].toLowerCase();
    if (name === "html" || name === "link" || name === "script") continue;
    attributes.set(
      name,
      decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "")
    );
  }
  return attributes;
}

function isHtmlTagBoundary(value: string | undefined) {
  return (
    value === ">" ||
    value === "/" ||
    value === "\t" ||
    value === "\n" ||
    value === "\f" ||
    value === "\r" ||
    value === " "
  );
}

function findHtmlTagEnd(html: string, start: number) {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index;
  }
  return -1;
}

function matchesAsciiToken(html: string, start: number, token: string) {
  for (let offset = 0; offset < token.length; offset += 1) {
    const code = html.charCodeAt(start + offset);
    const normalizedCode = code >= 65 && code <= 90 ? code + 32 : code;
    if (normalizedCode !== token.charCodeAt(offset)) return false;
  }
  return true;
}

function findScriptClosingTag(html: string, start: number) {
  const token = "</script";
  let tokenStart = html.indexOf("<", start);
  while (tokenStart >= 0) {
    const boundaryIndex = tokenStart + token.length;
    if (
      matchesAsciiToken(html, tokenStart, token) &&
      isHtmlTagBoundary(html[boundaryIndex])
    ) {
      const tagEnd = findHtmlTagEnd(html, boundaryIndex);
      if (tagEnd >= 0) return { tagEnd, tokenStart };
      return null;
    }
    tokenStart = html.indexOf("<", tokenStart + 1);
  }
  return null;
}

function isAsciiLetter(value: string | undefined) {
  if (!value) return false;
  const code = value.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function findScriptOpeningTag(html: string, start: number) {
  const token = "<script";
  let tokenStart = html.indexOf("<", start);
  while (tokenStart >= 0) {
    if (html.startsWith("<!--", tokenStart)) {
      const commentEnd = html.indexOf("-->", tokenStart + 4);
      if (commentEnd < 0) return null;
      tokenStart = html.indexOf("<", commentEnd + 3);
      continue;
    }

    const boundaryIndex = tokenStart + token.length;
    if (
      matchesAsciiToken(html, tokenStart, token) &&
      isHtmlTagBoundary(html[boundaryIndex])
    ) {
      const tagEnd = findHtmlTagEnd(html, boundaryIndex);
      if (tagEnd >= 0) return { tagEnd, tokenStart };
      return null;
    }

    const tagMarker = html[tokenStart + 1];
    if (
      tagMarker === "/" ||
      tagMarker === "!" ||
      tagMarker === "?" ||
      isAsciiLetter(tagMarker)
    ) {
      const tagEnd = findHtmlTagEnd(html, tokenStart + 2);
      if (tagEnd < 0) return null;
      tokenStart = html.indexOf("<", tagEnd + 1);
      continue;
    }
    tokenStart = html.indexOf("<", tokenStart + 1);
  }
  return null;
}

export function jsonLdPayloads(html: string) {
  const payloads: unknown[] = [];
  let cursor = 0;
  while (cursor < html.length) {
    const opening = findScriptOpeningTag(html, cursor);
    if (!opening) break;
    const closing = findScriptClosingTag(html, opening.tagEnd + 1);
    if (!closing) break;

    const attributes = readAttributes(
      html.slice(opening.tokenStart, opening.tagEnd + 1)
    );
    cursor = closing.tagEnd + 1;
    if (attributes.get("type")?.toLowerCase() !== "application/ld+json") continue;
    payloads.push(
      JSON.parse(html.slice(opening.tagEnd + 1, closing.tokenStart).trim())
    );
  }
  return payloads;
}

export function hasPageSpecificSchema(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const records = Array.isArray(payload) ? payload : [payload];
  const globalTypes = new Set(["Organization", "ProfessionalService", "WebSite"]);
  return records.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const record = entry as Record<string, unknown>;
    const context = record["@context"];
    const rawType = record["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];

    let hasSchemaOrigin = false;
    if (typeof context === "string") {
      try {
        hasSchemaOrigin = new URL(context).origin === SCHEMA_ORIGIN;
      } catch {
        hasSchemaOrigin = false;
      }
    }

    return (
      hasSchemaOrigin &&
      types.some((type) => typeof type === "string" && !globalTypes.has(type))
    );
  });
}
