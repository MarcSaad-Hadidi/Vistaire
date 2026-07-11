# Admin dashboard pixel-fidelity ledger — 2026-07-10

## Deterministic protocol

- References: external files in `E:\Projet perso\vistaire-admin-references`; none are committed.
- Desktop viewport: 1672 × 941, DPR 1, `fr-CA`, `America/Toronto`, reduced motion, fonts awaited.
- Mobile release viewports: 390 × 844 and 430 × 932; overflow also checked at 320, 360 and 375 px.
- Mobile reference comparison: source crop `x=139,y=69,w=663,h=1535`, resized to 390 × 903. Phone hardware and rounded-corner reflections are excluded conceptually; the coarse metric below does not yet implement an alpha corner mask.
- Data: an external, read-only PostgREST fixture server bound to loopback for QA. No production write and no synthetic production fallback.
- Diff metric: fraction of pixels whose maximum RGB channel delta exceeds 20/255. This is a coarse diagnostic, not Playwright snapshot approval.

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

- The 1% release target is not met; no baseline is approved.
- Header wording/actions and detailed insights panel composition differ materially from the references and require product-component work, not further blind CSS offsets.
- The mobile alpha corner/reflection mask is documented but not implemented in the coarse comparison script.
- Real iPhone/Android device behavior and production analytics sufficiency were not tested.
