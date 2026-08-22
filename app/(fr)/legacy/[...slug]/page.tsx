import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LegacyPageProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateMetadata({
  params
}: LegacyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const legacyPath = `/legacy/${slug.join("/")}`;

  return {
    title: "Archive Vistaire",
    description:
      "Archive noindex d'une ancienne surface Vistaire remplacée par l'expérience production actuelle.",
    alternates: {
      canonical: legacyPath
    },
    robots: {
      index: false,
      follow: false,
      nocache: true
    }
  };
}

export default async function LegacyPage({ params }: LegacyPageProps) {
  const { slug } = await params;
  const archivedPath = `/${slug.join("/")}`;

  return (
    <main className="min-h-screen bg-[#0d0805] px-6 py-16 text-[#fff7ea]">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center rounded-[22px] border border-[#fffaf0]/20 bg-transparent p-8 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-[9px] sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#e8cf9b]/70">
          Archive Vistaire
        </p>
        <h1 className="mt-5 font-display text-4xl font-normal leading-tight text-[#fffaf0] sm:text-6xl">
          Cette ancienne page est conservee hors index.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#d8ccb7]">
          La route <span className="text-[#e8cf9b]">{archivedPath}</span> a ete
          remplacee par l&apos;experience Vistaire production actuelle. Cette archive
          reste volontairement sans lien public et en noindex.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-[#fffaf0]/35 px-5 py-3 text-sm font-semibold text-[#fffaf0] transition hover:border-[#fffaf0]/70"
            href="/"
            prefetch={false}
          >
            Retour a l&apos;accueil
          </Link>
          <Link
            className="rounded-full border border-[#e8cf9b]/45 px-5 py-3 text-sm font-semibold text-[#e8cf9b] transition hover:border-[#e8cf9b]/80"
            href="/prendre-rendez-vous"
            prefetch={false}
          >
            Prendre rendez-vous
          </Link>
        </div>
      </section>
    </main>
  );
}
