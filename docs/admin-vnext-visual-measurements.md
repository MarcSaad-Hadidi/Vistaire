# Admin vNext — visual measurement spec

This is the implementation baseline for PR #206. The five supplied PNG files are
the visual source of truth; the archive is used only to confirm shared values.

## Reference frame

- Raster size: 1448 × 1086 px for every supplied reference.
- Desktop sidebar: 182 px wide plus a 1 px divider; it is fixed to the left edge.
- Main content begins at x ≈ 223–228 px and ends at x ≈ 1405–1410 px.
- Main horizontal padding: 39–45 px from the sidebar divider, 38–43 px at right.
- Header identity baseline: y ≈ 20–24 px; page title baseline: y ≈ 68–78 px.
- Shared card border: 1 px; shared radius: 9–12 px; no heavy drop shadow.
- Desktop content gaps: 10–14 px between cards, 14–18 px between sections.

## Shared tokens sampled from the references

- Canvas: `#fbfaf7`.
- Sidebar and primary surface: `#fffdf9` / `#ffffff`.
- Secondary surface: `#fcfbf8`.
- Border: `#e9e3d9`; strong divider: `#ddd5c8`.
- Ink: `#22201c`; muted ink: `#777168`.
- Champagne/gold: `#b97818` for controls, `#c89343` for accents.
- Success: `#2f8c46`; danger: `#d52d2d`; informational blue: `#3f5e9e`;
  discovery purple: `#7c6ba8`.
- Display face: local BT Suave, 400. Functional face: local Neue Montreal,
  400/700. No remote font request is allowed.

## Shared geometry

- Brand block: 28 px left inset, approximately 26 px from the top; wordmark is
  25–28 px with wide tracking.
- Primary nav: approximately 92 px below the wordmark; rows are 51–55 px high,
  12 px from the left and right edges. Active state has a 3 px gold leading rule.
- Restaurant block: anchored near the bottom with a top divider and about 24 px
  internal padding.
- Desktop main grid is constrained by the available width after the 183 px rail;
  cards must not introduce horizontal page scrolling.
- Mobile breakpoints retain the existing bottom navigation. Required QA widths:
  390, 430, and 768 px; reference desktop checks: 1280 and 1448 × 1086 px.

## Page grids at 1448 × 1086

- Today: briefing 3 columns; six KPI cards; main row ≈ 1.42 / 0.68 / 1.00;
  lower row four columns.
- Availability: five summary cards; body ≈ `1fr / 248px`; table/list row height
  ≈ 56 px, with a single expanded scheduling row.
- Intelligence: three essential cards; analytics body has four columns; lower
  row proportions ≈ 1.80 / 0.72 / 0.86 / 145px.
- Reports: four highlights, five KPI cards; primary grid ≈ 1.42 / 1.38 / 1.70,
  secondary grid ≈ 1.28 / 1.88, lower row ≈ 1.26 / 1.22 / 1.28.
- Quality/More: 3 × 2 readiness cards plus restaurant rail; three evidence
  panels; three lower panels; one full-width help strip.

## Pre-redesign baseline evidence

The deterministic Admin fixture was captured before changing the shared shell:

- `.playwright-mcp/admin-vnext-baseline/today-1448x1086.png`
- `.playwright-mcp/admin-vnext-baseline/availability-1448x1086.png`
- `.playwright-mcp/admin-vnext-baseline/insights-1448x1086.png`
- `.playwright-mcp/admin-vnext-baseline/reports-1448x1086.png`
- `.playwright-mcp/admin-vnext-baseline/more-1448x1086.png`

These files are local QA artifacts and must not be committed.
