import { DemoWalkthroughVideo } from "../vistaire-preview/DemoWalkthroughVideo.tsx";
export function LandingHeroMedia({ locale }: { locale: "fr" | "en" }) {
  return (
    <div className="public-hero-media">
      <DemoWalkthroughVideo
        playLabel={locale === "en" ? "Play video" : "Lire la vidéo"}
        label={
          locale === "en"
            ? "Vistaire restaurant experience"
            : "Expérience Vistaire au restaurant"
        }
        src="/media/cinematic-landscape.mp4?v=window-table-black-gold-20261009"
        poster="/assets/cinematic-landscape.webp?v=window-table-black-gold-20261009"
      />
    </div>
  );
}
