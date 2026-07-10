import type { AdminMenuCategory, AdminMenuDish } from "./menuReadiness.ts";

type DemoEvent = Record<string, unknown>;

export const MAISON_ELYSEE_DEMO_ID = "11111111-1111-1111-1111-111111111111";

export function buildMaisonElyseeDemoEvents(input: {
  dishes: AdminMenuDish[];
  categories: AdminMenuCategory[];
  endExclusive: string;
}): DemoEvent[] {
  const dishes = input.dishes.length ? input.dishes : [{ slug: "plat-signature", categorySlug: "signatures" } as AdminMenuDish];
  const categoryFallback = input.categories[0]?.slug ?? "signatures";
  const end = new Date(input.endExclusive).getTime();
  const events: DemoEvent[] = [];

  for (let session = 0; session < 56; session += 1) {
    const dayOffset = session % 7;
    const createdAt = new Date(end - (dayOffset + 1) * 86_400_000 + (session % 8) * 900_000).toISOString();
    const sessionId = `maison-elysee-demo-${session + 1}`;
    const dish = dishes[session % dishes.length];
    events.push({ id: `menu-${session}`, event_name: "menu_opened", session_id: sessionId, created_at: createdAt });
    events.push({ id: `dish-${session}`, event_name: "dish_opened", session_id: sessionId, created_at: createdAt, dish_slug: dish.slug, category_slug: dish.categorySlug ?? categoryFallback });
    if (session % 4 === 0) events.push({ id: `search-${session}`, event_name: "search_used", session_id: sessionId, created_at: createdAt, search_query: session % 8 === 0 ? "homard" : "dessert" });
    if (session % 5 === 0) events.push({ id: `immersive-${session}`, event_name: "dish_3d_clicked", session_id: sessionId, created_at: createdAt, dish_slug: dish.slug });
  }

  return events;
}
