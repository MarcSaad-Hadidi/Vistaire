"use client";

import { ClerkProvider } from "@clerk/nextjs";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerShell } from "@/components/owner/OwnerShell";
import { OwnerUserButton } from "@/components/owner/OwnerUserButton";
import type { OwnerShellRestaurant } from "@/lib/owner/nav";
import {
  vistaireClerkAppearance,
  vistaireClerkLocalization
} from "@/lib/clerkAppearance";

export function OwnerClerkBoundary({
  children,
  restaurants = []
}: {
  children: React.ReactNode;
  restaurants?: OwnerShellRestaurant[];
}) {
  return (
    <ClerkProvider
      appearance={vistaireClerkAppearance}
      localization={vistaireClerkLocalization}
      telemetry={false}
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
      afterSignOutUrl="/"
    >
      <div className={styles.ownerTheme}>
        <OwnerShell
          accountControl={<OwnerUserButton />}
          restaurants={restaurants}
        >
          {children}
        </OwnerShell>
      </div>
    </ClerkProvider>
  );
}
