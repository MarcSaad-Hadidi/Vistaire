export const frameConfig = {
  frameCount: 360,
  framePath: (index: number) =>
    `/frames/menualive/frame_${String(index + 1).padStart(4, "0")}.webp`
};
