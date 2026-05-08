import Link from "next/link";
import { AdminDishTable } from "@/components/admin/AdminDishTable";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  getAllDishes,
  getCategories,
  getRestaurant
} from "@/lib/demoMenuData";

export default function AdminPage() {
  const restaurant = getRestaurant();
  const categories = getCategories();
  const dishes = getAllDishes();

  const total = dishes.length;
  const available = dishes.filter((d) => d.isAvailable).length;
  const unavailable = total - available;
  const signatures = dishes.filter((d) => d.isSignature).length;
  const with3d = dishes.filter(
    (d) => Boolean(d.model3dUrl?.trim()) || Boolean(d.usdzUrl?.trim())
  ).length;

  return (
    <div className="px-5 pb-24 pt-28 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne/85">
              Espace restaurateur
            </p>
            <h1 className="mt-4 font-display text-4xl text-cream sm:text-5xl">
              {restaurant.name}
            </h1>
            <p className="mt-3 max-w-xl text-[#b9aa94]">{restaurant.tagline}</p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-champagne/30 bg-espresso/80 font-display text-2xl text-cream shadow-champagne">
            {restaurant.logoMonogram}
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <AdminMetricCard label="Plats au total" value={total} />
          <AdminMetricCard label="Disponibles" value={available} />
          <AdminMetricCard label="Indisponibles" value={unavailable} />
          <AdminMetricCard label="Signatures" value={signatures} />
          <AdminMetricCard
            label="Avec modèle 3D"
            value={with3d}
            hint="Fichiers modèle reliés"
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 px-6 text-sm font-semibold text-cream transition hover:border-champagne/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Ajouter un plat
          </button>
          <PrimaryButton href="/demo" className="justify-center sm:w-auto">
            Prévisualiser le menu
          </PrimaryButton>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 px-6 text-sm font-semibold text-[#b9aa94] transition hover:border-champagne/35 hover:text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Retour au site MenuAlive
          </Link>
        </div>

        <section className="mt-14" aria-labelledby="admin-list-heading">
          <h2
            id="admin-list-heading"
            className="font-display text-2xl text-cream"
          >
            Carte en cours
          </h2>
          <p className="mt-2 text-sm text-[#9a8b78]">
            Vue d’ensemble de la carte publiée — mêmes informations que le
            menu client.
          </p>
          <div className="mt-8">
            <AdminDishTable
              dishes={dishes}
              categories={categories}
              currency={restaurant.currency}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
