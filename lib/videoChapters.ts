export type VideoChapter = {
  id: string;
  start: number;
  end: number;
  eyebrow: string;
  title: string;
  body: string;
  cta?: string;
  /** Lien du bouton principal (défaut : expérience Vistaire). */
  ctaHref?: string;
  secondaryCta?: string;
  secondaryCtaHref?: string;
};

export const videoChapters: VideoChapter[] = [
  {
    id: "hero",
    start: 0,
    end: 0.24,
    eyebrow: "Vistaire",
    title: "La carte digitale qui rend vos plats plus désirables.",
    body: "Transformez un QR code à table en expérience premium, sans application, dès le premier scan.",
    cta: "Explorer l'expérience",
    ctaHref: "/demo",
    secondaryCta: "Aperçu restaurateur",
    secondaryCtaHref: "/apercu-restaurateur"
  },
  {
    id: "menu",
    start: 0.24,
    end: 0.48,
    eyebrow: "Menu client exemple",
    title: "Vos plats se présentent mieux.",
    body: "Maison Élyse est un restaurant exemple de présentation : il montre comment un client parcourt la carte Vistaire à table.",
    cta: "Voir le menu client",
    ctaHref: "/demo",
    secondaryCta: "Aperçu restaurateur",
    secondaryCtaHref: "/apercu-restaurateur"
  },
  {
    id: "ar",
    start: 0.48,
    end: 0.74,
    eyebrow: "Présentation immersive",
    title: "Le plat apparaît devant lui.",
    body: "Le client visualise le plat avant de commander, directement sur son téléphone.",
    cta: "Explorer une fiche plat",
    ctaHref: "/demo",
    secondaryCta: "Menu client",
    secondaryCtaHref: "/demo"
  },
  {
    id: "restaurant",
    start: 0.74,
    end: 1.01,
    eyebrow: "Lecture restaurateur",
    title: "Un menu qui donne envie.",
    body: "Valorisez vos plats signatures et transformez un simple QR code en expérience mémorable.",
    cta: "Explorer Maison Élyse",
    ctaHref: "/demo",
    secondaryCta: "Voir l’aperçu restaurateur",
    secondaryCtaHref: "/apercu-restaurateur"
  }
];

export function getActiveChapter(progress: number) {
  const clampedProgress = Number.isFinite(progress)
    ? Math.min(Math.max(progress, 0), 1)
    : 0;

  return (
    videoChapters.find(
      (chapter) =>
        clampedProgress >= chapter.start && clampedProgress < chapter.end
    ) ?? videoChapters[videoChapters.length - 1]
  );
}
