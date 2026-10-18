# Immersive public presentation

The French and English home routes render `components/immersive/ImmersiveLanding.tsx`, carrying the published immersive scene into the existing Next application. Source and third-party asset records are preserved in the accompanying provenance JSON files and notices. CSS stays scoped to `[data-immersive-vistaire]` and `[data-public-vistaire]`; Next navigation releases viewport listeners and queued work.

The phone presentation holds for 1.5 additional viewport heights. Original renderer quality, materials and native model files are retained. Lamp and glass decorations are removed, as requested, and the place setting is checked against animated product bounds. Both home locales use the complete shared public footer.

Public information pages share the black/gold design. Production contact submission, pricing estimation, restaurant data links, owner/admin pages and APIs retain their existing implementations. This PR does not supply new backend connections.

## Previous public UI archive

`docs/archives/vistaire-ui-before-immersive-2026-10-09.tar.gz` preserves the prior public UI files from base commit `cd91ec7556c9d6dcafe6d2d44b27f571abd1e0be`. Its SHA-256 is `37e5eb0cd7042897a721a9e2cab5674085c5b837961155f19a06cbf12a74b5dd`. Inspect or extract into a separate directory; do not unpack over a working checkout.

## Runtime asset preparation

`npm ci` and `npm run build` prepare the losslessly compressed burger USDZ. All original runtime inputs and the restored USDZ have individual size and checksum pins in `docs/immersive-asset-exceptions.json`. No Git LFS runtime dependency is introduced.

## Verification scope

Repository lint, type checks, build, asset/LFS policy, public route contracts, scroll tests and representative Chromium WebGL checks cover this integration. Physical iOS/Android AR sessions and hardware frame rates require device verification.
