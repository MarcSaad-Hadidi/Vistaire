# Runtime asset Preview validation

This read-only proof checks the public dish photo, GLB, and USDZ routes without
accepting a signed URL as input or downloading a complete 3D asset. It records
only the discovered Storage host and path; signed `Location` queries are never
stored or printed.

## HTTP proof

The validator derives the three public routes from a Preview base URL, dish ID,
full photo SHA-256, and model asset version. It checks:

- manual `GET`: `307`, an empty body, and a signed `Location` whose host,
  bucket, object path, and token shape match the requested media kind;
- manual `HEAD`: `307` with no body;
- `GET` and `HEAD`: the same Storage object path, without retaining or printing
  the signed query;
- followed `GET` with `Range: bytes=0-0`: final Storage host, media type, CORS,
  and at most one buffered byte;
- direct discovered-Location `GET` with `Range: bytes=0-1023`: `206` and at
  most 1024 bytes when Range is supported;
- wrong asset version: `404`;
- optional known-missing public asset URL: `404`.

If Storage ignores Range and returns `200`, the response stream is cancelled
without buffering and the report emits a warning.

```powershell
npm run runtime:assets:validate -- `
  --base-url https://preview.example `
  --dish-id fd64dc12-8bd2-4669-be63-51cf0d50b839 `
  --asset-version 20260722-3d95d7da `
  --photo-version aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa `
  --expected-storage-host project-ref.supabase.co `
  --missing-asset-url /api/public/menu-dishes/known-missing-id/photo
```

The CLI also accepts the `VISTAIRE_RUNTIME_BASE_URL`,
`VISTAIRE_RUNTIME_DISH_ID`, `VISTAIRE_RUNTIME_ASSET_VERSION`,
`VISTAIRE_RUNTIME_PHOTO_VERSION`,
`VISTAIRE_RUNTIME_STORAGE_HOST`, and
`VISTAIRE_RUNTIME_MISSING_ASSET_URL` environment variables. Run with `--help`
for optional public route overrides and `--json`. Overrides must stay on the
Vistaire origin and must not contain signed-query keys.

The deterministic two-origin fixture proof is:

```powershell
npm run test:runtime-assets:http
```

## Browser proof

Run the targeted spec against a read-only Preview with an existing public menu
and dish. No restaurant or dish is created or modified.

```powershell
$env:PLAYWRIGHT_SKIP_WEB_SERVER = "1"
$env:PLAYWRIGHT_BASE_URL = "https://preview.example"
$env:VISTAIRE_RUNTIME_E2E = "1"
$env:VISTAIRE_RUNTIME_MENU_PATH = "/menu/trouvable?menu=principal&lang=fr-CA"
$env:VISTAIRE_RUNTIME_DISH_PATH = "/menu/trouvable/dishes/existing-dish"
$env:VISTAIRE_RUNTIME_DISH_ID = "existing-public-dish-id"
$env:VISTAIRE_RUNTIME_ASSET_VERSION = "existing-asset-version"
$env:VISTAIRE_RUNTIME_STORAGE_HOST = "project-ref.supabase.co"
npm run test:runtime-assets:e2e
```

The official browser command runs a preflight first and exits non-zero with the
missing variable names unless the read-only Preview flag, external web-server
mode, base URL, dish path/ID, model version, and Storage host are configured.

Chromium and WebKit cover 390px, 430px, and desktop menu/dish views. The spec
checks visible loaded photos, horizontal overflow, console errors, unexpected
404/5xx or failed requests, and absence of GLB/USDZ requests before intent.
After the 3D click it requires the public GLB `307` and a typed CORS response
from the configured Storage host. It verifies the Quick Look public link only;
it is not evidence of real iPhone Quick Look or Android Scene Viewer behavior.
