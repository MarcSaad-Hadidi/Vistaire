# Design QA — Trouvable back to top

- Source visual truth: `C:\Users\hadid\AppData\Local\Temp\codex-clipboard-a1959130-697c-4e19-90e2-ee0952b99d06.png`
- Dark implementation screenshot: `C:\Users\hadid\AppData\Local\Temp\menualive-trouvable-back-to-top-430.png`
- Light implementation screenshot: `C:\Users\hadid\AppData\Local\Temp\menualive-trouvable-back-to-top-light-430.png`
- Viewport: 430×932 CSS px, in-app browser, real Supabase Trouvable menu.
- State: menu scrolled with the fixed control visible; both dark and light themes checked.

## Findings

- The control is centered as a compact pill with a dark/cream surface, gold border, upward arrow, and localized `Retour en haut` label.
- Dark computed state: 188×46px, `#040404` surface, `#f0d800` border/text.
- Light computed state: 188×46px, `#fff9ef` surface, `#8f6d14` border/text.
- No P0–P2 visual findings; no horizontal overflow observed at 390px or 430px.

## Comparison history

- Initial implementation was a circular right-aligned control.
- Follow-up changed it to the reference pill, then reduced the dimensions after review feedback that it was too large.
- Final pass verified both theme variants in the browser.

final result: passed
