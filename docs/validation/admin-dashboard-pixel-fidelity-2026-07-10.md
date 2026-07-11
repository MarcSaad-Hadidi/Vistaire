# Admin dashboard pixel-fidelity ledger — 2026-07-10

## Deterministic protocol

- References: external files in `E:\Projet perso\vistaire-admin-references`; none are committed.
- Desktop viewport: 1672 × 941, DPR 1, `fr-CA`, `America/Toronto`, reduced motion, fonts awaited.
- Mobile release viewports: 390 × 844 and 430 × 932; overflow also checked at 320, 360 and 375 px.
- Mobile reference comparison: source crop `x=139,y=69,w=663,h=1535`, resized to 390 × 903. The versioned comparator applies a 24px rounded-corner exclusion mask for phone hardware and reflections.
- Data: the versioned, read-only PostgREST fixture in `e2e/support/admin-visual-fixture-server.mjs`, self-hosted on loopback by Playwright. No production write and no synthetic production fallback.
- Diff metric: fraction of pixels whose maximum RGB channel delta exceeds 20/255. This is a coarse diagnostic, not Playwright snapshot approval.
- Fresh self-hosted command: `$env:VISTAIRE_ADMIN_VISUAL_FIXTURE='1'; $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3120'; npx playwright test e2e/admin-visual.spec.ts --project=chromium`. Playwright launches both the versioned loopback fixture and a development-mode Next server; no external database or manual server is required.
- The intentional mobile baseline is checked at 1% regression tolerance and per-pixel threshold 0.08. It protects the accepted application render; it does not claim 1% similarity to the source composite.

## Compare/correct ledger

| Screen | Iteration 1 | Repair | Iteration 2 | Status |
| --- | ---: | --- | ---: | --- |
| Overview desktop | 18.77% | Moved the analytics/KPI stack 8 px and restored reference header copy | 18.42% | Geometry improved; release target not met |
| Availability desktop | 11.29% | Moved the main panel 17 px upward and restored reference header copy | 10.85% | Geometry improved; release target not met |
| Insights desktop | 18.85% | Restored reference header copy | 18.97% | Copy is correct; glyph changes raise the unmasked coarse score |
| Overview mobile crop | 26.01% | Removed unsupported period copy; calibrated KPI 79 px, activity 182 px, following panels 160/111 px; restored header copy | 26.27% | Geometry visibly improved; coarse metric is dominated by content/type/photo/hardware pixels |

## Functional defects found during visual QA

- The activity SVG rendered a `<title>` child inside every `<circle>`, producing a repeatable React hydration mismatch. Points are now childless; the chart title, description and exact-value table retain the accessible alternative.
- The Browser-plugin connection returned `No browser is available`; the approved Playwright fallback performed the real Chromium checks.

## Evidence paths (temporary, not tracked)

- Renders: `%TEMP%\vistaire-admin-visual-qa\*.png`
- 50% overlays and pixel diffs: `%TEMP%\vistaire-admin-visual-compare\*.png`

## Remaining fidelity gaps

- The source-reference 1% release target is not met: the masked comparison is a non-pass at `28.75167%`.
- The separate internal Playwright mobile regression baseline is approved at 1% regression tolerance and threshold 0.08; it does not assert source-reference fidelity.
- Real iPhone/Android device behavior and production analytics sufficiency were not tested.

## Structural integration loops after component rewrite

| Screen | Loop | Measured geometry / required repair | Raw diagnostic |
| --- | --- | --- | ---: |
| Overview desktop | 3 | KPI `y=219,h=132`; panels `y=363`; KPI order restored; service donut and five ranked thumbnails added | 19.05% |
| Availability desktop | 3 | Panel/search/first row aligned at `y=215/357/415`; row rhythm changed to 86px; visible/hidden copy restored | 10.88% |
| Insights desktop | 3 | KPI/rows aligned to `y=140/270/539/763`; heatmap collision repaired; 722/416/402 first-row and 392/319/369/450 second-row proportions restored | 16.35% |
| Overview mobile | 3 | Four-KPI order, ranked thumbnails, compressed chart and fixed navigation verified at 390 and 430 | 26.89% |

The raw score increased on overview when the mandatory real dish thumbnails and donut were introduced. Visual overlay inspection confirms that this is photo/content delta rather than a regression in the measured outer geometry. The source references contain different plated-food pixels and reference counts; those pixels are intentionally not copied into production data.

The versioned `scripts/admin-visual-compare.mjs` implements the official mobile crop and a 24px rounded-corner exclusion mask. The fresh masked result is `28.75167%` against the required `1%` reference-fidelity threshold, so this command intentionally exits non-zero and remains an explicit non-pass. It never substitutes for the approved internal regression baseline. Artifacts are written outside Git. The 390×903 Playwright test asserts that the first availability card — image, name, status and 44px link-toggle — is entirely above the fixed navigation. Six unique keyboard focus steps, the targeted results live region, the mobile navigation ARIA snapshot and effective reduced-motion styles on controls/chart elements are checked in Chromium.
