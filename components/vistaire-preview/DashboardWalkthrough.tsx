import type { Locale } from "@/lib/i18n";
import { DemoWalkthroughVideo } from "./DemoWalkthroughVideo";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

const copy = {
  fr: {
    label: "Vidéo de démonstration du Studio Vistaire",
    caption: "2 min 18 dans le Studio · accéléré ×3 · sans son · données fictives et actions simulées",
    playLabel: "Lire la vidéo",
    transcript: "Ce que montre la vidéo",
    steps: [
      "0:00 · Vue d’ensemble, recherche et thèmes clair et sombre",
      "0:09 · Périodes, calendrier et sélection d’une année",
      "0:15 · Choix des formats d’export PDF, Excel, CSV et JSON",
      "0:17 · Indicateurs, mesures, graphique agrandi, tableau et carte de chaleur",
      "0:48 · Analyses : catégories, 3D et AR, puis les dix familles de graphiques",
      "1:24 · Plats : filtres, actions groupées, fiche détaillée et mesures",
      "1:48 · Planning : simulation du service, calendrier et changements à venir",
      "2:04 · Horaires : disponibilité, récurrence, jours et heures, puis annulation sans enregistrer"
    ]
  },
  en: {
    label: "Vistaire Studio demonstration video",
    caption: "2 min 18 in Studio · sped up 3× · silent · fictional data and simulated actions · French interface",
    playLabel: "Play video",
    transcript: "What the video shows",
    steps: [
      "0:00 · Overview, search, and light and dark themes",
      "0:09 · Reporting periods, calendar and selecting a year",
      "0:15 · PDF, Excel, CSV and JSON export format choices",
      "0:17 · Indicators, metrics, enlarged chart, data table and heatmap",
      "0:48 · Insights: categories, 3D and AR, then all ten chart families",
      "1:24 · Dishes: filters, batch actions, dish details and metrics",
      "1:48 · Planning: service simulation, calendar and upcoming changes",
      "2:04 · Schedules: availability, recurrence, days and times, then cancelling without saving"
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
          src="https://cdn.vistaire.ca/demo/dashboard-studio-3x-67468b94997f.mp4"
          poster="/images/demo-walkthrough/dashboard-studio-3x.webp"
          controls
          autoPlay
          playLabel={text.playLabel}
          sizes="(max-width: 700px) 94vw, (max-width: 1280px) 80vw, 1166px"
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

