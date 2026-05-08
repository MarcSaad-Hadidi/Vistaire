"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PrimaryButton } from "@/components/PrimaryButton";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isDemoRoute = pathname.startsWith("/demo");

  const experienceHref = isHome ? "#experience" : "/#experience";
  const beneficesHref = isHome ? "#benefices" : "/#benefices";
  const demoHref = isHome ? "#demo" : "/#demo";
  const logoHref = isHome ? "#experience" : "/";

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-[#050403]/95 to-transparent pb-2 pt-3 sm:px-6 sm:pb-3 sm:pt-4">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 rounded-full border border-white/10 bg-[#070504]/92 px-3 py-2 shadow-[0_18px_80px_rgba(0,0,0,0.35)] sm:min-h-16 sm:gap-4 sm:px-5 sm:py-2.5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href={logoHref}
            className="shrink-0 font-display text-lg leading-none text-cream outline-none transition hover:text-champagne focus-visible:ring-2 focus-visible:ring-champagne sm:text-2xl"
            aria-label={
              isHome
                ? "MenuAlive — accueil de la page"
                : "MenuAlive — retour à la page d’accueil"
            }
          >
            MenuAlive
          </Link>
          {isDemoRoute ? (
            <span className="hidden truncate border-l border-white/15 pl-3 text-[11px] font-medium uppercase tracking-[0.18em] text-champagne/85 sm:inline">
              Menu démo
            </span>
          ) : null}
        </div>

        {!isDemoRoute ? (
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-6 text-sm text-[#dbcdb8] md:flex lg:gap-8">
            <Link
              className="transition hover:text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
              href={experienceHref}
            >
              Expérience
            </Link>
            <Link
              className="transition hover:text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
              href={beneficesHref}
            >
              Bénéfices
            </Link>
          </div>
        ) : (
          <div className="hidden flex-1 justify-center sm:flex" aria-hidden />
        )}

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isDemoRoute ? (
            <Link
              href="/"
              className="text-xs font-medium text-champagne/90 transition hover:text-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne sm:text-sm"
            >
              Accueil site
            </Link>
          ) : (
            <Link
              href="/demo"
              className="inline-flex min-h-10 max-w-[9.5rem] items-center justify-center rounded-full border border-champagne/35 bg-transparent px-3 text-center text-xs font-semibold text-champagne transition hover:border-champagne/55 hover:bg-champagne/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne sm:max-w-none sm:min-h-11 sm:px-4 sm:text-sm"
              aria-label="Voir la démo du menu interactif"
            >
              Voir la démo
            </Link>
          )}
          <PrimaryButton
            href={demoHref}
            size="small"
            aria-label="Demander une démo"
          >
            Demander une démo
          </PrimaryButton>
        </div>
      </nav>
    </header>
  );
}
