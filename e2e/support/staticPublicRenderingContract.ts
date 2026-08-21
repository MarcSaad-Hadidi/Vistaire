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

export function jsonLdPayloads(html: string) {
  const payloads: unknown[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const attributes = readAttributes(`<script ${match[1]}>`);
    if (attributes.get("type")?.toLowerCase() !== "application/ld+json") continue;
    payloads.push(JSON.parse(match[2].trim()));
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
