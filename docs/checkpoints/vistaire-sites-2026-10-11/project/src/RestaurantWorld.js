import * as THREE from "three";
import { journeyCoordinate } from "./SceneDirector.js";

// Distinct shades along the black and gold palette preserve the changing
// atmosphere of every chapter instead of repeating three flat backgrounds.
const night = new THREE.Color("#050505");
const charcoal = new THREE.Color("#282825");
const nightShade = (mix) => night.clone().lerp(charcoal, mix);
const moods = [
  [nightShade(0.3), "#bda06c", "#f3e5c9"],
  [nightShade(0.1), "#b7a17b", "#eee8da"],
  [nightShade(0.7), "#b29e80", "#eee9df"],
  [nightShade(0.4), "#b5a17d", "#ede5d3"],
  [nightShade(0.05), "#b8a16f", "#f4ebd7"],
  [nightShade(0.9), "#bca46f", "#f0e6d3"],
  [nightShade(0.5), "#b3a080", "#eee9df"],
  [nightShade(1), "#b3a081", "#eee8dc"],
  [nightShade(0.6), "#b29c76", "#e8e0d1"],
  [nightShade(0.2), "#bba577", "#f0e3ca"],
  [nightShade(0.8), "#b59f77", "#ece4d6"],
  [nightShade(0), "#a99776", "#e7ddca"],
];

// Shared scroll choreography for the interactive room and cinematic films.
export function createRestaurantJourney(
  scene,
  root,
  applyAtmosphere = () => false,
) {
  const ambientTarget = new THREE.Color();
  const positionTarget = new THREE.Vector3();
  let yaw = 0;
  const interpolatedMood = moods[0].map(() => new THREE.Color());
  const nextMood = new THREE.Color();
  return {
    root,
    update(state, damping, canvas) {
      const index = journeyCoordinate(state);
      const lower = Math.floor(index),
        upper = Math.ceil(index);
      const mood = interpolatedMood.map((color, i) =>
        color
          .set(moods[lower][i])
          .lerp(nextMood.set(moods[upper][i]), index - lower),
      );
      ambientTarget.set(mood[0]);
      // The table remains the anchor. The room travels behind it as the
      // camera approaches, then turns toward another part of the dining room.
      // Page distance keeps the room moving at one pace through chapter exits.
      // Legacy cinematic scripts without page geometry keep their prior path.
      const distance = state.scrollDistance;
      const hasDistance = Number.isFinite(distance);
      const targetYaw =
        -0.075 + (hasDistance ? distance * 0.006 : index * 0.018);
      const targetZ = hasDistance
        ? -0.4 + distance * 0.06
        : -0.4 + Math.min(index, 3) * 0.65 + Math.max(0, index - 3) * 0.055;
      positionTarget.set(
        Math.sin(hasDistance ? distance * 0.04 : index * 0.62) * 0.65,
        0,
        targetZ,
      );
      root.position.lerp(positionTarget, damping);
      yaw = THREE.MathUtils.lerp(yaw, targetYaw, damping);
      root.rotation.y = yaw;
      scene.background.lerp(ambientTarget, damping);
      scene.fog.color.copy(scene.background);
      const lightSettling = applyAtmosphere(mood, damping);
      canvas.dataset.journey =
        state.section === "hero"
          ? "arrivee"
          : state.section === "ai"
            ? "scan"
            : state.section === "wearable"
              ? "menu"
              : "plats";
      canvas.dataset.roomPosition = root.position
        .toArray()
        .map((n) => n.toFixed(3))
        .join(",");
      canvas.dataset.roomYaw = yaw.toFixed(4);
      canvas.dataset.atmosphere = `#${scene.background.getHexString()}`;
      const colorMoving = (a, b) =>
        Math.max(
          Math.abs(a.r - b.r),
          Math.abs(a.g - b.g),
          Math.abs(a.b - b.b),
        ) > 0.0001;
      return (
        root.position.distanceToSquared(positionTarget) > 1e-7 ||
        Math.abs(yaw - targetYaw) > 0.0001 ||
        colorMoving(scene.background, ambientTarget) ||
        lightSettling
      );
    },
  };
}
