"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useIsRealMobile } from "@/hooks/useIsRealMobile";

type DemoSimulationContextValue = {
  /** Viewport réellement &lt; md (pas de mockup). */
  isRealMobile: boolean;
  /** Desktop : simulation téléphone activée. */
  simulateMobile: boolean;
  /** Contenu rendu dans le mockup téléphone (desktop + simulation active). */
  isPhoneSimulation: boolean;
  setSimulateMobile: (value: boolean) => void;
};

const DemoSimulationContext = createContext<DemoSimulationContextValue | null>(
  null
);

export function DemoSimulationProvider({ children }: { children: ReactNode }) {
  const isRealMobile = useIsRealMobile();
  const [simulateMobile, setSimulateMobileState] = useState(false);

  const setSimulateMobile = useCallback((value: boolean) => {
    setSimulateMobileState(value);
  }, []);

  const isPhoneSimulation = simulateMobile && !isRealMobile;

  const value = useMemo(
    () => ({
      isRealMobile,
      simulateMobile,
      isPhoneSimulation,
      setSimulateMobile
    }),
    [isRealMobile, simulateMobile, isPhoneSimulation, setSimulateMobile]
  );

  return (
    <DemoSimulationContext.Provider value={value}>
      {children}
    </DemoSimulationContext.Provider>
  );
}

export function useDemoSimulation() {
  const ctx = useContext(DemoSimulationContext);
  if (!ctx) {
    throw new Error(
      "useDemoSimulation must be used within DemoSimulationProvider"
    );
  }
  return ctx;
}
