import { PublicFooterNavigation } from "@/components/vistaire-preview/PublicFooterNavigation";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, getVistaireSocialProfiles } from "@/lib/seo";

// The landing's footer at the end of every cinematic page's free reading.
export function CinematicFooter({ locale, id }: { locale: "fr" | "en"; id: string }) {
  const en = locale === "en";
  return (
    <footer className="cinematic-footer" id="contact" aria-labelledby={`${id}-footer-title`}>
      <h2 id={`${id}-footer-title`} className="sr-only">Contact</h2>
      <PublicFooterNavigation locale={locale} />
      <div className="footer-grid">
        <div>
          <span className="eyebrow">{en ? "A project?" : "Un projet ?"}</span>
          <p className="footer-place">{en ? "Montreal, Quebec, Canada" : "Montréal, Québec, Canada"}</p>
          <a href="mailto:contact@vistaire.ca">contact@vistaire.ca</a>
          <a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a>
        </div>
        <div>
          <span className="eyebrow">{en ? "Follow Vistaire" : "Suivre Vistaire"}</span>
          {getVistaireSocialProfiles().map((profile) => (
            <a href={profile.url} key={profile.url} target="_blank" rel="me noopener noreferrer">{profile.label}</a>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <span>{en ? "© 2026 Vistaire. All rights reserved." : "© 2026 Vistaire. Tous droits réservés."}</span>
      </div>
    </footer>
  );
}
