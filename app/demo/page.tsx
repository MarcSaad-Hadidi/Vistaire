import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { DemoMenuClient } from "@/components/menu/DemoMenuClient";
import { MenuHero } from "@/components/menu/MenuHero";
import {
  getAllDishes,
  getCategories,
  getRestaurant
} from "@/lib/demoMenuData";
import { buildBreadcrumbJsonLd } from "@/lib/seo";

function PresentationPathway() {
  return (
    <section
      className="my-5 rounded-lg border border-white/10 bg-[#0b0806]/88 px-4 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.22)] sm:my-6 sm:px-5"
      aria-labelledby="presentation-pathway-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            id="presentation-pathway-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.22em] text-champagne/80"
          >
            Parcours de présentation
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b9aa94]">
            Maison Élyse est un restaurant exemple de présentation : il montre
            le menu client Vistaire et l’aperçu restaurateur associé.
          </p>
        </div>
        <div className="flex flex-col gap-2 min-[420px]:flex-row sm:shrink-0">
          <Link
            href="/demo"
            aria-current="page"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-champagne/40 bg-champagne/10 px-4 text-sm font-semibold text-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Menu client
          </Link>
          <Link
            href="/admin"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/14 px-4 text-sm font-semibold text-cream transition hover:border-champagne/35 hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Aperçu restaurateur
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function DemoPage() {
  const restaurant = getRestaurant();
  const categories = getCategories();
  const dishes = getAllDishes();

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Menu client exemple", path: "/demo" }
        ])}
      />
      <MenuHero restaurant={restaurant} />
      <PresentationPathway />
      <DemoMenuClient
        categories={categories}
        dishes={dishes}
        currency={restaurant.currency}
      />
    </>
  );
}
