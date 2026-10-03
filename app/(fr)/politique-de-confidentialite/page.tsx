import type { Metadata } from "next";
import Link from "next/link";
import { VistaireLegalPage } from "@/components/legal/VistaireLegalPage";

const canonicalPath = "/politique-de-confidentialite";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Vistaire",
  description:
    "Politique de confidentialité de Vistaire : renseignements personnels, témoins, analytics, fournisseurs et droits.",
  alternates: {
    canonical: canonicalPath,
    languages: {
      "fr-CA": canonicalPath,
      "en-CA": "/en/privacy-policy"
    }
  },
  robots: { index: false, follow: true }
};

export default function PolitiqueConfidentialitePage() {
  return (
    <VistaireLegalPage
      intro="Cette politique explique comment Vistaire traite les renseignements personnels lorsque vous utilisez son site, ses formulaires et les fonctions d’analyse facultatives."
      languageHref="/en/privacy-policy"
      languageLabel="EN"
      locale="fr"
      title="Politique de confidentialité"
      updatedLabel="Dernière mise à jour : 2 septembre 2026"
    >
      <section>
        <h2>1. Portée et responsable</h2>
        <p>
          Cette politique s’applique au site et aux services en ligne exploités sous la marque Vistaire. Vistaire vise principalement les restaurateurs et les personnes qui consultent les cartes digitales de ses clients.
        </p>
        <p>
          <strong>Responsable de la protection des renseignements personnels — Vistaire</strong><br />
          Montréal, Québec, Canada<br />
          <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
        </p>
      </section>

      <section>
        <h2>2. Renseignements que nous pouvons traiter</h2>
        <h3>Demandes de contact et de rendez-vous</h3>
        <p>
          Lorsque vous nous écrivez par le formulaire, nous recevons notamment votre nom, votre adresse courriel, le nom de votre restaurant et le message que vous choisissez de transmettre. Ces renseignements servent à répondre à votre demande et à poursuivre la relation commerciale que vous initiez.
        </p>
        <h3>Données techniques et de sécurité</h3>
        <p>
          Des renseignements techniques nécessaires au fonctionnement et à la sécurité peuvent être traités, par exemple des en-têtes de requête, l’adresse IP ou des journaux techniques. Le formulaire Vistaire peut utiliser l’adresse IP de façon transitoire pour limiter les abus et les envois excessifs.
        </p>
        <h3>Analyse facultative</h3>
        <p>
          Si vous acceptez la catégorie « Analyse », Vistaire peut créer un identifiant de session pseudonyme dans le stockage de session et mesurer des événements comme l’ouverture d’une carte ou d’un plat, les catégories consultées, les recherches, les filtres, certains appels à l’action, la taille du viewport et le user-agent. Ces données servent à comprendre l’utilisation des cartes et du site.
        </p>
      </section>

      <section>
        <h2>3. Témoins, stockage local et Microsoft Clarity</h2>
        <p>
          Les outils d’analyse facultatifs sont <strong>désactivés par défaut</strong>. Ils ne sont activés qu’après votre choix explicite. Votre préférence de confidentialité est conservée localement dans votre navigateur afin que le site puisse respecter votre décision.
        </p>
        <p>
          Avec votre accord, Vistaire utilise <strong>Microsoft Clarity</strong> pour comprendre des interactions comme les clics, le défilement et les parcours de navigation, notamment au moyen de cartes de chaleur et d’enregistrements de session. Clarity peut alors utiliser des témoins tels que <code>_clck</code> et <code>_clsk</code>. Sans votre accord, le script Clarity n’est pas chargé par Vistaire.
        </p>
        <p>
          Vous pouvez modifier ou retirer votre choix en tout temps avec « Préférences de confidentialité » au bas des pages publiques. Le retrait désactive l’analyse facultative, efface l’identifiant de session d’analyse interne et demande à Clarity de retirer son consentement.
        </p>
      </section>

      <section>
        <h2>4. Finalités</h2>
        <ul>
          <li>répondre aux demandes et planifier des échanges avec les restaurateurs;</li>
          <li>exploiter, sécuriser et diagnostiquer le site et les cartes digitales;</li>
          <li>mesurer l’utilisation et améliorer l’expérience lorsque vous avez accepté l’analyse;</li>
          <li>respecter nos obligations légales et protéger les droits, la sécurité et l’intégrité de Vistaire et de ses utilisateurs.</li>
        </ul>
      </section>

      <section>
        <h2>5. Fournisseurs et communications</h2>
        <p>
          Vistaire utilise <strong>Brevo</strong> pour transmettre les demandes envoyées par le formulaire de contact. Les renseignements que vous inscrivez au formulaire peuvent donc être communiqués à Brevo pour cette finalité.
        </p>
        <p>
          Lorsque vous acceptez l’analyse, des données d’utilisation peuvent être communiquées à <strong>Microsoft Clarity</strong>. Selon la fonctionnalité utilisée, Vistaire peut aussi s’appuyer sur des fournisseurs techniques d’hébergement, de base de données ou d’authentification, notamment Vercel, Supabase et Clerk, uniquement dans la mesure nécessaire à l’exploitation du service concerné.
        </p>
      </section>

      <section>
        <h2>6. Traitement hors Québec</h2>
        <p>
          Certains fournisseurs technologiques peuvent traiter des renseignements à l’extérieur du Québec ou du Canada selon leur infrastructure et les services utilisés. Lorsqu’une communication hors Québec est envisagée, Vistaire applique les exigences légales applicables et évalue les mesures de protection requises avant la communication lorsqu’une telle évaluation est exigée.
        </p>
      </section>

      <section>
        <h2>7. Conservation et sécurité</h2>
        <p>
          Vistaire conserve les renseignements seulement pendant la période raisonnablement nécessaire aux finalités décrites, aux besoins de sécurité, à la gestion de la relation et aux obligations légales applicables. Les durées peuvent varier selon la nature du renseignement et le fournisseur concerné.
        </p>
        <p>
          Des mesures administratives, techniques et organisationnelles raisonnables sont utilisées pour limiter l’accès, la perte, l’utilisation ou la communication non autorisée. Aucun système connecté à Internet ne peut toutefois être garanti comme absolument sécurisé.
        </p>
      </section>

      <section>
        <h2>8. Vos droits et vos choix</h2>
        <p>
          Sous réserve des règles applicables, vous pouvez demander l’accès ou la rectification de vos renseignements personnels, poser une question sur leur traitement, retirer un consentement lorsque le traitement repose sur celui-ci ou transmettre une plainte au responsable de la protection des renseignements personnels.
        </p>
        <p>
          Pour exercer un droit ou poser une question : <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>. Vous pouvez également vous adresser à la Commission d’accès à l’information du Québec lorsque la loi le permet.
        </p>
      </section>

      <section>
        <h2>9. Modifications</h2>
        <p>
          Cette politique peut être mise à jour lorsque les pratiques, fournisseurs ou obligations de Vistaire changent. La date affichée en haut de cette page indique la version en vigueur.
        </p>
        <p>
          Consultez également nos <Link href="/conditions-utilisation">Conditions d’utilisation</Link>.
        </p>
      </section>
    </VistaireLegalPage>
  );
}
