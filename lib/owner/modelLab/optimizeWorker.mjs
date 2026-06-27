import { stdin, stdout, stderr } from "node:process";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  reorder,
  simplify,
  textureCompress,
  TextureResizeFilter,
  weld
} from "@gltf-transform/functions";
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier
} from "meshoptimizer";
import sharp from "sharp";

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function readPreset() {
  const raw = process.env.VISTAIRE_MODEL_LAB_WORKER_PRESET ?? "";
  const preset = raw ? JSON.parse(raw) : null;
  if (!preset || typeof preset.id !== "string") {
    throw new Error("Model Lab optimizer preset is missing.");
  }
  return preset;
}

async function optimize() {
  const preset = readPreset();
  const bytes = await readStdin();

  await Promise.all([
    MeshoptDecoder.ready,
    MeshoptEncoder.ready,
    MeshoptSimplifier.ready
  ]);

  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.SILENT))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder
    });

  const document = await io.readBinary(new Uint8Array(bytes));
  const transforms = [prune(), dedup(), weld()];

  if (preset.simplifyRatio !== null && preset.simplifyRatio < 1) {
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: preset.simplifyRatio,
        error: preset.simplifyError ?? 0.0004,
        lockBorder: preset.lockBorder
      })
    );
  }

  if (preset.textureMax !== null) {
    transforms.push(
      textureCompress({
        encoder: sharp,
        resize: [preset.textureMax, preset.textureMax],
        resizeFilter: TextureResizeFilter.LANCZOS3,
        quality: preset.textureQuality ?? 92,
        limitInputPixels: true
      })
    );
  }

  if (preset.useMeshopt) {
    transforms.push(reorder({ encoder: MeshoptEncoder }));
  }

  transforms.push(prune());
  await document.transform(...transforms);
  stdout.write(Buffer.from(await io.writeBinary(document)));
}

optimize().catch((error) => {
  const message = error instanceof Error ? error.message : "Model Lab optimizer worker failed.";
  stderr.write(message);
  process.exitCode = 1;
});
