import { absoluteUrl } from "../../../lib/seo.ts";

// Only reached when no real API route matches, so agents get JSON instead of the HTML 404 page.
function notFound() {
  return Response.json(
    {
      ok: false,
      error: "API route not found.",
      code: "not_found",
      hint: `See ${absoluteUrl("/openapi.json")} for the public API.`
    },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
