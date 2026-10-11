# Cinematic media verification

Both loops were regenerated and inspected on 2026-10-08 inside the user-provided optimized Restaurant in the evening GLB. No Oryzo media or shader code was used.

| Check | Landscape | Portrait |
| --- | --- | --- |
| Native raster | 1280 × 720 | 720 × 1280 |
| Video codec and profile | H.264 High | H.264 High |
| Pixel format | yuv420p | yuv420p |
| Output frame rate | 24 fps | 24 fps |
| Output frames | 192 | 192 |
| Duration | 8.000000 seconds | 8.000000 seconds |
| Audio | None | None |
| Encoded bytes | 3,040,556 | 2,843,972 |
| Source geometry | Vistaire homard mobile GLB | Vistaire soufflé GLB |

The generator renders 64 native-resolution 3D camera poses at 8 fps, plus two periodic look-ahead poses. FFmpeg's optical motion interpolation produces the intermediate frames and outputs exactly 8 seconds at 24 fps. The source meshes and their original PBR textures remain present in every rendered pose.

Diagnostic decoded output frames 0, 1, 48, 95, 143 and 191 were assembled into contact sheets for both clips. Selected intermediate frames were also viewed at native raster. No obvious plate-edge warping, broken dish geometry, blank frames or exposure jump was seen in those inspected samples. This sample inspection is not a guarantee that every optical interpolation artifact is absent.

The 8-second camera pose is identical to the first pose. The measured mean absolute RGB difference between decoded frame 0 and frame 191 was 2.535/255 for landscape and 2.464/255 for portrait. Those are neighboring motion samples separated by 1/24 second across the loop; small motion and compression differences are expected. The metric is supporting evidence, not proof of imperceptible continuity on every device.

The first-frame posters were generated from the actual rendered canvas in WebP format. `cinematic-provenance.json` records source hashes, video hashes, poster hashes and the independently inspected ffprobe metadata. `node scripts/cinematic/inspect.mjs` reruns the format assertions.

Not verified in this media-generation task: integrated site playback, native iPhone playback, autoplay behavior and physical mobile-device performance. The main prototype browser QA must verify those applicable integration behaviors. These assets are HD renders of the supplied Vistaire 3D models; they are not professional restaurant live-action footage, 1080p, 4K, or exact copies of Oryzo's proprietary videos.
