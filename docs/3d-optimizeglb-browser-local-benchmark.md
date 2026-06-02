# OptimizeGLB browser-local benchmark slots (Homard / Ravioli)

This file tracks the heavy-asset benchmarks for the OptimizeGLB browser-local
workflow. It is honest by default: a slot is "awaiting candidate" until an
operator actually performs the manual browser-local optimization and uploads
optimized candidate GLBs that pass Vistaire's gates.

See [`docs/3d-optimizeglb-browser-local-workflow.md`](3d-optimizeglb-browser-local-workflow.md)
for the framing and privacy rules, and
[`docs/3d-heavy-asset-pilot.md`](3d-heavy-asset-pilot.md) for the prior rejection record.

## How to fill a benchmark slot

1. Upload the heavy source GLB via the owner dashboard (private staging).
2. Download the source with the audited `Download source GLB` button.
3. Open OptimizeGLB browser-local and optimize manually with the recommended presets.
4. Upload candidate GLBs (web, mobile, arLite, and iosSource when USDZ is needed).
5. Run `npm run 3d:visual-compare` per variant; let the runner mark visual status.
6. Approve the candidate set only when complete and visually passing.
7. Record the numbers below. Do not claim success that did not happen.

## Homard (lobster)

- Prior status: heavy source historically failed Vistaire production gates.
- OptimizeGLB browser-local status: **awaiting candidate upload**.
- Web candidate: _awaiting_ (budget fail/pass: _n/a_).
- Mobile candidate: _awaiting_.
- AR-lite candidate: _awaiting_ (triangles: _n/a_, required extensions: _n/a_).
- iOS source -> USDZ: _awaiting_ (USDZ bytes vs 5 MiB hard fail: _n/a_).
- Visual compare (source vs candidate): _not run_.
- Candidate set: _not assembled_.
- Verdict: not production-ready until the steps above are completed and pass.

## Ravioli (76 MB reference)

- Prior status: 76 MB source rejected; see `docs/3d-heavy-asset-pilot.md`.
- OptimizeGLB browser-local status: **awaiting candidate upload**.
- Web candidate: _awaiting_.
- Mobile candidate: _awaiting_.
- AR-lite candidate: _awaiting_.
- iOS source -> USDZ: _awaiting_.
- Visual compare (source vs candidate): _not run_.
- Candidate set: _not assembled_.
- Verdict: not production-ready until the steps above are completed and pass.

## Comparison to prior failure

The earlier pipeline rejected these assets because automated local optimization
could not reach the budgets while keeping the model visually indistinguishable
under strict thresholds. This workflow does not change Vistaire's gates; it only
adds a manual browser-local optimization handoff. If OptimizeGLB browser-local
cannot reach the budgets either, Vistaire will still reject the candidate, and
the retry brief will state the exact numeric gap and the preset to try next.
