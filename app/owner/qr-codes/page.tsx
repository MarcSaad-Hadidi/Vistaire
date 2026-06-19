import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerQrManager } from "@/components/owner/OwnerQrManager";
import { ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getOwnerRestaurantsData } from "@/lib/owner/data";
import type { OwnerQrTargetKind } from "@/lib/owner/menuUrlCore";

export const dynamic = "force-dynamic";

type OwnerQrCodesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeTargetKind(value: string | undefined): OwnerQrTargetKind {
  return value === "admin" ? "admin" : "menu";
}

export default async function OwnerQrCodesPage({
  searchParams
}: OwnerQrCodesPageProps) {
  const data = await getOwnerRestaurantsData();
  const params = await searchParams;
  const initialRestaurantId = getSearchParam(params, "restaurantId");
  const initialRestaurantSlug =
    getSearchParam(params, "restaurantSlug") ?? getSearchParam(params, "restaurant");
  const initialTargetKind = normalizeTargetKind(getSearchParam(params, "target"));

  return (
    <>
      <ModuleHeader
        title="QR Codes"
        description="Generer, personnaliser, tester et telecharger les QR securises par restaurant : menu public pour les clients ou acces owner interne protege."
      />

      <Panel title="Customizer QR Vistaire">
        <OwnerQrManager
          restaurants={data.restaurants}
          initialRestaurantId={initialRestaurantId}
          initialRestaurantSlug={initialRestaurantSlug}
          initialTargetKind={initialTargetKind}
        />
      </Panel>

      <p className={styles.sourceTag}>
        Securite : le token est genere cote serveur (crypto), seul son hash est
        stocke. Persistance via la table <code>qr_codes</code> (voir
        docs/owner-qr-schema.md). Sans Supabase, un token signe temporaire est
        utilise et clairement signale comme non persiste.
      </p>
    </>
  );
}
