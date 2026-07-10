"use client";

import Link from "next/link";
import { useState } from "react";

export function AdminMenuActions({ menuPath }: { menuPath: string }) {
  const [copied, setCopied] = useState(false);

  async function copyMenuLink() {
    const url = new URL(menuPath, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row" aria-live="polite">
      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-champagne px-5 text-sm font-semibold text-[#24160d] transition hover:bg-[#f0d9a9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        href={menuPath}
        prefetch={false}
      >
        Ouvrir menu client
      </Link>
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-transparent px-5 text-sm font-semibold text-cream transition hover:border-white/50 hover:bg-black/10"
        onClick={copyMenuLink}
        type="button"
      >
        {copied ? "Lien copié" : "Copier le lien menu"}
      </button>
      <form action="/admin/logout" method="post">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-transparent px-5 text-sm font-semibold text-cream transition hover:border-white/50 hover:bg-black/10"
          type="submit"
        >
          Déconnexion
        </button>
      </form>
    </div>
  );
}
