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
        description="Générer, personnaliser, tester et télécharger les QR sécurisés par restaurant. Le QR pointe vers /q/<token> puis redirige vers le menu public."
      />

      <Panel title="Customizer QR Vistaire">
        <OwnerQrManager restaurants={data.restaurants} />
      </Panel>

      <p className={styles.sourceTag}>
        Sécurité : le token est généré côté serveur (crypto), seul son hash est
        stocké. Persistance via la table <code>qr_codes</code> (voir
        docs/owner-qr-schema.md). Sans Supabase, un token signé temporaire est
        utilisé et clairement signalé comme non persisté.
      </p>
    </>
  );
}
