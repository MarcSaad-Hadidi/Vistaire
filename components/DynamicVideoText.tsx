import { PrimaryButton } from "@/components/PrimaryButton";
import type { VideoChapter } from "@/lib/videoChapters";

type DynamicVideoTextProps = {
  chapter: VideoChapter;
};

export function DynamicVideoText({ chapter }: DynamicVideoTextProps) {
  return (
    <div
      key={chapter.id}
      className="chapter-copy max-w-[40rem]"
      data-chapter={chapter.id}
      aria-live="polite"
    >
      <p className="chapter-eyebrow mb-4 text-[0.68rem] font-semibold uppercase leading-none tracking-[0.22em] text-champagne sm:text-xs">
        {chapter.eyebrow}
      </p>
      <h1 className="font-display text-[clamp(3rem,12vw,4.4rem)] font-normal leading-[0.94] text-cream md:text-[clamp(4.2rem,7vw,8.25rem)]">
        {chapter.title}
      </h1>
      <p className="mt-5 max-w-[34rem] text-base leading-7 text-[#eadcc6] sm:mt-6 sm:text-[1.15rem] sm:leading-8">
        {chapter.body}
      </p>
      {chapter.cta ? (
        <PrimaryButton
          href="#demo"
          aria-label={chapter.cta}
          className="mt-8"
        >
          {chapter.cta}
        </PrimaryButton>
      ) : null}
    </div>
  );
}
