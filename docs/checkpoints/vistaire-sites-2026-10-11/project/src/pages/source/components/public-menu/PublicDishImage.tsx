import Image from "../../../NativeImage.tsx";
export function PublicDishImage({ objectPosition, style, ...props }: any) {
  return <Image {...props} fill style={{ objectPosition, ...style }} />;
}
