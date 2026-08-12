import type { AdminPreferences } from "@/lib/admin/preferences";
import styles from "./AdminSystem.module.css";

export function AdminPreferencesControls({ preferences }: { preferences: AdminPreferences }) {
  const labels = preferences.locale === "fr"
    ? { language: "Langue", french: "Français", english: "English", theme: "Thème", light: "Clair", dark: "Sombre" }
    : { language: "Language", french: "French", english: "English", theme: "Theme", light: "Light", dark: "Dark" };

  return (
    <aside className={styles.adminPreferences} aria-label={preferences.locale === "fr" ? "Préférences d’affichage" : "Display preferences"}>
      <form action="/admin/preferences" method="post">
        <span>{labels.language}</span>
        <input name="kind" type="hidden" value="locale" />
        <button aria-pressed={preferences.locale === "fr"} name="value" type="submit" value="fr">{labels.french}</button>
        <button aria-pressed={preferences.locale === "en"} name="value" type="submit" value="en">{labels.english}</button>
      </form>
      <form action="/admin/preferences" method="post">
        <span>{labels.theme}</span>
        <input name="kind" type="hidden" value="theme" />
        <button aria-pressed={preferences.theme === "light"} name="value" type="submit" value="light">{labels.light}</button>
        <button aria-pressed={preferences.theme === "dark"} name="value" type="submit" value="dark">{labels.dark}</button>
      </form>
    </aside>
  );
}
