import Link from "next/link";
import { SEO_PAGES } from "@/lib/seoPages";

const pricingGuide = {
  path: "/tarifs-menu-digital-restaurant",
  eyebrow: "Tarifs",
  title: "Tarifs menu digital restaurant avec plats 3D inclus",
  description:
    "Forfaits Base, Premium et Signature, packs 3D supplémentaires, QR code et service clé en main."
} as const;

export function GuidesVistaireSection() {
  return (
    <section
      id="guides"
      className="relative border-t border-white/10 bg-[#070504] px-5 py-20 sm:px-10 lg:px-16 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-champagne/85">
          Guides Vistaire
        </p>
        <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.2rem,5vw,4.2rem)] font-normal leading-[1.02] text-cream">
          Comprendre le menu digital premium, le QR code et la 3D utile.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#d1c2aa]">
          Des guides concrets pour restaurateurs, lisibles par Google et par les
          moteurs de réponse, sans jargon SaaS.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <Link
            href={pricingGuide.path}
            className="group rounded-lg border border-champagne/30 bg-[#120d09] p-6 transition hover:border-champagne/45 hover:bg-[#17110c] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            <p className="text-[10px] font-semibold uppercase text-champagne/70">
              {pricingGuide.eyebrow}
            </p>
            <h3 className="mt-3 font-display text-2xl leading-tight text-cream group-hover:text-champagne">
              {pricingGuide.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#a99984]">
              {pricingGuide.description}
            </p>
          </Link>
          {SEO_PAGES.map((page) => (
            <Link
              key={page.path}
              href={page.path}
              className="group rounded-lg border border-white/10 bg-[#0d0907] p-6 transition hover:border-champagne/35 hover:bg-[#120d09] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-champagne/70">
                {page.eyebrow}
              </p>
              <h3 className="mt-3 font-display text-2xl leading-tight text-cream group-hover:text-champagne">
                {page.linkTitle ?? page.h1}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#a99984]">
                {page.cardDescription}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
