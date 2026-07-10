export type PremiumDishTagKind = "option" | "ingredient" | "allergen";

export type PremiumTagAccent = {
  border: string;
  text: string;
};

const GOLDEN_ANGLE = 137.508;

function accent(border: string, text: string): PremiumTagAccent {
  return { border, text };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = h / 360;
  const sat = s / 100;
  const light = l / 100;

  const hueToChannel = (p: number, q: number, t: number) => {
    let channel = t;
    if (channel < 0) channel += 1;
    if (channel > 1) channel -= 1;
    if (channel < 1 / 6) return p + (q - p) * 6 * channel;
    if (channel < 1 / 2) return q;
    if (channel < 2 / 3) return p + (q - p) * (2 / 3 - channel) * 6;
    return p;
  };

  if (sat === 0) {
    const gray = Math.round(light * 255);
    return [gray, gray, gray];
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;

  return [
    Math.round(hueToChannel(p, q, hue + 1 / 3) * 255),
    Math.round(hueToChannel(p, q, hue) * 255),
    Math.round(hueToChannel(p, q, hue - 1 / 3) * 255)
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function hslAccent(h: number, s = 84, borderL = 56, textL = 68): PremiumTagAccent {
  const [br, bg, bb] = hslToRgb(h, s, borderL);
  const [tr, tg, tb] = hslToRgb(h, s - 6, textL);
  return accent(rgbToHex(br, bg, bb), rgbToHex(tr, tg, tb));
}

function buildGoldenPalette(count: number): PremiumTagAccent[] {
  return Array.from({ length: count }, (_, index) => {
    const hue = (index * GOLDEN_ANGLE) % 360;
    const sat = index % 3 === 0 ? 86 : index % 3 === 1 ? 78 : 82;
    const borderL = index % 2 === 0 ? 54 : 60;
    return hslAccent(hue, sat, borderL, borderL + 12);
  });
}

const GROUP_PALETTE = buildGoldenPalette(24);
const SECTION_ACCENTS: Record<PremiumDishTagKind, PremiumTagAccent> = {
  ingredient: accent("#9eae70", "#dce7b4"),
  allergen: accent("#bd4a4f", "#ffc2bd"),
  option: accent("#c79a2f", "#ffe08a")
};

export function assignPremiumTagAccents(
  labels: string[],
  kind: PremiumDishTagKind
): PremiumTagAccent[] {
  const visibleLabels = labels.map((label) => label.trim()).filter(Boolean);
  return visibleLabels.map(() => SECTION_ACCENTS[kind]);
}

export function assignPremiumTagAccentsGlobally(
  groupLabels: string[][],
  kinds: PremiumDishTagKind[] = ["ingredient", "allergen", "option"]
): PremiumTagAccent[][] {
  return groupLabels.map((labels, index) =>
    assignPremiumTagAccents(labels, kinds[index] ?? "option")
  );
}

export function getPremiumTagAccent(
  label: string,
  kind: PremiumDishTagKind,
  index = 0
): PremiumTagAccent {
  const normalized = label.trim();
  void index;
  return normalized ? SECTION_ACCENTS[kind] : GROUP_PALETTE[0];
}

export function countUniqueAccents(accents: PremiumTagAccent[]): number {
  return new Set(accents.map((entry) => entry.border)).size;
}

export function hexToHue(hex: string): number {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return Math.round(((hue * 60 + 360) % 360) * 10) / 10;
}

export function minHueSeparation(accents: PremiumTagAccent[]): number {
  const hues = accents.map((entry) => hexToHue(entry.border));
  if (hues.length < 2) return 360;

  let minDistance = 360;
  for (let i = 0; i < hues.length; i += 1) {
    for (let j = i + 1; j < hues.length; j += 1) {
      const delta = Math.abs(hues[i] - hues[j]);
      const distance = Math.min(delta, 360 - delta);
      if (distance < minDistance) minDistance = distance;
    }
  }

  return minDistance;
}
