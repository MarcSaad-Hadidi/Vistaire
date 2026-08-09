import Link from "next/link";
import { getEditorialGuides } from "@/lib/editorialGuides";
import type { Locale } from "@/lib/i18n";

const copy = {
  fr: {
    eyebrow: "Guides Vistaire",
    title: "Mieux décider avant de numériser la carte.",
    description:
      "Trois ressources éditoriales pour structurer le menu, préparer le parcours QR à table et choisir la 3D pour les bonnes raisons.",
    read: "Lire le guide",
    pillarLabel: "Explorer aussi les fondamentaux du menu digital",
    pillarHref: "/menu-digital-restaurant"
  },
  en: {
    eyebrow: "Vistaire guides",
    title: "Make better decisions before digitizing the menu.",
    description:
      "Three editorial resources for structuring the menu, preparing the table-side QR journey and choosing 3D for the right reasons.",
    read: "Read the guide",
    pillarLabel: "Explore the digital-menu fundamentals",
    pillarHref: "/en/digital-restaurant-menu"
  }
} as const;

export function GuidesVistaireSection({ locale = "fr" }: { locale?: Locale }) {
  const sectionCopy = copy[locale];
  const guides = getEditorialGuides(locale);

  return (
    <section
      id="guides"
      className="relative border-t border-white/10 bg-[#070504] px-5 py-20 sm:px-10 lg:px-16 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-champagne/85">
          {sectionCopy.eyebrow}
        </p>
        <h2 className="mt-5 max-w-4xl font-display text-[clamp(2.2rem,5vw,4.2rem)] font-normal leading-[1.02] text-cream">
          {sectionCopy.title}
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#d1c2aa]">
          {sectionCopy.description}
        </p>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {guides.map((guide, index) => (
            <Link
              key={guide.path}
              href={guide.path}
              className="group flex min-h-72 flex-col rounded-lg border border-white/10 bg-[#0d0907] p-6 transition hover:border-champagne/35 hover:bg-[#120d09] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-champagne/70">
                {String(index + 1).padStart(2, "0")} · {guide.eyebrow}
              </p>
              <h3 className="mt-5 font-display text-3xl leading-[1.05] text-cream group-hover:text-champagne">
                {guide.cardTitle}
              </h3>
              <p className="mt-4 text-sm leading-6 text-[#a99984]">
                {guide.cardDescription}
              </p>
              <span className="mt-auto flex min-h-11 items-end pt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[#d9bd8d]">
                {sectionCopy.read} <span aria-hidden="true" className="ml-2">↗</span>
              </span>
            </Link>
          ))}
        </div>

        <Link
          className="mt-8 inline-flex min-h-11 items-center text-sm text-[#c7b69e] underline decoration-white/20 underline-offset-4 hover:text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          href={sectionCopy.pillarHref}
        >
          {sectionCopy.pillarLabel}
        </Link>
      </div>
    </section>
  );
}
