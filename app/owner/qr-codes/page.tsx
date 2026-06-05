import styles from "@/components/owner/OwnerCockpit.module.css";
import { OwnerQrManager } from "@/components/owner/OwnerQrManager";
import { ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getOwnerRestaurantsData } from "@/lib/owner/data";

export const dynamic = "force-dynamic";

export default async function OwnerQrCodesPage() {
  const data = await getOwnerRestaurantsData();

  return (
    <>
      <ModuleHeader
        title="QR Codes"
        description="Generer, personnaliser, tester et telecharger les QR securises par restaurant : menu public pour les clients ou acces owner interne protege."
      />

      <Panel title="Customizer QR Vistaire">
        <OwnerQrManager restaurants={data.restaurants} />
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
