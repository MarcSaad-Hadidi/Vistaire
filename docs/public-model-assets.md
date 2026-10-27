# Public model distribution

## Migration status

The public model migration is **incomplete**. The lightweight manifest at
`lib/publicModelAssets.json` inventories 72 existing public GLB/USDZ candidates
and the CDN-only Digital presentation. The 72 existing records retain their
local URLs and exact content identities. Digital uses the verified public URL
documented below. No model binary, asset exception, build hook, or source file
has been removed.

One additive object was uploaded on 10 October 2026:

- Source: `public/models/demo/maison-elyse-n1.glb`
- Public URL: `https://3d.vistaire.ca/marketing/immersive/20261010-pr296-29ab245b-58a1c7d4/demo/maison-elyse-n1-7f12cd7bc6f47ec97f6cef3b65c453bbef537aa7c095289899c51782e48eebef.glb`
- Size: 86,380 bytes
- SHA-256: `7f12cd7bc6f47ec97f6cef3b65c453bbef537aa7c095289899c51782e48eebef`

Its full public response matched the source bytes and checksum. GET and HEAD
returned 200, the MIME was `model/gltf-binary`, and the tested byte range returned
206. These observations preceded the subsequent CORS configuration change.
The earlier response allowed the production origin but not the tested preview
origin. Post-change HTTP and browser CORS behavior has not yet been verified, so
this object remains inactive in the application. The other 71 existing candidates have
not been uploaded in this migration.

## Manifest and resolver

`lib/publicModelAssets.ts` provides one lookup for stable IDs, exact legacy paths,
and activated public URLs. Unknown references, including private API routes and
signed URLs, pass through unchanged. This distribution manifest is independent
of the business-storage `R2_STORAGE_ENABLED` flag and contains no credentials.

Each entry records:

- `id`: stable identity independent of hosting and content version
- `kind`, `format`, `visibility`: asset classification and public-only scope
- `bytes`, `sha256`, `version`: exact runtime content identity
- `legacyUrl`: existing public URL and local fallback during migration; absent
  for a new CDN-only presentation with no historical local URL
- `publicUrl`: verified CDN URL, or `null` until activation gates pass
- `variants`: related mobile/iOS asset IDs where applicable

The root `sourceCommit` records the audited Git source for rollback. Burger's
legacy URL represents the uncompressed USDZ restored from
`assets/immersive-runtime/burger.usdz.gz`; its manifest checksum and byte count
refer to the uncompressed runtime file.

The landing's five GLB loaders use this resolver and derive the GLTF parser base
from the resolved URL. Existing abort handling, caches, load timing, Draco and
Meshopt decoding, material handling, transforms, and disposal are retained.
The eight existing hull records are indexed by matching source hash and byte
count to stable IDs. Their geometry is unchanged; this repairs the diagnostic
`dishBounds`/`subjectBounds` lookup, not camera or zoom behavior.

The shared 3D URL validator recognizes only exact activated manifest URLs in
addition to its existing explicit origin allowlist. It does not generally allow
all objects on the CDN. Next.js generates a finite 307 redirect for each activated
legacy URL, with no binary proxy. CDN-only entries create no legacy redirect.

## Digital presentation (27 October 2026)

- ID: `immersive.presentation.digital`
- URL: `https://3d.vistaire.ca/marketing/immersive/20261027-digital/sauge-noire-menu-fe0d2f932d2efafe3b2d305dbd66539839cac35ea19591f81098478217daac59.glb`
- Size: 451,824 bytes
- SHA-256: `fe0d2f932d2efafe3b2d305dbd66539839cac35ea19591f81098478217daac59`
- Original remains outside Git at `D:/Perso/SupportQrCode/Sauge_Noire_Menu_corrige (1).glb`.

The publication owner verified full GET readback and checksum, GET/HEAD 200,
`model/gltf-binary`, exact length, Range 206 and missing-object 404. ETag and
Last-Modified are present; no Cache-Control header was observed, so this record
does not claim an immutable caching header. Chromium fetches from the www and
apex production origins, `http://localhost:3000`, and the Vercel branch-pattern
origin returned 200 and the same complete byte count and SHA-256. The actual
generated preview origin is checked during integration after deployment.
`http://127.0.0.1:3000` remains outside the existing CORS policy; local QA uses
`localhost`. No global CORS policy was changed.

This is an illustrative open Sauge Noire book, not an included physical product
or an AR handoff. It has no fictitious local URL or redirect. Its existing Draco
geometry and embedded WebP materials remain unchanged; the scene rotates it
before uniform width normalization and grounding. A local load failure uses the
shared lightweight marketing photograph without disabling navigation or scroll.

## Activation and removal gates

For each asset, in order:

1. Match the intended public source, bytes and SHA-256 to its manifest record.
   Use a new immutable key; do not overwrite a restaurant object or infer that
   similarly named objects have identical bytes or publication rights.
2. Upload the exact source bytes and record the immutable key and complete
   readback checksum. ETag alone is not SHA-256.
3. Verify public GET/HEAD, MIME, length, cache behavior, partial-content behavior,
   and relevant missing-object behavior. Verify CORS from the required production,
   localhost and exact preview origins, including a real browser fetch after the
   final configuration change.
4. Set only that verified entry's `publicUrl`. Re-run the focused manifest and
   loader tests, repository checks, build, and relevant browser/network tests.
   Modern consumers must fetch the CDN URL directly; legacy redirects must work.
5. Before any local removal, migrate and verify every remaining runtime and
   offline consumer, preserve a source-commit rollback record, and obtain any
   required approval. Remove only individually verified migrated files.

Never activate a guessed URL or remove a binary because an upload request merely
reported success. Physical iPhone Quick Look and Android AR validation remain
separate checks and have not been established by the checksum or HTTP tests.

## Offline tooling and retained files

The demo data keeps its authored local reference literals so existing offline
parsers remain intact; returned runtime data is resolved through the manifest.
The demo asset, AR-lite, iOS budget and network validators still need a deliberate
CDN/offline-source transition before local binaries can be removed. They must
continue checking actual bytes and source identity rather than skipping missing
files. Offline conversion tools that support `VISTAIRE_MESHY_ASSET_ROOT` can use
an explicitly prepared, hash-verified external workspace. Normal install/build
must not gain automatic model downloads.

Burger's existing `postinstall`/`prebuild` preparation, compressed source and exact
exceptions remain necessary until its uncompressed remote USDZ is verified and
activated. Remove only that obsolete mechanism once its complete gate passes;
preserve unrelated installation/build behavior.

Excluded from this manifest and migration:

- Private source trees `3D Plat/` and `3D photo/`
- Historical source-only `public/models/demo/homard-bisque.usdz`, which existing
  owner tooling explicitly prohibits uploading
- Private/signed restaurant assets and production business metadata

Keep the local Draco/Meshopt technical decoders, licenses, attribution and asset
provenance. Their presence is independent of where public models are hosted.
No production database backfill, storage-backend switch, Git history rewrite or
remote object deletion is part of this resolver change.

## Rollback

Restore an affected manifest entry's `publicUrl` to `null` only while its original
local asset is available. After a verified local removal, first restore the exact
source from the manifest's source commit in a clean workspace and verify its
checksum, then selectively restore the required asset and resolver change.
Do not overwrite unrelated work or delete R2 objects during rollback.
