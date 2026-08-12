"use client";

import { useState } from "react";
import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import type { AdminRange } from "@/lib/admin/data/contracts";
import { AdminAssistantDrawer } from "./insights/AdminAssistantDrawer";

export function AdminAssistant({ locale, range }: { locale: AdminLocale; range: AdminRange }) {
  const [open, setOpen] = useState(false);
  const fr = locale === "fr";
  return <>
    <p>{fr ? "Posez une question sur les signaux anonymes réellement mesurés." : "Ask about anonymous signals that were actually measured."}</p>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
      {fr ? "Poser une question" : "Ask a question"}
    </button>
    {open ? <AdminAssistantDrawer locale={locale} range={range} onClose={() => setOpen(false)}/> : null}
  </>;
}
