// Scene shots of the cinematic pages beyond the landing and the four pillar
// pages. Each shot only says where the objects stand and from which side the
// camera looks: the scene calibrates the camera distance to the copy's frame,
// separates touching objects and blends shots on scroll. Every page combines
// its own shots, dish, restaurant and stand, so no two pages tell the same story.
const HALF_PI = Math.PI / 2;
const unit = (value) => Math.max(0, Math.min(1, value));
const step = (from, to, value) => {
  const t = unit((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

// A swapped object (the stand's collection, the phone's restaurant) is gone at
// its chapter's edges, so the page changes it unseen. "out" keeps a page's
// first chapter visible at load. Calibration always sees the full object.
function presence(p, mode) {
  const out = 1 - step(0.72, 0.98, p);
  return mode === "out" ? out : step(0, 0.07, p) * out;
}

const KEYS = { dish: "dish", phone: "phone", pdf: "pdfPhone", stand: "support", laptop: "laptop" };

function place(pose, name, spec, p, mobile, calibrating) {
  const key = KEYS[name];
  const { at, scale = 1, flat = false, yaw = 0, turn = 0, swap, lift = 0, tilt = -0.04 } = spec;
  const x = at[0] * (mobile ? 0.62 : 1), z = at[1];
  const s = scale * (mobile ? 0.9 : 1) * (swap && !calibrating ? presence(p, swap) : 1);
  const angle = yaw + turn * p;
  let position, rotation;
  if (name === "dish") {
    position = [x, 0.02 + lift, z];
    rotation = [0.08, angle, 0];
  } else if (name === "phone" || name === "pdf") {
    position = flat ? [x, 0.16, z] : [x, 0.06 + 1.08 * s + lift, z];
    rotation = flat ? [-HALF_PI, 0, angle] : [tilt, angle, 0];
  } else if (name === "stand") {
    position = flat ? [x, 0.13, z] : [x, 0.08, z];
    rotation = flat ? [-HALF_PI + 0.2, 0, angle] : [-0.06, angle, 0];
  } else {
    position = [x, 0.08, z];
    rotation = [0, angle, 0];
  }
  pose[key] = position;
  pose[`${key}Rotation`] = rotation;
  pose[`${key}Scale`] = s;
}

// view: [azimuth, elevation] in radians, 0/0 = straight from the guest's side.
const SHOTS = {
  // About: from the room to the house's three values, then the table from above.
  "about-room": { view: [0.95, 0.42], dish: { at: [0, 0.4] }, stand: { at: [-1.9, 0.7], scale: 0.75, flat: true, yaw: -0.2 }, phone: { at: [1.9, 0.8], scale: 0.62, flat: true, yaw: 0.25 } },
  "about-vision": { view: [-0.35, 0.16], dish: { at: [0.3, 0.5], scale: 1.05, turn: 0.8 }, phone: { at: [-1.25, 0.1], scale: 0.85, yaw: 0.35 } },
  "about-values": { view: [0, 0.28], phone: { at: [-1.75, 0.5], scale: 0.8, yaw: 0.3 }, dish: { at: [0, 0.6], scale: 0.85, turn: 0.6 }, stand: { at: [1.8, 0.5], scale: 0.85, yaw: -0.35 } },
  "about-closing": { view: [0.2, 1.3], phone: { at: [-1.6, 0.6], scale: 0.7, flat: true, yaw: 0.3 }, dish: { at: [0.1, 0.5], scale: 0.9 }, stand: { at: [1.7, 0.4], scale: 0.7, flat: true, yaw: -0.25 } },
  // Contact: Trouvable's menu faces the guest, then rests by its burger.
  "contact-hero": { view: [0.45, 0.2], phone: { at: [0, 0.9], scale: 1.1, yaw: -0.3, turn: 0.5 } },
  "contact-table": { view: [-0.7, 0.62], dish: { at: [-0.4, 0.5] }, phone: { at: [1.25, 0.7], scale: 0.75, flat: true, yaw: -0.35 } },
  // Booking: the Carré stand and its menu, then the table reviewed together.
  "book-hero": { view: [-0.45, 0.24], stand: { at: [0.65, 0.4], yaw: -0.4, turn: 0.3 }, phone: { at: [-0.8, 0.9], scale: 0.85, yaw: 0.4 } },
  "book-exchange": { view: [0.1, 1.2], stand: { at: [-1.6, 0.4], scale: 0.75, flat: true }, dish: { at: [0.2, 0.5], scale: 0.95 }, phone: { at: [1.7, 0.6], scale: 0.68, flat: true, yaw: 0.3 } },
  // Demo: three restaurants, one phone; its menu changes between chapters.
  "demo-elyse": { view: [0.3, 0.12], phone: { at: [0, 1.2], scale: 1.2, yaw: -0.25, turn: 0.5, swap: "out" } },
  "demo-trouvable": { view: [0, 1.35], phone: { at: [0, 0.7], scale: 1.15, flat: true, yaw: -0.4, turn: 0.6, swap: "both" } },
  "demo-sauge": { view: [-0.4, 0.22], phone: { at: [-0.75, 1.0], scale: 0.95, yaw: 0.35, swap: "both" }, stand: { at: [0.85, 0.6], scale: 0.95, yaw: -0.35 } },
  // Restaurant preview: the laptop opens on the dashboard, then meets the QR.
  "apercu-laptop": { view: [0.25, 0.3], laptop: { at: [0, 0.2], yaw: -0.15 } },
  "apercu-dashboard": { view: [-0.15, 0.1], laptop: { at: [0, 0.3], scale: 1.05, yaw: 0.1 } },
  "apercu-qr": { view: [0.5, 0.45], laptop: { at: [-0.95, 0], scale: 0.85, yaw: 0.25 }, stand: { at: [1.6, 0.6], scale: 0.85, yaw: -0.45 } },
  // Pricing: one chapter per collection; the stand changes unseen in between.
  "pricing-acrylique": { view: [0.35, 0.22], stand: { at: [0, 0.6], scale: 1.1, yaw: -0.5, turn: 0.6, swap: "out" } },
  "pricing-sculpte": { view: [-0.5, 0.35], stand: { at: [-0.55, 0.5], yaw: 0.4, swap: "both" }, dish: { at: [1.15, 0.7], scale: 0.8 } },
  "pricing-carre": { view: [0.1, 1.15], stand: { at: [0, 0.6], scale: 1.1, flat: true, yaw: 0.3, swap: "both" }, phone: { at: [1.55, 0.7], scale: 0.7, flat: true, yaw: -0.3 } },
  "pricing-signature": { view: [0.55, 0.18], stand: { at: [0.6, 0.5], scale: 1.05, yaw: -0.55, swap: "both" }, phone: { at: [-0.9, 0.9], scale: 0.85, yaw: 0.35 } },
  // Guide, QR menu without an app: scan, read, then the table.
  "guide-journey-scan": { view: [-0.25, 0.3], stand: { at: [-0.45, 0.3], scale: 0.95, yaw: 0.3 }, phone: { at: [0.9, 1.1], scale: 0.8, yaw: -0.45, lift: 0.25, tilt: -0.3 } },
  "guide-journey-read": { view: [0.2, 0.05], phone: { at: [0, 1.3], scale: 1.25, yaw: -0.15, turn: 0.3, tilt: -0.25 } },
  "guide-journey-table": { view: [0.6, 0.55], dish: { at: [0, 0.5] }, phone: { at: [-1.55, 0.9], scale: 0.65, flat: true, yaw: 0.2 }, stand: { at: [1.4, -0.2], scale: 0.8, yaw: -0.5 } },
  // Guide, premium menu anatomy: the plan, the screen, the plate.
  "guide-anatomy-plan": { view: [0, 1.4], phone: { at: [-1.4, 0.6], scale: 0.8, flat: true }, dish: { at: [0.6, 0.5], scale: 0.9 } },
  "guide-anatomy-screen": { view: [-0.3, 0.12], phone: { at: [0, 1.1], scale: 1.3, yaw: 0.3, turn: -0.4 } },
  "guide-anatomy-plate": { view: [0.4, 0.2], dish: { at: [0, 0.8], scale: 1.15, turn: 1 }, phone: { at: [-1.5, 0.2], scale: 0.75, yaw: 0.5 } },
  // Guide, useful 3D or gimmick: the dish alone, against a flat menu, at the table.
  "guide-decision-dish": { view: [0.15, 0.32], dish: { at: [0, 0.9], scale: 1.3, turn: 1.2 } },
  "guide-decision-versus": { view: [-0.5, 0.5], dish: { at: [0.75, 0.6], scale: 0.9 }, phone: { at: [-1.15, 0.9], scale: 0.75, flat: true, yaw: 0.3 } },
  "guide-decision-table": { view: [0.8, 0.3], dish: { at: [0, 0.5], scale: 0.85 }, phone: { at: [1.45, 0.5], scale: 0.8, yaw: -0.6 } },
  // Need and audience pages: four shots each, see GEO_SCRIPTS in pages/GeoCinematic.
  "geo-1-1": { view: [0.4, 0.25], stand: { at: [0.3, 0.5], scale: 1.05, yaw: -0.5, turn: 0.5 } },
  "geo-1-2": { view: [0, 1.3], pdf: { at: [-1.05, 0.6], scale: 0.85, flat: true, yaw: 0.2 }, stand: { at: [1.05, 0.6], scale: 0.8, flat: true, yaw: -0.2 } },
  "geo-1-3": { view: [-0.3, 0.1], phone: { at: [0.2, 1.1], scale: 1.15, yaw: 0.35 } },
  "geo-1-4": { view: [0.7, 0.4], dish: { at: [0, 0.4], scale: 0.95 }, stand: { at: [-1.6, 0], scale: 0.8, yaw: 0.4 }, phone: { at: [1.6, 0.8], scale: 0.65, flat: true, yaw: -0.2 } },
  "geo-2-1": { view: [0, 1.35], phone: { at: [0, 0.7], scale: 1.1, flat: true, yaw: -0.3, turn: 0.5 } },
  "geo-2-2": { view: [0.35, 0.15], phone: { at: [0, 1], scale: 1.15, yaw: -0.4, turn: 0.6 } },
  "geo-2-3": { view: [-0.55, 0.3], phone: { at: [-0.85, 1], scale: 0.85, yaw: 0.4 }, dish: { at: [0.85, 0.8], scale: 0.85 } },
  "geo-2-4": { view: [0.9, 0.55], dish: { at: [0, 0.4], scale: 0.9 }, phone: { at: [1.45, 0.9], scale: 0.65, flat: true, yaw: 0.3 } },
  "geo-3-1": { view: [-0.2, 0.3], pdf: { at: [0, 1], scale: 1.15, yaw: 0.3, turn: -0.4 } },
  "geo-3-2": { view: [0.15, 0.45], pdf: { at: [-0.95, 0.8], scale: 0.85, flat: true, yaw: 0.2 }, phone: { at: [0.85, 0.8], scale: 0.95, yaw: -0.3 } },
  "geo-3-3": { view: [0.5, 0.25], phone: { at: [-0.65, 1], scale: 0.9, yaw: 0.4 }, dish: { at: [0.95, 0.6], scale: 0.9 } },
  "geo-3-4": { view: [0, 1.2], dish: { at: [0, 0.5], scale: 1.05, turn: 0.6 } },
  "geo-4-1": { view: [0.6, 1], pdf: { at: [0, 0.6], flat: true, yaw: -0.35, turn: 0.4 } },
  "geo-4-2": { view: [-0.35, 0.22], phone: { at: [0.45, 1], scale: 1.05, yaw: -0.2 }, pdf: { at: [-1.25, 0.9], scale: 0.7, flat: true, yaw: 0.4 } },
  "geo-4-3": { view: [0.25, 0.35], dish: { at: [0, 0.6], turn: 0.8 } },
  "geo-4-4": { view: [-0.8, 0.45], dish: { at: [-0.55, 0.5], scale: 0.9 }, phone: { at: [1.25, 0.6], scale: 0.8, yaw: -0.5 } },
  "geo-5-1": { view: [0.25, 0.42], dish: { at: [0, 0.6], scale: 1.15, turn: 1 } },
  "geo-5-2": { view: [-0.45, 0.15], phone: { at: [-0.95, 1], scale: 0.95, yaw: 0.45 }, dish: { at: [0.95, 0.5], scale: 0.8 } },
  "geo-5-3": { view: [0, 1.4], phone: { at: [0.95, 0.7], scale: 0.8, flat: true, yaw: -0.2 }, dish: { at: [-0.75, 0.5], scale: 0.85 } },
  "geo-5-4": { view: [0.55, 0.08], phone: { at: [0, 1.1], scale: 1.2, yaw: -0.35, turn: 0.5 } },
  "geo-6-1": { view: [-0.6, 0.3], dish: { at: [0, 0.7], scale: 1.2, turn: 1.2 } },
  "geo-6-2": { view: [0.7, 0.2], dish: { at: [0, 0.6], scale: 1.1, turn: -0.8 } },
  "geo-6-3": { view: [0, 1.45], dish: { at: [-0.55, 0.5], scale: 0.95 }, phone: { at: [1.25, 0.6], scale: 0.7, flat: true, yaw: 0.15 } },
  "geo-6-4": { view: [-0.25, 0.25], dish: { at: [0.75, 0.5], scale: 0.85 }, stand: { at: [-0.95, 0.3], scale: 0.9, yaw: 0.35 } },
  "geo-7-1": { view: [0.1, 0.18], phone: { at: [0, 1.1], scale: 1.2, yaw: 0.2, turn: -0.4 } },
  "geo-7-2": { view: [-0.65, 0.5], dish: { at: [0, 0.6] } },
  "geo-7-3": { view: [0.45, 0.3], dish: { at: [-0.65, 0.5], scale: 0.85 }, phone: { at: [1.05, 0.8], scale: 0.85, yaw: -0.45 } },
  "geo-7-4": { view: [0, 1.25], phone: { at: [-1.25, 0.8], scale: 0.7, flat: true, yaw: 0.3 }, dish: { at: [0.65, 0.5], scale: 0.85 } },
  "geo-8-1": { view: [1, 0.45], dish: { at: [0, 0.4] }, phone: { at: [1.65, 0.9], scale: 0.62, flat: true, yaw: 0.3 } },
  "geo-8-2": { view: [-0.2, 0.22], phone: { at: [0, 1], scale: 1.1, yaw: -0.25, turn: 0.5 } },
  "geo-8-3": { view: [0.3, 1.3], dish: { at: [0, 0.6], scale: 1.05, turn: 0.5 } },
  "geo-8-4": { view: [-0.9, 0.35], dish: { at: [0.55, 0.5], scale: 0.9 }, phone: { at: [-1.15, 0.6], scale: 0.85, yaw: 0.5 } },
  "geo-9-1": { view: [-0.9, 0.4], dish: { at: [0, 0.5], scale: 1.1 }, phone: { at: [-1.5, 0.9], scale: 0.62, flat: true, yaw: -0.3 } },
  "geo-9-2": { view: [0.2, 1.3], phone: { at: [0, 0.7], scale: 1.05, flat: true, yaw: 0.35, turn: -0.5 } },
  "geo-9-3": { view: [0.6, 0.15], phone: { at: [0.65, 1], yaw: -0.5 }, dish: { at: [-0.75, 0.6], scale: 0.8 } },
  "geo-9-4": { view: [-0.1, 0.3], dish: { at: [0, 0.6], scale: 1.15, turn: 0.9 } },
  "geo-10-1": { view: [0.5, 0.12], phone: { at: [0, 1], scale: 1.2, yaw: -0.45, turn: 0.7 } },
  "geo-10-2": { view: [-0.3, 0.55], dish: { at: [0, 0.6], scale: 1.1, turn: -0.7 } },
  "geo-10-3": { view: [0.85, 0.35], dish: { at: [-0.45, 0.5], scale: 0.85 }, phone: { at: [1.25, 0.6], scale: 0.7, flat: true, yaw: -0.15 } },
  "geo-10-4": { view: [0, 1.35], dish: { at: [0.65, 0.5], scale: 0.85 }, phone: { at: [-1.1, 0.8], scale: 0.75, flat: true, yaw: 0.25 } },
  "geo-11-1": { view: [-0.35, 0.2], stand: { at: [0, 0.5], scale: 1.1, yaw: 0.45, turn: -0.5 } },
  "geo-11-2": { view: [0.4, 0.35], stand: { at: [-0.85, 0.4], scale: 0.9, yaw: 0.4 }, dish: { at: [0.85, 0.7], scale: 0.85 } },
  "geo-11-3": { view: [0, 0.1], phone: { at: [0, 1.1], scale: 1.25, yaw: 0.15, turn: -0.35 } },
  "geo-11-4": { view: [0.75, 0.6], dish: { at: [0, 0.4], scale: 0.9 }, stand: { at: [-1.6, 0.5], scale: 0.7, flat: true, yaw: -0.2 }, phone: { at: [1.6, 0.8], scale: 0.6, flat: true, yaw: 0.25 } },
  "geo-12-1": { view: [0.05, 0.25], dish: { at: [0, 0.6], scale: 1.3, turn: 0.9 } },
  "geo-12-2": { view: [-0.7, 0.15], dish: { at: [0.55, 0.6], scale: 0.9 }, phone: { at: [-1.05, 0.7], scale: 0.85, yaw: 0.55 } },
  "geo-12-3": { view: [0.35, 1.25], phone: { at: [0, 0.7], flat: true, yaw: -0.2 } },
  "geo-12-4": { view: [0.9, 0.3], phone: { at: [1.05, 0.7], scale: 0.85, yaw: -0.6 }, dish: { at: [-0.65, 0.5], scale: 0.9 } },
};

/** Partial pose for a page shot, or null for the landing's own sections. */
export function pageShot(section, p, mobile, calibrating = false) {
  const shot = SHOTS[section];
  if (!shot) return null;
  const [azimuth, elevation] = shot.view;
  const look = [0, 0.6, 0.5];
  const pose = {
    look,
    camera: [
      look[0] + 8 * Math.sin(azimuth) * Math.cos(elevation),
      look[1] + 8 * Math.sin(elevation),
      look[2] + 8 * Math.cos(azimuth) * Math.cos(elevation),
    ],
  };
  for (const name of Object.keys(KEYS))
    if (shot[name]) place(pose, name, shot[name], p, mobile, calibrating);
  return pose;
}
