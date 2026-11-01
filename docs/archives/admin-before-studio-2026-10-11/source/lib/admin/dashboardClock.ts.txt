export function resolveAdminDashboardNow(nodeEnv: string | undefined, visualNow: string | undefined, fallback: Date): Date {
  if (nodeEnv === "production" || !visualNow) return fallback;
  const parsed = new Date(visualNow);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
