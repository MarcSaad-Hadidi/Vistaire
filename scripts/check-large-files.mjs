#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const MAX_BYTES = 5 * 1024 * 1024;
const JSON_OUTPUT = process.argv.includes("--json");

const DANGEROUS_EXTENSIONS = new Set([
  ".ai",
  ".avi",
  ".blend",
  ".exr",
  ".fbx",
  ".fig",
  ".glb",
  ".gltf",
  ".gz",
  ".hdr",
  ".m4v",
  ".mov",
  ".mp4",
  ".obj",
  ".psd",
  ".rar",
  ".sketch",
  ".stl",
  ".tar",
  ".usd",
  ".usda",
  ".usdc",
  ".usdz",
  ".webm",
  ".zip",
  ".7z"
]);

const BLOCKED_PREFIXES = [
  "3D Plat/",
  "3D photo/",
  "asset-review/",
  "assets/3d/source/",
  "assets/3d/work/"
];

// Grandfathered assets already present on origin/main. These are exceptions,
// not precedent: any new or changed heavy media must go through asset review.
const ALLOWLIST = new Map(
  [
    [
      "3D Plat/Homard bleu, bisque corsée & fenouil.glb",
      {
        maxBytes: 24905692,
        sha256: [
          "c0fa60aaaf47be44895b14fe460f118882661aacaf9ed87fc9fc2e98f14b8048"
        ],
        reason: "Existing main source drop; future source drops must stay outside Git."
      }
    ],
    [
      "3D Plat/Ravioles de chèvre frais & miel de Montérégie.glb",
      {
        maxBytes: 27000340,
        sha256: [
          "7522fc92fe65d86a20a2147ce95af0077dcf079d8ff93bb80bccd00fb833e490"
        ],
        reason: "Existing main source drop; future source drops must stay outside Git."
      }
    ],
    [
      "3D Plat/Soufflé tiède au chocolat grand cru.glb",
      {
        maxBytes: 23670172,
        sha256: [
          "6a65423826b8614f80b9e9ffb6a099e9ce9f8dd85f47abaf7743e96e6e416afe"
        ],
        reason: "Existing main source drop; future source drops must stay outside Git."
      }
    ],
    [
      "3D Plat/ScriptAssiette.txt",
      {
        maxBytes: 6897,
        // Git stores this text file with LF endings, while Windows checkouts use CRLF.
        // Keep both digests so the baseline asset check is stable across platforms.
        sha256: [
          "73714cd1874037f9871d11d1667290778f5b448bcccff1ab2c4892fee8779bae",
          "b0d551f61daf6c0300c8941730c1182411d0890b4fd548ed6ba1e3c59cdddc25"
        ],
        reason: "Existing main source-drop note; future source-drop notes should live in docs or storage review."
      }
    ],
    [
      "3D photo/Gourmet lobster with roasted vegetables.png",
      {
        maxBytes: 2167723,
        sha256: [
          "bafa2caaa73f6abed87fdf20958d9c8ecce7de95c897ad88d77149a11b8673a4"
        ],
        reason: "Existing main source image; future generated source images must stay outside Git."
      }
    ],
    [
      "3D photo/Maison Élyse N°1.png",
      {
        maxBytes: 1726409,
        sha256: [
          "970c0e06873decdb903d6012ee3da45f25bc7b9408c3662f35b3e3ce2f92dc74"
        ],
        reason: "Existing main source image; future generated source images must stay outside Git."
      }
    ],
    [
      "3D photo/Ravioles de chèvre frais & miel de Montérégie.png",
      {
        maxBytes: 2073590,
        sha256: [
          "3d38d67df4dcb08605fcd2931cf1bad0100738f15f86e30b2c33b421dea43893"
        ],
        reason: "Existing main source image; future generated source images must stay outside Git."
      }
    ],
    [
      "3D photo/Soufflé tiède au chocolat grand cru.png",
      {
        maxBytes: 2197192,
        sha256: [
          "3c539b9412f3c7714f13af1fb7ef49e09cc8459f26f74536a1c76d0dbe96d739"
        ],
        reason: "Existing main source image; future generated source images must stay outside Git."
      }
    ],
    [
      "public/models/demo/ar-lite/homard-bisque-ar-lite.glb",
      {
        maxBytes: 8594588,
        sha256: [
          "e2a1022c24ffcf807f47b43c5334a66478736d82e518247788cffc45c06af54a"
        ],
        reason: "Existing demo 3D runtime asset."
      }
    ],
    [
      "public/models/demo/ar-lite/homard-bisque-ios-quicklook-ultra.usdz",
      {
        maxBytes: 2450572,
        sha256: [
          "addff79da4a4e4b487949e4981a7e19cfcd39c82f1d4c36784d3c2a9d039c1e4"
        ],
        reason: "Existing demo Quick Look runtime asset."
      }
    ],
    [
      "public/models/demo/ar-lite/ravioles-chevre-miel-ios-quicklook-ultra.usdz",
      {
        maxBytes: 3540884,
        sha256: [
          "7b4ea63dbcdd92f3e41a8f7d062d307a8242ecb86cbfaa452fef7a6398924908"
        ],
        reason: "Existing demo Quick Look runtime asset."
      }
    ],
    [
      "public/models/demo/ar-lite/souffle-chocolat-ios-quicklook-ultra.usdz",
      {
        maxBytes: 5231780,
        sha256: [
          "1ab81a3e292e0f290441028e20b7f2fb56e547c07851e2818abb651c8acfcea5"
        ],
        reason: "Existing demo Quick Look runtime asset."
      }
    ],
    [
      "public/models/demo/homard-bisque-meshopt-ee44bc60.glb",
      {
        maxBytes: 4955904,
        sha256: [
          "ee44bc6028b8dff1f7bedef686f995c6b3b51ac5298bcc55d8da31be65267874"
        ],
        reason: "Existing demo optimized GLB runtime asset."
      }
    ],
    [
      "public/models/demo/homard-bisque.glb",
      {
        maxBytes: 3405480,
        sha256: [
          "3f3fec43de7642d26acc7c9920a82a5c1c80a55c61857df1b7f3aef29f15bb1f"
        ],
        reason: "Existing demo GLB runtime asset."
      }
    ],
    [
      "public/models/demo/homard-bisque.usdz",
      {
        maxBytes: 80333353,
        sha256: [
          "dd8e4e24af9b6e782bcd953ae07a0f3134bc8d87ff4ea0f7c9dbaec487badefc"
        ],
        reason: "Existing demo USDZ runtime asset."
      }
    ],
    [
      "public/models/demo/maison-elyse-n1.glb",
      {
        maxBytes: 86380,
        sha256: [
          "7f12cd7bc6f47ec97f6cef3b65c453bbef537aa7c095289899c51782e48eebef"
        ],
        reason: "Existing lightweight demo GLB fixture."
      }
    ],
    [
      "public/models/demo/maison-elyse-n1.usdz",
      {
        maxBytes: 208984,
        sha256: [
          "0c3f6233e237cc27c26d0784927059ef0ea7ba15e83b92e9a472a3dd2961213a"
        ],
        reason: "Existing lightweight demo USDZ fixture."
      }
    ],
    [
      "public/models/demo/ravioles-chevre-miel-meshopt-6b812a04.glb",
      {
        maxBytes: 27714228,
        sha256: [
          "6b812a046c383581aaf642e74e2e2f5d2eac4594b23ec8c4148a64fec0f62fd6"
        ],
        reason: "Existing demo optimized GLB runtime asset."
      }
    ],
    [
      "public/models/demo/ravioles-chevre-miel.glb",
      {
        maxBytes: 76609104,
        sha256: [
          "c665ca403a9543296383a8234310b01c58e5bfce47efa9fa1bae39caa28847b0"
        ],
        reason: "Existing demo GLB runtime asset."
      }
    ],
    [
      "public/models/demo/souffle-chocolat-meshopt-76eb0faa.glb",
      {
        maxBytes: 17011872,
        sha256: [
          "76eb0faa401dc853d0c8c27835a9083dbc006377f07c65f1284281144f943608"
        ],
        reason: "Existing demo optimized GLB runtime asset."
      }
    ],
    [
      "public/models/demo/souffle-chocolat.glb",
      {
        maxBytes: 27286348,
        sha256: [
          "6aaab33a629b79ecf7f01bcedc03534528cc49ebb50064772e57cec9ecb1fc79"
        ],
        reason: "Existing demo GLB runtime asset."
      }
    ],
    [
      "public/models/demo/souffle-chocolat.usdz",
      {
        maxBytes: 24873890,
        sha256: [
          "8fbdd7dc6d60e2c75da334c665ae30953328df426c64fedc6a5be68895e5284f"
        ],
        reason: "Existing demo USDZ runtime asset."
      }
    ],
    [
      "public/videos/menualive-full.mp4",
      {
        maxBytes: 6615443,
        sha256: [
          "9b49d7b1920a372446233166bdb6541680a1a64f68bf037a1efd8b3c030938ef"
        ],
        reason: "Existing public video asset."
      }
    ],
    [
      "public/videos/Vistaire2.mp4",
      {
        maxBytes: 34449258,
        sha256: [
          "e4a89ed6ab21f55f60c9ee33a676ea2292bae5b6ecef09efefcf3173a6e85e29"
        ],
        reason:
          "Reviewed runtime landing hero video requested for Vistaire PR #45; served directly from public assets without Git LFS."
      }
    ],
    [
      "public/videos/optimized/upscaled-video-desktop-scrub.mp4",
      {
        maxBytes: 24297153,
        sha256: [
          "3db269bf3fb8c822a0dec30493da046bedc7c64b881571d140e3d6692c24eed6"
        ],
        reason: "Existing active desktop hero video exception."
      }
    ],
    [
      "public/videos/optimized/upscaled-video-mobile-scrub.mp4",
      {
        maxBytes: 3093827,
        sha256: [
          "32e28f2cf533ec3975fa3291090f6262f4645ea26f18ea1d8b9fbdd8c9c1f8ff"
        ],
        reason: "Existing active mobile hero video exception."
      }
    ],
    [
      "public/videos/upscaled-video.mp4",
      {
        maxBytes: 41480123,
        sha256: [
          "1e9bc164c0b64855f94ba81464454de2a5d1f46e0b863bdf97c73464d5de4e05"
        ],
        reason: "Existing source video retained on main; do not add new source video blobs."
      }
    ],
    [
      "public/videos/video-1.mp4",
      {
        maxBytes: 2043379,
        sha256: [
          "8f058c65b18c2c4bf6f344297fef5f3c6279b7d60e602f6397ec361e869aa0bf"
        ],
        reason: "Existing public video asset."
      }
    ],
    [
      "public/videos/video-2.mp4",
      {
        maxBytes: 1882038,
        sha256: [
          "26865a9d09d9396fd17872ed43ef7bed999f15dff30186dd53857621e9855dec"
        ],
        reason: "Existing public video asset."
      }
    ],
    [
      "public/videos/video-3.mp4",
      {
        maxBytes: 2798041,
        sha256: [
          "5441dae94fa1024b7030f409f76bd2b52a299660db69d7e80e6f688d1e5ff4ee"
        ],
        reason: "Existing public video asset."
      }
    ],
    [
      "public/videos/video-4.mp4",
      {
        maxBytes: 2741019,
        sha256: [
          "9b342195113c5f029416f37343bf2419dc6ac03e9820f42845a52ab28575a87b"
        ],
        reason: "Existing public video asset."
      }
    ],
    [
      "video/upscaled-video.mp4",
      {
        maxBytes: 41480123,
        sha256: [
          "1e9bc164c0b64855f94ba81464454de2a5d1f46e0b863bdf97c73464d5de4e05"
        ],
        reason: "Existing non-runtime source video retained on main."
      }
    ],
    [
      "video/video1.mp4",
      {
        maxBytes: 2043379,
        sha256: [
          "8f058c65b18c2c4bf6f344297fef5f3c6279b7d60e602f6397ec361e869aa0bf"
        ],
        reason: "Existing source video retained on main."
      }
    ],
    [
      "video/video2.mp4",
      {
        maxBytes: 1882038,
        sha256: [
          "26865a9d09d9396fd17872ed43ef7bed999f15dff30186dd53857621e9855dec"
        ],
        reason: "Existing source video retained on main."
      }
    ],
    [
      "video/video3.mp4",
      {
        maxBytes: 2798041,
        sha256: [
          "5441dae94fa1024b7030f409f76bd2b52a299660db69d7e80e6f688d1e5ff4ee"
        ],
        reason: "Existing source video retained on main."
      }
    ],
    [
      "video/video4.mp4",
      {
        maxBytes: 2741019,
        sha256: [
          "9b342195113c5f029416f37343bf2419dc6ac03e9820f42845a52ab28575a87b"
        ],
        reason: "Existing source video retained on main."
      }
    ]
  ]
);

