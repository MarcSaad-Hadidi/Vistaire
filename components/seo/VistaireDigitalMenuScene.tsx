import Image from "next/image";
import type {
  CompareCategoryPreview,
  CompareDishPreview,
  PdfComparePreviewData
} from "@/lib/pdfComparePreviewData";

export type VistaireDigitalMenuSceneProps = {
  preview: PdfComparePreviewData;
  layerLabel?: string;
  showLayerLabel?: boolean;
  /** Adds cmb-* classes for the Cinematic Menu Bloom timeline. */
  bloomLayers?: boolean;
  className?: string;
};

function SceneCategoryCard({
  bloomLayers,
  cardDelay,
  category,
  priorityImage
}: {
  bloomLayers?: boolean;
  cardDelay?: string;
  category: CompareCategoryPreview;
  priorityImage?: boolean;
}) {
  return (
    <article
      aria-hidden
      className={`relative min-h-[70px] overflow-hidden rounded-[1rem] border border-champagne/20 bg-[#070504] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
        bloomLayers ? "cmb-dish" : ""
      }`}
      style={
        bloomLayers && cardDelay ? { ["--cmb-delay" as string]: cardDelay } : undefined
      }
    >
      {category.image ? (
        <Image
          src={category.image}
          alt=""
          fill
          priority={priorityImage}
          sizes="(max-width: 640px) 92vw, 380px"
          className="object-cover"
          style={{ objectPosition: category.imageObjectPosition }}
          quality={90}
          draggable={false}
        />
      ) : null}
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.68),rgba(0,0,0,0.2)_56%,rgba(0,0,0,0.46)),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.6))]"
      />
      <span className="relative z-10 flex h-full flex-col justify-end gap-0.5 p-3">
        <strong className="font-display text-[clamp(1rem,4vw,1.28rem)] font-normal leading-none text-cream">
          {category.name}
        </strong>
        <small className="text-[clamp(0.48rem,2vw,0.62rem)] font-extrabold leading-tight text-[#f4ebdd]/90">
          {category.description}
        </small>
      </span>
    </article>
  );
}

function FeaturedDishCardPreview({
  bloomLayers,
  dish
}: {
  bloomLayers?: boolean;
  dish: CompareDishPreview;
}) {
  return (
    <article
      aria-hidden
      className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2 border border-champagne/20 bg-champagne/[0.055] p-1.5 ${
        bloomLayers ? "cmb-dish" : ""
      }`}
      style={bloomLayers ? { ["--cmb-delay" as string]: "1940ms" } : undefined}
    >
      <span className="relative h-12 w-12 overflow-hidden bg-cream/[0.055]">
        {dish.image ? (
          <Image
            src={dish.image}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
            style={{ objectPosition: dish.imageObjectPosition }}
            quality={90}
            draggable={false}
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-[clamp(0.52rem,2.2vw,0.68rem)] font-extrabold leading-tight text-cream">
          {dish.name}
        </strong>
        <small className="line-clamp-2 text-[clamp(0.44rem,1.9vw,0.56rem)] font-semibold leading-snug text-[#f4ebdd]/68">
          {dish.shortDescription}
        </small>
      </span>
      <span className="font-display text-[clamp(0.58rem,2.4vw,0.72rem)] leading-none text-champagne">
        {dish.price}
      </span>
    </article>
  );
}

function VistaireLayerLabel({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="absolute right-[5%] top-[6%] z-10 inline-flex items-center gap-1 rounded-full border border-champagne/40 bg-[#0a0706]/88 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-champagne sm:text-[10px]"
    >
      <span className="h-1 w-1 rounded-full bg-champagne/80" />
      {label}
    </span>
  );
}

export function VistaireDigitalMenuScene({
  preview,
  layerLabel = "Vistaire",
  showLayerLabel = true,
  bloomLayers = false,
  className = ""
}: VistaireDigitalMenuSceneProps) {
  const { categoryCards, featuredDish, vistaireDishes } = preview;
  const suggestedDish = featuredDish ?? vistaireDishes[0];

  return (
    <div
      className={`absolute inset-0 grid grid-rows-[auto_1fr_auto] gap-2 overflow-hidden bg-[#080605] px-2.5 pb-2.5 pt-7 text-cream ${className}`}
    >
      <header
        className={`${bloomLayers ? "cmb-layer" : ""}`}
        style={bloomLayers ? { ["--cmb-delay" as string]: "780ms" } : undefined}
      >
        <p className="text-[clamp(0.42rem,1.8vw,0.54rem)] font-extrabold uppercase text-champagne">
          Carte à table
        </p>
        <h3 className="mt-1 max-w-[86%] font-display text-[clamp(1.45rem,6.4vw,2rem)] font-normal leading-[0.94] text-cream">
          Bienvenue chez Maison Élyse
        </h3>
        <p className="mt-2 line-clamp-3 max-w-[92%] text-[clamp(0.48rem,2.1vw,0.64rem)] font-bold leading-relaxed text-[#f4ebdd]/82">
          Découvrez les entrées, plats signatures, desserts et cocktails de la
          maison, pensés pour être explorés directement à table.
        </p>
      </header>

      <div className="min-h-0 overflow-hidden">
        <div className="grid gap-2">
          {categoryCards.map((category, index) => (
            <SceneCategoryCard
              key={category.id}
              category={category}
              priorityImage={index === 0}
              bloomLayers={bloomLayers}
              cardDelay={bloomLayers ? `${1040 + index * 140}ms` : undefined}
            />
          ))}
        </div>
      </div>

      {suggestedDish ? (
        <section
          className={`grid gap-1.5 border-t border-champagne/15 pt-2 ${
            bloomLayers ? "cmb-layer" : ""
          }`}
          style={bloomLayers ? { ["--cmb-delay" as string]: "1780ms" } : undefined}
        >
          <p className="text-[clamp(0.42rem,1.8vw,0.5rem)] font-extrabold uppercase leading-none text-champagne">
            Suggestion du chef
          </p>
          <h4 className="font-display text-[clamp(1.08rem,4.6vw,1.5rem)] font-normal leading-none text-cream">
            À découvrir ce soir
          </h4>
          <FeaturedDishCardPreview dish={suggestedDish} bloomLayers={bloomLayers} />
          <span
            className={`inline-flex min-h-7 items-center justify-center border border-champagne/25 bg-champagne/[0.09] px-3 text-[clamp(0.48rem,2vw,0.6rem)] font-extrabold leading-none text-champagne ${
              bloomLayers ? "cmb-cta" : ""
            }`}
            style={bloomLayers ? { ["--cmb-delay" as string]: "2260ms" } : undefined}
          >
            Voir toute la carte
          </span>
        </section>
      ) : null}

      {showLayerLabel ? <VistaireLayerLabel label={layerLabel} /> : null}
    </div>
  );
}
