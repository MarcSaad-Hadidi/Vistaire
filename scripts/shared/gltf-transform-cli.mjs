import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);

export function resolveGltfTransformCliPath(env = process.env) {
  const candidates = [];
  const override = env.VISTAIRE_GLTF_TRANSFORM_CLI?.trim();
  if (override) {
    candidates.push(resolve(override));
  }

  try {
    const packageEntry = require.resolve("@gltf-transform/cli");
    candidates.push(join(dirname(packageEntry), "..", "bin", "cli.js"));
  } catch {
    // The final error below includes the configured override, if any.
  }

  const cliPath = candidates.find((candidate) => existsSync(candidate));
  if (cliPath) return cliPath;

  throw new Error(
    [
      "Missing glTF Transform CLI.",
      "Install @gltf-transform/cli as a production dependency or set VISTAIRE_GLTF_TRANSFORM_CLI.",
      candidates.length > 0 ? `Tried: ${candidates.join(", ")}` : "No candidate path resolved."
    ].join(" ")
  );
}
