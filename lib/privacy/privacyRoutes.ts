const PRIVACY_UI_EXCLUDED_ROUTE_ROOTS = ["/admin", "/owner", "/todos"] as const;

export function shouldShowPrivacyControls(pathname: string | null): boolean {
  if (!pathname) return false;

  return !PRIVACY_UI_EXCLUDED_ROUTE_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`)
  );
}
