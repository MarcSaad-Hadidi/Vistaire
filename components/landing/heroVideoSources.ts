export type HeroVideoVariant = "desktopHigh" | "mobile";

export type HeroVideoSource = {
  variant: HeroVideoVariant;
  src: string;
  label: string;
  width: number;
  height: number;
  sizeMb: number;
  durationSeconds: number;
  scrubReady: boolean;
};

export const HERO_VIDEO_SOURCES: Record<HeroVideoVariant, HeroVideoSource> = {
  desktopHigh: {
    variant: "desktopHigh",
    src: "/videos/optimized/upscaled-video-desktop-scrub.mp4",
    label: "desktop-high",
    width: 2560,
    height: 1440,
    sizeMb: 23.17,
    durationSeconds: 30.067,
    scrubReady: true
  },
  mobile: {
    variant: "mobile",
    src: "/videos/optimized/upscaled-video-mobile-scrub.mp4",
    label: "mobile",
    width: 722,
    height: 406,
    sizeMb: 2.95,
    durationSeconds: 30.067,
    scrubReady: true
  }
};

export const HERO_VIDEO_POSTER = "/frames/menualive/frame_0001.webp";
