export function isSameOriginAdminMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-origin" || fetchSite === "none";
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
