import type { Locale } from "@/lib/i18n";
import { DemoWalkthroughVideo } from "./DemoWalkthroughVideo";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

export function DashboardWalkthrough({ locale }: { locale: Locale }) {
  const label = locale === "en"
    ? "Vistaire Studio demonstration video"
    : "Vidéo de démonstration du Studio Vistaire";
  return (
    <figure aria-label={label} className={styles.dashboardFilm} data-dashboard-walkthrough>
      <div className={styles.dashboardScreen} inert>
        <DemoWalkthroughVideo
          label={label}
          src="https://cdn.vistaire.ca/demo/dashboard-studio-3x-67468b94997f.mp4"
          poster="/images/demo-walkthrough/dashboard-studio-3x.webp"
          autoPlay
          disablePictureInPicture
          playbackRate={2}
          sizes="(max-width: 700px) 94vw, (max-width: 1280px) 80vw, 1166px"
        />
      </div>
    </figure>
  );
}
