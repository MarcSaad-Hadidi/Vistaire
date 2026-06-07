# Menu UI Builder

The owner Menu Builder at `/owner/menu-builder` edits presentation settings for an
existing restaurant menu. It does not author production dishes directly: dishes
come from the owner restaurant/menu data path, while the quick text import stays
local to the browser as a draft preview tool.

## Data Flow

- `/api/owner/menu-data?restaurantId=...` is read-only and owner-gated. It loads
  the selected restaurant and its dishes server-side, then returns the public menu
  shape used by the renderer.
- `/api/owner/menu-ui-config` is owner-gated. `GET` returns the current draft,
  published, or default config. `POST` saves a draft unless `action: "publish"`
  is sent, in which case it creates a published snapshot for the public menu.
- `/menu/[slug]` loads the public menu and only the published UI config. Drafts
  are never read by public visitors.
- `components/menu/PublicMenuRenderer.tsx` is the shared surface for both the
  builder preview and `/menu/[slug]`, so owner preview and public rendering stay
  aligned.

## Supabase Schema

Apply `supabase/migrations/0008_menu_ui_configs.sql` before enabling persistent
builder saves in a real environment. The `menu_ui_configs` table stores one draft
and one published snapshot per restaurant with partial unique indexes.

The table is locked down for server-side access:

- RLS is enabled.
- `anon` and `authenticated` grants are revoked.
- `service_role` is granted table access.

This follows the existing owner API pattern: browser requests authenticate through
owner routes, and only server code uses the service role client.

## Media Rules

Dish photos, 3D, and AR badges are derived from real dish fields only. The builder
does not invent media from dish names or categories.

The shared renderer can show photo placeholders, photo states, and 3D/AR intent
buttons, but it does not import `model-viewer` and does not auto-load heavy 3D or
AR assets. Dedicated 3D/AR routes remain responsible for loading model files after
user intent.

## QR Generation

The builder reuses `/api/owner/qr-codes` with:

- `targetKind: "menu"`
- `targetPath: selectedRestaurant.publicMenuPath`

It must not generate owner/admin QR targets and must not use absolute public URLs
as the QR target path.

