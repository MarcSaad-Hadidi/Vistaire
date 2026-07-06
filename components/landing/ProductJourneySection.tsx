import Link from "next/link";
import { PrimaryButton } from "@/components/PrimaryButton";

const steps = [
  {
    label: "Scan QR",
    body: "Le client ouvre la carte en quelques secondes, sans application."
  },
  {
    label: "Menu mobile",
    body: "Catégories, prix et allergènes lisibles à table, en lumière tamisée."
  },
  {
    label: "Fiche plat",
    body: "Photo, récit court et détails utiles pour les plats signatures."
  },
  {
    label: "3D / AR",
    body: "Immersion sélective quand elle aide vraiment à se représenter le plat."
  },
  {
    label: "Aperçu restaurateur",
    body: "Visualisez l'attention portée à la carte depuis l'aperçu Vistaire."
  }
];

export function ProductJourneySection() {
  return (
    <section
      id="parcours"
      className="relative border-t border-white/10 bg-[#080706] px-5 py-20 sm:px-10 lg:px-16 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-champagne/85">
          Preuve produit
        </p>
        <h2 className="mt-5 max-w-4xl font-display text-[clamp(2.2rem,5vw,4.8rem)] font-normal leading-[1.02] text-cream">
          Du QR code à la décision : le parcours client Vistaire.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#d1c2aa] sm:text-lg">
          Vistaire ne remplace pas votre salle. Il structure ce que le client vit
          après le scan : une carte mobile premium, des fiches plats désirables et
          une immersion réservée aux plats qui le méritent.
        </p>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className="rounded-lg border border-white/10 bg-[#0d0907] p-5"
            >
              <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30">
                0{index + 1}
              </p>
              <h3 className="mt-3 font-display text-2xl text-cream">{step.label}</h3>
              <p className="mt-3 text-sm leading-6 text-[#b9aa94]">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <PrimaryButton href="/demo">Explorer le menu client</PrimaryButton>
          <Link
            href="/demo"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 px-6 text-sm font-semibold text-[#cdbfa9] transition hover:border-champagne/35 hover:text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Voir la carte immersive
          </Link>
          <Link
            href="/apercu-restaurateur"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 px-6 text-sm font-semibold text-[#cdbfa9] transition hover:border-champagne/35 hover:text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Aperçu restaurateur
          </Link>
        </div>
      </div>
    </section>
  );
}
