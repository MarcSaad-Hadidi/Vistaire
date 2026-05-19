import type { Metadata } from "next";
import Link from "next/link";
import { DemoRequestSection } from "@/components/DemoRequestSection";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { ResponsiveLandingHero } from "@/components/landing/ResponsiveLandingHero";
import {
  DEFAULT_SITE_DESCRIPTION,
  absoluteUrl,
  buildVistaireServiceJsonLd
} from "@/lib/seo";

export const metadata: Metadata = {
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: absoluteUrl("/"),
    title: "Vistaire — Menu digital premium pour restaurants",
    description: DEFAULT_SITE_DESCRIPTION
  },
  twitter: {
    card: "summary",
    title: "Vistaire — Menu digital premium pour restaurants",
    description: DEFAULT_SITE_DESCRIPTION
  }
};

const benefits = [
  {
    title: "Plus visuel",
    body: "Des photos et fiches plats qui aident les clients à choisir avec confiance."
  },
  {
    title: "Plus premium",
    body: "Une présentation qui valorise vos plats signatures et votre image de marque."
  },
  {
    title: "Plus immersif",
    body: "La 3D / AR crée un moment mémorable, sans téléchargement d’application."
  }
];

function BenefitsSection() {
  return (
    <section
      id="benefices"
      className="relative overflow-hidden bg-[#070504] px-5 py-20 sm:px-10 lg:px-16 lg:py-28"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-champagne/35 to-transparent" />
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-champagne/85">
          Impact restaurant
        </p>
        <h2 className="mt-5 max-w-5xl font-display text-[clamp(2.45rem,6vw,5.8rem)] font-normal leading-[0.98] text-cream">
          Un menu plus clair pour vos clients. Une carte mieux valorisée pour votre restaurant.
        </h2>
        <p className="mt-6 max-w-3xl text-base leading-7 text-[#d1c2aa] sm:text-lg sm:leading-8">
          Vistaire est un menu digital premium pour restaurants : le client scanne
          un QR code à table, consulte des fiches plats visuelles, explore la 3D
          ou l&apos;AR quand elle est disponible, puis le restaurateur visualise un
          aperçu clair de l&apos;attention portée à sa carte.
        </p>

        <div className="mt-12 grid gap-8 border-t border-white/12 pt-9 md:grid-cols-3 lg:mt-16 lg:pt-11">
          {benefits.map((benefit, index) => (
            <article key={benefit.title} className="max-w-sm md:pr-8">
              <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-white/28">
                0{index + 1}
              </p>
              <h3 className="text-xl font-semibold text-champagne">
                {benefit.title}
              </h3>
              <p className="mt-4 text-base leading-7 text-[#d1c2aa]">
                {benefit.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050403] px-5 py-10 text-sm text-[#b9aa94] sm:px-10 lg:px-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-xl text-cream">Vistaire</p>
        <div className="flex flex-col gap-2 sm:items-end">
          <p>Menu vivant premium pour restaurants.</p>
          <Link
            href="/owner"
            className="rounded-sm text-[10px] text-[#cdbd9f] transition hover:text-cream focus:outline-none focus-visible:text-cream focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-[#050403]"
          >
            Accès interne
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <Header />
      <JsonLd data={buildVistaireServiceJsonLd()} />
      <main>
        <ResponsiveLandingHero />
        <BenefitsSection />
        <DemoRequestSection />
      </main>
      <Footer />
    </>
  );
}
