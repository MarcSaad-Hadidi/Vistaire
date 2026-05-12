/**
 * Browser handoff is intentionally non-operative here.
 *
 * A web page cannot reliably force iOS Safari, Android Chrome, or another
 * system browser to open from every incompatible browser. AR fallbacks should
 * use explicit copy/share/continue-in-3D actions instead of pretending that a
 * new tab is a compatible-browser handoff.
 */
export function openSystemBrowserHandoffForAr(): false {
  return false;
}