function runGit(args) {
  return execFileSync("git", ["-c", "core.quotepath=false", ...args], {
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function getScannedFiles() {
  const output = runGit(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  return [...new Set(output.toString("utf8").split("\0").filter(Boolean))]
    .map(normalizePath)
    .sort((a, b) => a.localeCompare(b));
}

function isBlockedPrefix(filePath) {
  return BLOCKED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function allowlistProblem(filePath, size, digest) {
  const entry = ALLOWLIST.get(filePath);
  if (!entry) return "not allowlisted";
  if (size > entry.maxBytes) {
    return `allowlisted max is ${entry.maxBytes} bytes`;
  }
  if (entry.sha256 && !entry.sha256.includes(digest)) {
    return "allowlisted SHA-256 does not match";
  }
  return "";
}

function recommendationFor(filePath) {
  if (filePath.startsWith("public/")) {
    return "Use external storage/CDN or add a reviewed exact allowlist entry with owner, reason, max bytes, and checksum.";
  }
  return "Keep generated/source assets outside Git, or document and approve an exact temporary exception.";
}

const files = getScannedFiles();
const violations = [];
let allowedRiskyCount = 0;

for (const filePath of files) {
  if (!existsSync(filePath)) continue;
  const stat = statSync(filePath);
  if (!stat.isFile()) continue;

  const extension = path.extname(filePath).toLowerCase();
  const reasons = [];
  if (stat.size > MAX_BYTES) reasons.push(`larger than ${MAX_BYTES} bytes`);
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    reasons.push(`dangerous Git asset extension ${extension}`);
  }
  if (isBlockedPrefix(filePath)) {
    reasons.push("generated/source asset directory");
  }
  if (reasons.length === 0) continue;

  const digest = sha256(filePath);
  const allowProblem = allowlistProblem(filePath, stat.size, digest);
  if (!allowProblem) {
    allowedRiskyCount += 1;
    continue;
  }

  violations.push({
    path: filePath,
    bytes: stat.size,
    extension: extension || "(none)",
    reasons: [...reasons, allowProblem],
    recommendation: recommendationFor(filePath)
  });
}

const result = {
  scannedFiles: files.length,
  thresholdBytes: MAX_BYTES,
  allowedRiskyFiles: allowedRiskyCount,
  violationCount: violations.length,
  violations
};

if (JSON_OUTPUT) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log("Vistaire asset policy check");
  console.log(`Scanned ${result.scannedFiles} tracked/unignored files.`);
  console.log(`Allowed existing risky assets: ${result.allowedRiskyFiles}.`);
  if (violations.length === 0) {
    console.log("Asset policy passed.");
  } else {
    console.log(`Asset policy failed: ${violations.length} violation(s).`);
    for (const item of violations) {
      console.log("");
      console.log(`FAIL ${item.path}`);
      console.log(`  bytes: ${item.bytes}`);
      console.log(`  extension: ${item.extension}`);
      console.log(`  reason: ${item.reasons.join("; ")}`);
      console.log(`  recommendation: ${item.recommendation}`);
    }
  }
}

process.exitCode = violations.length === 0 ? 0 : 1;
