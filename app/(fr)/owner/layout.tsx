import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerShell } from "@/components/owner/OwnerShell";
import { getVistaireOwnerAuthorization } from "@/lib/auth/owner";
import { getOwnerRestaurantsData } from "@/lib/owner/data";

export const metadata: Metadata = {
  title: "Vistaire Owner",
  description:
    "Owner Command Center Vistaire : restaurants, menus, QR sécurisés, médias, readiness et copilot.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true
  }
};

export default async function OwnerLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ownerAuthorization = await getVistaireOwnerAuthorization();
  if (!ownerAuthorization.ok) {
    await auth.protect();
    notFound();
  }

  const shellRestaurantsData = await getOwnerRestaurantsData();
  const shellRestaurants = shellRestaurantsData.restaurants.map(
    ({ id, name, slug, dashboardHref, readinessScore, statusLabel }) => ({
      id,
      name,
      slug,
      dashboardHref,
      readinessScore,
      statusLabel
    })
  );

  if (ownerAuthorization.userId === "owner-e2e-bypass") {
    return (
      <div className={styles.ownerTheme}>
        <OwnerShell
          restaurants={shellRestaurants}
          accountControl={
            <span className={styles.badge}>
              {ownerAuthorization.emailAddresses[0] ?? "Owner e2e"}
            </span>
          }
        >
          {children}
        </OwnerShell>
      </div>
    );
  }

  const { OwnerClerkBoundary } = await import(
    "@/components/owner/OwnerClerkBoundary"
  );

  return (
    <OwnerClerkBoundary restaurants={shellRestaurants}>
      {children}
    </OwnerClerkBoundary>
  );
}
