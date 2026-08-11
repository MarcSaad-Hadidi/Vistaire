import { MicrosoftClarityScript } from "@/components/analytics/MicrosoftClarityScript";
import type { ReactNode } from "react";

const CLARITY_PROJECT_ID = "y0gra96318";

type MicrosoftClarityProps = {
  children: ReactNode;
};

export function MicrosoftClarity({ children }: MicrosoftClarityProps) {
  if (process.env.VERCEL_ENV !== "production") {
    return children;
  }

  return (
    <MicrosoftClarityScript projectId={CLARITY_PROJECT_ID}>
      {children}
    </MicrosoftClarityScript>
  );
}
