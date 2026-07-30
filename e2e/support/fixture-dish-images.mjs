import { createHash } from "node:crypto";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hueFor(value) {
  return [...String(value)].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) % 360,
    0
  );
}

export function buildFixtureDishSvg({
  dishName,
  restaurantName,
  sourceKey
}) {
  const hue = hueFor(sourceKey);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
      <defs>
        <radialGradient id="g" cx="35%" cy="30%" r="85%">
          <stop offset="0" stop-color="hsl(${hue} 34% 38%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 28) % 360} 28% 12%)"/>
        </radialGradient>
      </defs>
      <rect width="960" height="720" fill="url(#g)"/>
      <circle cx="480" cy="325" r="210" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
      <text x="480" y="310" text-anchor="middle" fill="#fff8e9" font-family="Georgia,serif" font-size="42">${escapeXml(restaurantName)}</text>
      <text x="480" y="370" text-anchor="middle" fill="#fff8e9" font-family="Arial,sans-serif" font-size="26">${escapeXml(dishName)}</text>
      <text x="480" y="625" text-anchor="middle" fill="rgba(255,248,233,.72)" font-family="Arial,sans-serif" font-size="18">VISUEL DE FIXTURE LOCAL</text>
    </svg>`,
    "utf8"
  );
}

export function fixtureDishSha256(options) {
  return createHash("sha256")
    .update(buildFixtureDishSvg(options))
    .digest("hex");
}
