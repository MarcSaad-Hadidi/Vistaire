import type { Metadata } from "next";
import Link from "next/link";
import { VistaireLegalPage } from "@/components/legal/VistaireLegalPage";

const canonicalPath = "/conditions-utilisation";

export const metadata: Metadata = {
  title: "Conditions d’utilisation | Vistaire",
  description: "Conditions applicables à l’utilisation du site public Vistaire.",
  alternates: {
    canonical: canonicalPath,
    languages: {
      "fr-CA": canonicalPath,
      "en-CA": "/en/terms-of-use"
    }
  },
  robots: { index: false, follow: true }
};

export default function ConditionsUtilisationPage() {
  return (
    <VistaireLegalPage
      intro="Ces conditions encadrent l’utilisation du site public Vistaire. Elles ne remplacent pas le contrat de services conclu séparément avec un restaurant client."
      languageHref="/en/terms-of-use"
      languageLabel="EN"
      locale="fr"
      title="Conditions d’utilisation"
      updatedLabel="Dernière mise à jour : 2 septembre 2026"
    >
      <section>
        <h2>1. Acceptation et portée</h2>
        <p>
          En utilisant ce site, vous acceptez de respecter les présentes conditions et les lois applicables. Si vous n’acceptez pas ces conditions, vous devez cesser d’utiliser le site.
        </p>
        <p>
          Les offres commerciales, abonnements, livrables, paiements, renouvellements et autres modalités des services Vistaire destinés aux restaurants sont régis par le devis, le bon de commande ou le contrat de services applicable, et non par cette page.
        </p>
      </section>

      <section>
        <h2>2. Utilisation permise</h2>
        <p>Vous pouvez consulter le site pour vous informer sur Vistaire, découvrir les démonstrations et communiquer avec nous.</p>
        <p>Vous ne devez notamment pas :</p>
        <ul>
          <li>tenter de contourner les contrôles d’accès, de sécurité ou de limitation d’abus;</li>
          <li>perturber le fonctionnement du site ou lancer des requêtes automatisées abusives;</li>
          <li>copier, extraire ou réutiliser substantiellement le site, les visuels, les interfaces ou les contenus sans autorisation lorsque la loi ne le permet pas;</li>
          <li>utiliser le site à des fins frauduleuses, illicites ou portant atteinte aux droits d’autrui.</li>
        </ul>
      </section>

      <section>
        <h2>3. Propriété intellectuelle</h2>
        <p>
          Sauf indication contraire, le site Vistaire, sa présentation, ses textes, éléments graphiques, interfaces, démonstrations et autres contenus originaux sont protégés par les droits de propriété intellectuelle applicables. Les marques, images ou contenus appartenant à des tiers demeurent la propriété de leurs titulaires respectifs.
        </p>
      </section>

      <section>
        <h2>4. Démonstrations et information</h2>
        <p>
          Les démonstrations, exemples, prix présentés à titre informatif, contenus éditoriaux et descriptions du site peuvent évoluer. Nous faisons des efforts raisonnables pour maintenir l’information exacte, mais une erreur, une omission ou une indisponibilité temporaire peut survenir.
        </p>
      </section>

      <section>
        <h2>5. Services et liens de tiers</h2>
        <p>
          Certaines fonctions peuvent dépendre de services ou de sites tiers. Leur disponibilité, leurs conditions et leurs pratiques de confidentialité sont sous la responsabilité de leurs exploitants respectifs. Un lien vers un tiers ne constitue pas une garantie ou une approbation de tout son contenu.
        </p>
      </section>

      <section>
        <h2>6. Disponibilité et responsabilité</h2>
        <p>
          Vistaire peut modifier, suspendre ou maintenir le site afin d’en assurer l’évolution, la sécurité ou la fiabilité. Dans la mesure permise par la loi, Vistaire n’est pas responsable des pertes indirectes découlant uniquement de l’accès au site public ou de son indisponibilité temporaire. Rien dans ces conditions n’exclut une responsabilité qui ne peut légalement être exclue.
        </p>
      </section>

      <section>
        <h2>7. Confidentialité</h2>
        <p>
          Le traitement des renseignements personnels sur le site est décrit dans notre <Link href="/politique-de-confidentialite">Politique de confidentialité</Link>. Les fonctions d’analyse facultatives sont gérées séparément par vos préférences de confidentialité.
        </p>
      </section>

      <section>
        <h2>8. Droit applicable et modifications</h2>
        <p>
          Ces conditions sont régies par les lois applicables au Québec et les lois fédérales du Canada qui s’y appliquent, sous réserve des règles impératives qui pourraient autrement protéger un utilisateur. Vistaire peut mettre ces conditions à jour; la date en haut de la page indique la version en vigueur.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions sur ces conditions : <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>.
        </p>
      </section>
    </VistaireLegalPage>
  );
}
