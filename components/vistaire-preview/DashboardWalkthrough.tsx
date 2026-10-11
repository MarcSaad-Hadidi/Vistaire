import type { Locale } from "@/lib/i18n";
import { DemoWalkthroughVideo } from "./DemoWalkthroughVideo";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

const copy = {
  fr: {
    label: "Vidéo de démonstration du Studio Vistaire",
    caption: "2 min 08 dans le Studio · sans son · données fictives et actions simulées",
    playLabel: "Lire la vidéo",
    transcript: "Ce que montre la vidéo",
    steps: [
      "0:00 · Vue d’ensemble : indicateurs, période de 7 jours et dates personnalisées",
      "0:14 · Graphiques : mesure 3D, agrandissement, détail d’un point, légende et tableau des données",
      "0:28 · Analyses : catégories, classement, 3D et AR, jours, horaires, parcours et comparaison des profils",
      "0:48 · Plats : recherche, fiche détaillée, sélection des plats disponibles, action groupée et annulation",
      "1:11 · Horaires : choix hebdomadaire ou ponctuel, puis fermeture sans enregistrement",
      "1:23 · Planning : calendrier, changement de date et d’heure pour préparer le service dans la simulation",
      "1:35 · Exports : choix PDF, Excel, CSV ou JSON, période ou historique, puis téléchargement d’un PDF fictif",
      "1:59 · Retour à la vue d’ensemble et passage entre les thèmes clair et sombre"
    ]
  },
  en: {
    label: "Vistaire Studio demonstration video",
    caption: "2 min 08 in Studio · silent · fictional data and simulated actions · French interface",
    playLabel: "Play video",
    transcript: "What the video shows",
    steps: [
      "0:00 · Overview: metrics, a 7-day period and custom dates",
      "0:14 · Charts: 3D metric, enlarged view, point details, legend and data table",
      "0:28 · Insights: categories, ranking, 3D and AR, weekdays, hours, event flow and profile comparisons",
      "0:48 · Dishes: search, dish details, selecting available dishes, a batch action and undo",
      "1:11 · Schedules: weekly or one-time choices, then closing without saving",
      "1:23 · Planning: calendar, date and time changes to preview the service in the simulation",
      "1:35 · Exports: PDF, Excel, CSV or JSON, selected period or history, then downloading a fictional PDF",
      "1:59 · Returning to overview and switching between light and dark themes"
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
          autoPlay
          playLabel={text.playLabel}
          sizes="(max-width: 700px) 94vw, (max-width: 1280px) 80vw, 1168px"
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
