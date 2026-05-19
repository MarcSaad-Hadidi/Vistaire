import type { Metadata } from "next";
import { ClerkProvider, SignIn } from "@clerk/nextjs";
import Link from "next/link";
import {
  vistaireClerkAppearance,
  vistaireClerkLocalization
} from "@/lib/clerkAppearance";

export const metadata: Metadata = {
  title: "Accès interne",
  description: "Connexion réservée à l'espace interne Vistaire.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true
  }
};

export default function SignInPage() {
  return (
    <ClerkProvider
      appearance={vistaireClerkAppearance}
      localization={vistaireClerkLocalization}
      telemetry={false}
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
      afterSignOutUrl="/"
    >
      <main className="min-h-screen bg-[#080706] px-5 py-10 text-cream sm:px-10 lg:px-16">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center gap-10 lg:grid lg:grid-cols-[0.9fr_1fr] lg:items-center">
          <section className="max-w-xl">
            <Link
              href="/"
              className="font-display text-2xl text-cream transition hover:text-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            >
              Vistaire
            </Link>
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.24em] text-champagne/85">
              Accès réservé
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.7rem,7vw,5.9rem)] font-normal leading-[0.95] text-cream">
              Accès interne Vistaire
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#d1c2aa] sm:text-lg sm:leading-8">
              Espace réservé au pilotage des expériences restaurant.
            </p>
          </section>

          <section
            aria-label="Formulaire d'accès Vistaire"
            className="w-full max-w-md justify-self-end"
          >
            <SignIn
              routing="path"
              path="/sign-in"
              fallbackRedirectUrl="/owner"
              signUpUrl="/sign-in"
              withSignUp={false}
              appearance={vistaireClerkAppearance}
            />
          </section>
        </div>
      </main>
    </ClerkProvider>
  );
}
