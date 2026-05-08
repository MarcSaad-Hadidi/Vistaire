import type { Category, CurrencyCode, Dish } from "@/lib/demoMenuData";
import { formatPrice } from "@/lib/formatPrice";

type AdminDishTableProps = {
  dishes: Dish[];
  categories: Category[];
  currency: CurrencyCode;
};

export function AdminDishTable({
  dishes,
  categories,
  currency
}: AdminDishTableProps) {
  const categoryName = (slug: string) =>
    categories.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/12 bg-[#0a0806]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-black/40 text-xs uppercase tracking-[0.15em] text-[#b9aa94]">
            <th scope="col" className="px-4 py-4 font-semibold">
              Plat
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Catégorie
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Prix
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Dispo.
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Photo
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              3D
            </th>
            <th scope="col" className="px-4 py-4 font-semibold">
              Signature
            </th>
            <th scope="col" className="px-4 py-4 text-right font-semibold">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {dishes.map((dish) => {
            const hasPhoto = Boolean(dish.image);
            const has3d =
              Boolean(dish.model3dUrl?.trim()) || Boolean(dish.usdzUrl?.trim());

            return (
              <tr
                key={dish.id}
                className="border-b border-white/[0.06] text-[#d1c2aa] last:border-0"
              >
                <td className="px-4 py-3.5 font-medium text-cream">{dish.name}</td>
                <td className="px-4 py-3.5">{categoryName(dish.categorySlug)}</td>
                <td className="px-4 py-3.5 tabular-nums text-champagne/95">
                  {formatPrice(dish.price, currency)}
                </td>
                <td className="px-4 py-3.5">
                  {dish.isAvailable ? (
                    <span className="rounded-md bg-emerald-950/50 px-2 py-1 text-xs font-medium text-emerald-200/95">
                      Oui
                    </span>
                  ) : (
                    <span className="rounded-md bg-red-950/40 px-2 py-1 text-xs font-medium text-red-200/90">
                      Non
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {hasPhoto ? (
                    <span className="text-emerald-200/90">Publ.</span>
                  ) : (
                    <span className="text-amber-200/85">À fournir</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {has3d ? (
                    <span className="text-emerald-200/90">Prêt</span>
                  ) : (
                    <span className="text-[#8a7b68]">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  {dish.isSignature ? (
                    <span className="rounded-full border border-champagne/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-champagne">
                      Signature
                    </span>
                  ) : (
                    <span className="text-white/25">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <button
                    type="button"
                    className="rounded-full border border-white/14 px-3 py-1.5 text-xs font-semibold text-cream transition hover:border-champagne/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-white/10 px-4 py-3 text-center text-xs text-[#7a6c5c]">
        Aperçu lecture seule — les actions sont simulées pour la démonstration.
      </p>
    </div>
  );
}
