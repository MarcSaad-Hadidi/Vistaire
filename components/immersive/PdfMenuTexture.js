import * as THREE from "three";

// What a guest sees when a QR code opens Maison Élyse's PDF: a printed page in
// a PDF viewer, small serif text and dotted leaders. Drawn once, on the PDF vs
// digital page only, for the phone beside the one playing the real menu.
// shortcut: dishes and prices copied from lib/demoMenuData.ts, update both if
// the Maison Élyse demo menu changes.
const MENU = [
  ["Entrées", [
    ["Ravioles de chèvre frais & miel de Montérégie", 34],
    ["Tartare de saumon Label Rouge", 42],
  ]],
  ["Plats signatures", [
    ["Homard bleu, bisque corsée & fenouil", 104],
    ["Canette rôtie aux figues & épices douces", 96],
    ["Risotto aux cèpes & parmesan Reggiano", 54],
    ["Bar de ligne, artichaut poivrade, citron beldi", 62],
    ["Pavé de bœuf maturé, purée Ratte & Bordelaise", 72],
  ]],
  ["Desserts", [
    ["Soufflé tiède au chocolat grand cru", 28],
    ["Tarte citron confit & basilic pourpre", 24],
  ]],
  ["Cocktails", [
    ["Maison Élyse N°1", 28],
    ["Negroni vieilli en fût", 26],
    ["Élixir bergamote & thé Earl Grey", 18],
  ]],
];

export function createPdfMenuTexture() {
  const width = 640, height = 1386;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  // PDF viewer chrome around the page.
  g.fillStyle = "#3a3a3c";
  g.fillRect(0, 0, width, height);
  g.fillStyle = "#232325";
  g.fillRect(0, 0, width, 150);
  g.fillStyle = "#e8e8ea";
  g.font = "500 25px Helvetica, Arial, sans-serif";
  g.fillText("menu-maison-elyse.pdf", 34, 112);
  g.fillStyle = "#9a9aa0";
  g.textAlign = "right";
  g.fillText("1 / 3", width - 34, 112);
  const page = { x: 30, y: 180, w: width - 60, h: height - 230 };
  g.fillStyle = "#f6f2ea";
  g.fillRect(page.x, page.y, page.w, page.h);
  const ink = "#1d1b18";
  g.fillStyle = ink;
  g.textAlign = "center";
  g.font = "400 36px Georgia, 'Times New Roman', serif";
  g.fillText("MAISON ÉLYSE", width / 2, page.y + 78);
  g.font = "italic 20px Georgia, serif";
  g.fillText("Menu du soir", width / 2, page.y + 110);
  g.fillRect(width / 2 - 60, page.y + 130, 120, 1);
  const left = page.x + 30, right = page.x + page.w - 30;
  let y = page.y + 182;
  for (const [section, items] of MENU) {
    g.textAlign = "center";
    g.font = "600 17px Georgia, serif";
    g.fillText(section.toUpperCase(), width / 2, y);
    y += 36;
    g.font = "400 15px Georgia, serif";
    for (const [name, price] of items) {
      const label = `${price} $`;
      g.textAlign = "left";
      g.fillText(name, left, y);
      g.textAlign = "right";
      g.fillText(label, right, y);
      // Dotted leader between the dish and its price.
      g.fillStyle = "#8a857c";
      const end = right - g.measureText(label).width - 8;
      for (let x = left + g.measureText(name).width + 8; x < end; x += 7)
        g.fillRect(x, y - 4, 2, 2);
      g.fillStyle = ink;
      y += 31;
    }
    y += 30;
  }
  g.textAlign = "center";
  g.font = "italic 13px Georgia, serif";
  g.fillStyle = "#6f6a61";
  g.fillText("Allergènes : demandez à votre serveur. Taxes et service en sus.", width / 2, page.y + page.h - 30);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
