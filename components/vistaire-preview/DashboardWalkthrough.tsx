import type { Locale } from "@/lib/i18n";
import { DemoWalkthroughVideo } from "./DemoWalkthroughVideo";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

const copy = {
  fr: {
    label: "Vidéo de démonstration du Studio Vistaire, 20 secondes",
    caption: "20 secondes dans le Studio · vidéo sans son · données fictives",
    transcript: "Ce que montre la vidéo",
    steps: [
      "0 à 4 s : sélection d’une période de 7 jours, puis du graphique des clics 3D",
      "4 à 8 s : ouverture du graphique agrandi et comparaison des deux périodes",
      "8 à 16 s : retour au dashboard, navigation dans les analyses puis dans les plats",
      "16 à 20 s : recherche du canard et changement de disponibilité dans la simulation locale"
    ]
  },
  en: {
    label: "Vistaire Studio demonstration video, 20 seconds",
    caption: "20 seconds in Studio · silent video · fictional data · French interface",
    transcript: "What the video shows",
    steps: [
      "0–4 s: selecting a 7-day period, then the 3D clicks chart",
      "4–8 s: opening the enlarged chart and comparing the two periods",
      "8–16 s: returning to the dashboard, opening insights, then the dish list",
      "16–20 s: searching for the duck dish and changing availability in the local simulation"
    ]
  }
};

export function DashboardWalkthrough({ locale }: { locale: Locale }) {
  const text = copy[locale];
  return (
    <figure className={styles.dashboardFilm} data-dashboard-walkthrough>
      <div className={styles.dashboardScreen}>
        <DemoWalkthroughVideo
          label={text.label}
          src="/videos/demo/dashboard-studio.mp4"
          poster="/images/demo-walkthrough/dashboard-studio.webp"
          controls
          autoPlay={false}
          sizes="(max-width: 760px) 90vw, 1100px"
        />
      </div>
      <figcaption>{text.caption}</figcaption>
      <details className={styles.filmTranscript}>
        <summary>{text.transcript}</summary>
        <ol>{text.steps.map(step => <li key={step}>{step}</li>)}</ol>
      </details>
    </figure>
  );
}
