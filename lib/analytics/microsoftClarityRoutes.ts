const MICROSOFT_CLARITY_EXCLUDED_ROUTE_ROOTS = [
  "/admin",
  "/owner",
  "/todos",
  "/sign-in"
] as const;

export function shouldLoadMicrosoftClarity(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  return !MICROSOFT_CLARITY_EXCLUDED_ROUTE_ROOTS.some(
    (routeRoot) => pathname === routeRoot || pathname.startsWith(`${routeRoot}/`)
  );
}

export function shouldStopMicrosoftClarityBeforeNavigation(
  currentPathname: string | null,
  targetPathname: string | null
): boolean {
  return (
    shouldLoadMicrosoftClarity(currentPathname) &&
    !shouldLoadMicrosoftClarity(targetPathname)
  );
}

export function shouldReloadForMicrosoftClarityBoundary(
  initialPathname: string | null,
  currentPathname: string | null
): boolean {
  return (
    shouldLoadMicrosoftClarity(initialPathname) !==
    shouldLoadMicrosoftClarity(currentPathname)
  );
}
