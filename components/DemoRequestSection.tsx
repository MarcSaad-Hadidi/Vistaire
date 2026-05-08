"use client";

import Link from "next/link";
import { useState } from "react";

const fields = [
  { id: "name", label: "Nom", type: "text", autoComplete: "name" },
  {
    id: "restaurant",
    label: "Restaurant",
    type: "text",
    autoComplete: "organization"
  },
  { id: "email", label: "Email", type: "email", autoComplete: "email" },
  { id: "phone", label: "Téléphone", type: "tel", autoComplete: "tel" }
];

export function DemoRequestSection() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  return (
    <section
      id="demo"
      className="relative overflow-hidden border-t border-white/10 bg-[#080706] px-5 py-20 sm:px-10 lg:px-16 lg:py-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(217,184,121,0.12),transparent_30rem)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-champagne/85">
            Démo privée
          </p>
          <h2 className="mt-5 font-display text-[clamp(2.4rem,5vw,4.9rem)] font-normal leading-[1.01] text-cream">
            Demander une démo MenuAlive
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-[#d1c2aa]">
            Préparez une première expérience autour de vos plats signatures, de
            votre ambiance et de votre carte actuelle.
          </p>
          <p className="mt-6 max-w-md text-sm leading-6 text-[#b9aa94]">
            <Link
              href="/demo"
              className="font-semibold text-champagne/95 underline decoration-champagne/35 underline-offset-4 transition hover:decoration-champagne/60"
            >
              Explorer le menu démo
            </Link>
            {" "}— aperçu client réaliste après scan QR (données fictives).
          </p>
        </div>

        <form
          className="rounded-[8px] border border-white/14 bg-[#0d0906]/78 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.34)] sm:p-7"
          onSubmit={(event) => {
            event.preventDefault();
            event.currentTarget.reset();
            setIsSubmitted(true);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.id} className="block">
                <span className="mb-2 block text-sm text-[#ded0bb]">
                  {field.label}
                </span>
                <input
                  required
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  className="h-12 w-full rounded-[6px] border border-white/14 bg-black/38 px-4 text-base text-cream outline-none transition placeholder:text-white/30 focus:border-champagne focus:ring-2 focus:ring-champagne/25"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-[#ded0bb]">Message</span>
            <textarea
              id="message"
              name="message"
              rows={5}
              className="w-full resize-none rounded-[6px] border border-white/14 bg-black/38 px-4 py-3 text-base text-cream outline-none transition placeholder:text-white/30 focus:border-champagne focus:ring-2 focus:ring-champagne/25"
            />
          </label>

          <button
            type="submit"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-champagne/50 bg-champagne px-6 py-3 text-base font-semibold text-charcoal shadow-[0_18px_48px_rgba(217,184,121,0.2)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#f0d396] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:w-auto"
          >
            Envoyer la demande
          </button>

          {isSubmitted ? (
            <p role="status" className="mt-4 text-sm leading-6 text-[#e9d7b2]">
              Merci. Votre demande de démo a bien été préparée.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
