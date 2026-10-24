# Vistaire public presentation pages

`PublicPageRouter.jsx` handles the public French and English route pairs declared
in the original Vistaire repository. `/` and `/en` use the same optimized immersive experience in French and English. `publicPagePaths` is the list
used for route validation. Unknown routes render a real not-found page.

The TSX/CSS files in `source/` are a focused port of the original
`components/vistaire-preview`, public landing, editorial guides, SEO presentation
and public restaurateur preview. Local relative imports replace the Next aliases.
The four native helpers adapt only anchors, image fill props, lazy React
components and embedded structured data. No Next runtime, Supabase client or
authentication dependency is included.

The page geometry and verified French/English text remain from Vistaire. The
palette uses black/charcoal and gold, with an ivory marketing light theme, using the already licensed local
Vistaire Editorial and Vistaire Text faces. `public-pages.css` covers the small
components that originally depended on Tailwind utilities.

The restaurant preview uses Vistaire's original fictional fixture and original
interactive charts, filters and local availability state. Its disclosure remains
visible. None of these changes are saved to a real restaurant.

Contact booking validates fields and prepares a `mailto:` draft for the user to
open. It also links to the official form. It never makes a production API request
or says an email was sent. Restaurant menus, dish details and private routes
remain on `https://www.vistaire.ca` with their original experiences.

The isolated menu comparison uses the seven dishes already verified in the
immersive prototype, their matching images, prices and official menu links.
It clearly labels this as a selected-dish preview rather than a live complete
menu. The three restaurant walkthroughs use the actual existing films at 2×,
with persistent matching posters and visibility-based playback.

`media.js` resolves reused assets. No raw images, GLBs or videos are duplicated
in this source tree. Original font faces pointing to unavailable Next assets
are removed in favor of the existing four local fonts.

All 52 public routes reuse `PublicSiteNavigation` / `PublicNavigation`, including the immersive landing. The theme is restored in the document head before painting and inherited by public marketing surfaces. Landing scene overlays are removed in light mode without a white wash; its copy retains photographic contrast. The actual Studio preview uses its PR palette and the shared theme.
