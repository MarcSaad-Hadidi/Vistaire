import { useSyncExternalStore } from "react";
import { pricingLightTheme, subscribePricingTheme } from "./PricingTheme.js";

export default function StudioPreviewImage({ mobile = false, ...props }) {
  const light = useSyncExternalStore(
    subscribePricingTheme,
    pricingLightTheme,
    () => false,
  );
  const name = mobile ? "studio-mobile-overview" : "studio-overview";
  return (
    <img
      {...props}
      src={`/assets/dashboard/${name}${light ? "-light" : ""}.webp`}
    />
  );
}
