import { parseAdminDashboardRange, type AdminDashboardRange } from "./dashboardRange.ts";

type AdminPageSearchParams = Pick<{ range?: string | string[] }, "range">;

export function parseAdminPageSearchParams(input: AdminPageSearchParams | undefined): AdminDashboardRange {
  return parseAdminDashboardRange(input?.range);
}
