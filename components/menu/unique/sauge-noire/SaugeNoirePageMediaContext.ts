"use client";

import { createContext, useContext } from "react";

export const SaugeNoirePhysicalPageMediaContext = createContext(false);

export function useSaugeNoirePhysicalPageMedia(): boolean {
  return useContext(SaugeNoirePhysicalPageMediaContext);
}
