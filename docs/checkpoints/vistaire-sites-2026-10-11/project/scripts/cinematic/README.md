# Vistaire cinematic media

These are original moving-camera renders of Vistaire's actual 3D dishes, inside the user's exact optimized Restaurant in the evening GLB, with its original white-cloth table, chair and accessories at the window-side tables beneath the painting. They are not AI footage of invented dishes and do not copy the Oryzo media. Each loop is 8 seconds at 24 fps, silent H.264 High Profile, CRF 18, YUV 4:2:0, with streaming-friendly MP4 metadata at the beginning. The 3D source is rendered at 8 fps; optical motion interpolation creates the intermediate output frames. Two additional periodic camera samples supply the interpolator's look-ahead before the output is cut to exactly 8 seconds.

Requirements: the project's npm dependencies, a Chromium build with WebGL 2, Playwright, and `ffmpeg` with libx264/libwebp. The existing `npm run assets:prepare` must be completed first. The user-provided restaurant GLB, local Draco decoder are retained in the Site source.

From the prototype directory:

```bash
CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/cinematic/render.mjs
```

Playwright uses the local `@playwright/test` dependency. Work Mode can instead supply the installed runtime dependencies through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. If Sharp is not installed in that runtime, the generator writes the same expected WebP poster through ffmpeg.

`--format=landscape` or `--format=portrait` renders one format. `--sample` creates four diagnostic PNG frames in a new system temporary directory and prints that directory. Sample frames are not included in the site assets.

Outputs:

| Output | Native raster | Scene |
| --- | --- | --- |
| `public/media/cinematic-landscape.mp4` | 1280 × 720 | Homard bleu, tabletop orbit |
| `public/media/cinematic-portrait.mp4` | 720 × 1280 | Soufflé au chocolat, tabletop orbit |
| `public/assets/cinematic-landscape.webp` | 1280 × 720 | Exact first frame of the landscape render |
| `public/assets/cinematic-portrait.webp` | 720 × 1280 | Exact first frame of the portrait render |

The camera and focal target follow smooth periodic functions. Source-frame time comes from the frame index, not the renderer's real-time frame rate. The 8-second endpoint is mathematically identical to the 0-second pose; the last encoded output frame occurs at 7.9583 seconds as expected for a seamless 24 fps loop. Native resolution means the imagery is rendered at the listed size without upscaling. Rendering uses the true mesh, PBR textures, scene lights, an environment map, shadows, and a vignette pass. The real architectural set and camera follow a slow periodic parallax, which limits optical interpolation artifacts; diagnostic inspection still matters around high-contrast plate edges and thin tableware.

The two compact, generated MP4 loops are explicitly retained in the Site source through `.gitignore` exceptions. Other Vistaire source media remain downloaded/checksummed rather than committed. The loops can be regenerated on any compatible machine with the command above. `cinematic-provenance.json` records the actual outputs and inspected metadata after generation.
