# OptimizeGLB browser-local heavy-asset workflow

> **Framing — read first.**
> This workflow does not automate OptimizeGLB. It creates a browser-local handoff workflow.
>
> Vistaire will not call the OptimizeGLB API, will not upload source files to OptimizeGLB cloud, and will not claim automatic optimization success.
>
> The owner/operator manually uses OptimizeGLB in browser-local mode, then uploads optimized candidate GLBs back into Vistaire. Vistaire then validates those candidates with its own production gates.
>
> **A successful OptimizeGLB download is not a successful Vistaire asset. It becomes a candidate only.**

## Why browser-local and not the API

The OptimizeGLB cloud API (`POST /api/compress`) is gated/beta/business-only and requires an account and credits. Vistaire deliberately does **not** integrate it:

- no `OPTIMIZEGLB_API_KEY` code path;
- no `POST /api/compress` call;
- no cloud upload of source assets;
- no external signed URL handed to OptimizeGLB;
- no iframe, prefetch, or preconnect to `optimizeglb.com`;
- no automatic request to `optimizeglb.com` when a Vistaire page loads.

The only contact with `optimizeglb.com` is an **explicit operator click** that opens it in a new browser tab. OptimizeGLB's free mode runs in the operator's own browser. Vistaire does not control OptimizeGLB; Vistaire controls only its own download, upload, and validation workflow.

## What "same visual" means here

Vistaire never promises pixel-perfect or "exact same visual" output. The only equivalence claim allowed is:

> visually indistinguishable under deterministic multi-angle mobile dining-distance review within strict thresholds.

The phrases "automatically production-ready", "OptimizeGLB validated", "AR ready", "iPhone ready", "Android ready", and "CDN ready" must never be used unless the corresponding evidence (visual report, device QA, CDN validation) actually exists.

## Privacy copy (exact)

The dashboard surfaces this copy verbatim:

> Vistaire does not send your source to OptimizeGLB or any external optimization API. You download the source and control any manual browser-local optimization step yourself. When you upload an optimized GLB back into Vistaire, Vistaire validates it with its own production gates.

## Operator workflow

1. **Source** — Vistaire shows the staged source upload, its bytes and triangle count, and a protected `Download source GLB` button. Each download writes an audit event.
2. **Open OptimizeGLB** — a separate `Open OptimizeGLB` button opens `https://optimizeglb.com` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). The link carries no source URL, token, or private metadata. Recommended presets are shown.
3. **Optimize locally** — the operator optimizes in their browser and downloads the optimized GLB(s) from OptimizeGLB.
4. **Upload candidate(s)** — the operator uploads each optimized GLB back into Vistaire as a candidate, choosing its `variantRole` (web / mobile / arLite / iosSource / posterSource) and `presetLabel`.
5. **Validate** — Vistaire verifies SHA, bytes, GLB structure, external URIs, required extensions, and source binding, then runs budgets and (on request) visual compare.
6. **Candidate set** — the operator assembles a complete set (web + mobile + arLite, plus iosSource when required). Approval applies to the **set**, not an isolated file.
7. **Review** — source and candidate 3D viewers (explicit load), before/after/diff imagery, and metrics support approve/reject of the set.
8. **Continue production** — USDZ generation/validation, CDN validation, iPhone/Android device QA, finalize, and publish — all gated, none bypassed.

## Recommended OptimizeGLB presets

These map to OptimizeGLB browser-local advanced options. They are guidance for the operator, not automated calls.

| Preset label | Texture format | Texture size | Simplify | Intended role |
| --- | --- | --- | --- | --- |
| `optimizeglb-web-quality` | webp | 2048 | light (~0.9) | web |
| `optimizeglb-mobile-balanced` | webp | 1024 | medium (~0.55) | mobile |
| `optimizeglb-ar-lite-aggressive` | jpeg/webp | 512–1024 | strong (~0.35) | arLite |
| `optimizeglb-ar-lite-emergency` | jpeg | 512 | strongest acceptable (~0.2) | arLite |
| `optimizeglb-ios-source` | jpeg/webp | 512–1024 | strong, **no required extensions** | iosSource |

Draco is not recommended for arLite/iOS candidates because Android Scene Viewer and iOS Quick Look paths are stricter about required extensions.

## What Vistaire still owns (and OptimizeGLB never does)

Source upload, secure source download, owner workflow, re-upload of optimized candidates, SHA/bytes validation, GLB structure validation, budgets, AR-lite constraints, USDZ generation/validation, visual compare (before/after/diff), human approval, CDN validation, iPhone Quick Look QA, Android Scene Viewer QA, finalize/publish/rollback. None of these are automated away by an OptimizeGLB download.

## Honesty rules for any report referencing this workflow

- If no optimized candidates were uploaded, the benchmark is awaiting candidates — say so.
- If Homard/Ravioli still fail Vistaire gates, say so.
- If browser-local OptimizeGLB was not actually used manually, say so.
- If visual compare did not run, say so.
- If device QA / CDN validation was not done, say so.
- If any part is fallback/dev-only, say so.
