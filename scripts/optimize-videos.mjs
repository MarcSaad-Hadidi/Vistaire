import { mkdir } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";

const input = "public/videos/upscaled-video.mp4";
const outputDir = "public/videos/optimized";

const variants = [
  {
    output: "upscaled-video-desktop-scrub.mp4",
    description: "desktop high, 1440p source, scrub keyframes",
    args: [
      "-vcodec",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "24",
      "-preset",
      "medium",
      "-g",
      "12",
      "-keyint_min",
      "1",
      "-sc_threshold",
      "0",
      "-an",
      "-movflags",
      "faststart"
    ]
  },
  {
    output: "upscaled-video-desktop-medium-scrub.mp4",
    description: "desktop medium, 1600px wide, scrub keyframes",
    args: [
      "-vcodec",
      "libx264",
      "-vf",
      "scale=1600:-2",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "25",
      "-preset",
      "medium",
      "-g",
      "12",
      "-keyint_min",
      "1",
      "-sc_threshold",
      "0",
      "-an",
      "-movflags",
      "faststart"
    ]
  },
  {
    output: "upscaled-video-mobile-scrub.mp4",
    description: "mobile, 720px wide, scrub keyframes",
    args: [
      "-vcodec",
      "libx264",
      "-vf",
      "scale=720:-2",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "26",
      "-preset",
      "medium",
      "-g",
      "12",
      "-keyint_min",
      "1",
      "-sc_threshold",
      "0",
      "-an",
      "-movflags",
      "faststart"
    ]
  }
];

const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });

if (ffmpegCheck.status !== 0) {
  console.log("ffmpeg is not available. Skipping video optimization.");
  console.log("Install ffmpeg, then run: npm run optimize:videos");
  process.exit(0);
}

await mkdir(outputDir, { recursive: true });

for (const variant of variants) {
  const output = `${outputDir}/${variant.output}`;
  console.log(`Optimizing ${input} -> ${output} (${variant.description}) ...`);

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-y", "-i", input, ...variant.args, output]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed for ${variant.output} with code ${code}`));
      }
    });
  });

  console.log(`Successfully generated ${output}`);
}
