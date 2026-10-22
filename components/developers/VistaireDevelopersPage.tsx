import Link from "next/link";
import { VistaireLegalPage } from "@/components/legal/VistaireLegalPage";
import { DEVELOPERS_PAGE, DEVELOPERS_PATH, type DevelopersLocale } from "@/lib/developersPage";

// Renders `code` spans from the shared content strings.
function Inline({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/).map((part, index) => (part.startsWith("`") ? <code key={index}>{part.slice(1, -1)}</code> : part))}</>;
}

export function VistaireDevelopersPage({ locale }: { locale: DevelopersLocale }) {
  const page = DEVELOPERS_PAGE[locale];
  const other: DevelopersLocale = locale === "en" ? "fr" : "en";
  return (
    <VistaireLegalPage
      eyebrow={page.eyebrow}
      intro={page.intro}
      languageHref={DEVELOPERS_PATH[other]}
      languageLabel={other.toUpperCase()}
      locale={locale}
      title={page.title}
      updatedLabel={page.updatedLabel}
    >
      {page.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}><Inline text={paragraph} /></p>)}
          {section.items ? <ul>{section.items.map((item) => <li key={item}><Inline text={item} /></li>)}</ul> : null}
          {section.code ? <pre><code>{section.code}</code></pre> : null}
        </section>
      ))}
      <section>
        <h2>{page.resourcesHeading}</h2>
        <ul>
          {page.resources.map((resource) => (
            <li key={resource.path}>
              <Link href={resource.path} prefetch={false}>{resource.path}</Link> : {resource.text}
            </li>
          ))}
        </ul>
        <p>
          <Inline text={page.booking.text} />{" "}
          <Link href={page.booking.path} prefetch={false}>{page.booking.label}</Link>
        </p>
      </section>
    </VistaireLegalPage>
  );
}
