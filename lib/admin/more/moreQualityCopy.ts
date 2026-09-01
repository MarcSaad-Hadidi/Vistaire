import type { AdminMenuCompletionIssue, AdminMoreQualityCopy } from "./contracts.ts";

const copy: Record<"fr" | "en", AdminMoreQualityCopy> = {
  fr: {
    title: "Centre de qualité Vistaire",
    description: "Vérifiez ce qui est prêt dans votre menu et ce qui reste à compléter.",
    statusTitle: "État du menu",
    qrTitle: "Santé du QR",
    contentTitle: "Assets et contenus",
    experienceTitle: "Mesures d’expérience",
    profileTitle: "Profil du restaurant",
    issuesTitle: "Points à compléter",
    supportTitle: "Besoin d’aide ? L’équipe Vistaire vous accompagne.",
    supportBody: "Obtenez des recommandations ou signalez un problème à notre équipe.",
    supportAction: "Contacter Vistaire",
    noIssues: "Aucun point catalogue à compléter.",
    states: {
      ready: "Prêt",
      partial: "À compléter",
      unmeasured: "Non mesuré",
      unavailable: "Indisponible",
      notApplicable: "Non applicable",
      sourceNotConnected: "Source non connectée"
    },
    labels: {
      qr: "QR actif", publication: "Menu publié", photos: "Photos prêtes",
      descriptions: "Descriptions prêtes", allergens: "Allergènes renseignés",
      translations: "Traductions prêtes", immersiveAssets: "Assets 3D/AR présents",
      mobilePerformance: "Performance mobile", immersiveSuccess: "Succès 3D/AR",
      assetErrors: "Erreurs d’assets"
    }
  },
  en: {
    title: "Vistaire quality center",
    description: "Review what is ready in your menu and what still needs attention.",
    statusTitle: "Menu status",
    qrTitle: "QR health",
    contentTitle: "Assets and content",
    experienceTitle: "Experience measurement",
    profileTitle: "Restaurant profile",
    issuesTitle: "Items to complete",
    supportTitle: "Need help? The Vistaire team is here.",
    supportBody: "Get recommendations or report a problem to our team.",
    supportAction: "Contact Vistaire",
    noIssues: "No catalog items need attention.",
    states: {
      ready: "Ready",
      partial: "Needs attention",
      unmeasured: "Not measured",
      unavailable: "Unavailable",
      notApplicable: "Not applicable",
      sourceNotConnected: "Source not connected"
    },
    labels: {
      qr: "Active QR", publication: "Published menu", photos: "Photos ready",
      descriptions: "Descriptions ready", allergens: "Allergens documented",
      translations: "Translations ready", immersiveAssets: "3D/AR assets present",
      mobilePerformance: "Mobile performance", immersiveSuccess: "3D/AR success",
      assetErrors: "Asset errors"
    }
  }
};

export function moreQualityCopy(locale: "fr" | "en"): AdminMoreQualityCopy {
  return copy[locale];
}
export function completionIssueCopy(issue: AdminMenuCompletionIssue, locale: "fr" | "en"): string {
  const dish = issue.dishName ? ` — ${issue.dishName}` : "";
  const messages = locale === "fr" ? {
    "menu-empty": "Ajoutez au moins un plat au menu",
    "menu-unpublished": "Publiez le menu pour le rendre accessible",
    "qr-inactive": "Activez un QR d’administration valide",
    "profile-field-missing": `Complétez le profil (${issue.field ?? "champ manquant"})`,
    "photo-missing": `Photo manquante${dish}`,
    "description-missing": `Description manquante${dish}`,
    "allergens-unknown": `Allergènes à vérifier${dish}`,
    "translation-missing": `Traduction ${issue.locale ?? ""} à compléter${dish}`
  } : {
    "menu-empty": "Add at least one dish to the menu",
    "menu-unpublished": "Publish the menu to make it available",
    "qr-inactive": "Activate a valid administration QR",
    "profile-field-missing": `Complete the profile (${issue.field ?? "missing field"})`,
    "photo-missing": `Missing photo${dish}`,
    "description-missing": `Missing description${dish}`,
    "allergens-unknown": `Allergens need review${dish}`,
    "translation-missing": `${issue.locale ?? ""} translation needs attention${dish}`
  };
  return messages[issue.kind];
}
