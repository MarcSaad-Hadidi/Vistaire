import { absoluteUrl } from "@/lib/seo";
import type { Locale } from "@/lib/i18n";
import {
  buildPublicMenuPath,
  buildQrRedirectPath,
  buildRestaurantMenuPath
} from "@/lib/owner/menuUrlCore";

export {
  buildPublicMenuPath,
  buildQrRedirectPath,
  buildRestaurantDashboardPath,
  buildRestaurantMenuPath,
  slugifyRestaurantSlug
} from "@/lib/owner/menuUrlCore";

type SiteUrlEnv = {
  [key: string]: string | undefined;
};

export function buildRestaurantMenuUrl(
  slugOrName: string,
  env?: SiteUrlEnv
): string {
  return absoluteUrl(buildRestaurantMenuPath(slugOrName), env);
}

export function buildPublicMenuUrl(
  slugOrName: string,
  params?: { lang?: Locale | string; table?: string; zone?: string },
  env?: SiteUrlEnv
): string {
  return absoluteUrl(buildPublicMenuPath(slugOrName, params), env);
}

export function buildQrRedirectUrl(token: string, env?: SiteUrlEnv): string {
  return absoluteUrl(buildQrRedirectPath(token), env);
}
