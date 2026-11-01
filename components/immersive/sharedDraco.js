import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

// One Draco worker for the room, the stands and the dishes: the decoder wasm is
// fetched and compiled once per page visit instead of once per loader. Kept
// alive across scenes (client navigation between cinematic pages reuses it).
let loader;
export function sharedDraco() {
  if (!loader) {
    loader = new DRACOLoader()
      .setDecoderPath("/immersive-assets/draco/")
      .setDecoderConfig({ type: "wasm" })
      .setWorkerLimit(1);
    // Compile the decoder now, while the room downloads, not at its first use.
    if (typeof document !== "undefined") loader.preload();
  }
  return loader;
}
