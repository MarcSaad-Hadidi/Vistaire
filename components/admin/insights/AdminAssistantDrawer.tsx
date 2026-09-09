"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import type { AdminRange } from "@/lib/admin/data/contracts";
import styles from "./AdminInsights.module.css";

type AssistantBlock = Readonly<{
  kind: string;
  label: string;
  value?: string;
  ranking?: readonly Readonly<{ label: string; count: number; rank: number }>[];
  delta?: number;
  evidenceIds: readonly string[];
}>;
type AssistantResponse = Readonly<{
  ok?: boolean;
  source?: "mistral" | "rules";
  status?: string;
  blocks?: readonly AssistantBlock[];
  error?: string;
}>;

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export function AdminAssistantDrawer({ locale, range, onClose }: { locale: AdminLocale; range: AdminRange; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const fr = locale === "fr";
  const number = new Intl.NumberFormat(fr ? "fr-CA" : "en-CA");

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    node?.querySelector<HTMLInputElement>("#assistant-question")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [onClose]);

  function submit() {
    const clean = question.replace(/\s+/g, " ").trim().slice(0, 220);
    if (!clean) return;
    startTransition(async () => {
      try {
        const requestBody = { mode: "question", locale, range, question: clean } as const;
        const result = await fetch("/admin/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });
        const payload = result.headers.get("content-type")?.includes("application/json")
          ? await result.json() as AssistantResponse
          : { ok: false };
        setResponse(result.ok ? payload : { ok: false, error: payload.error });
      } catch {
        setResponse({ ok: false, error: fr ? "Assistant momentanément indisponible." : "Assistant temporarily unavailable." });
      }
    });
  }

  return <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} className={styles.assistantDrawer} role="dialog" aria-modal="true" aria-labelledby="assistant-drawer-title">
      <header><div><span>Vistaire Assistant</span><h2 id="assistant-drawer-title">{fr ? "Lire les signaux du menu" : "Read menu signals"}</h2></div><button type="button" onClick={onClose} aria-label={fr ? "Fermer l’assistant" : "Close assistant"}>×</button></header>
      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label htmlFor="assistant-question">{fr ? "Votre question" : "Your question"}</label>
        <input id="assistant-question" value={question} maxLength={220} onChange={(event) => setQuestion(event.target.value)} placeholder={fr ? "Quels signaux sont mesurés ?" : "Which signals are measured?"}/>
        <button type="submit" disabled={pending}>{pending ? (fr ? "Lecture…" : "Reading…") : (fr ? "Analyser" : "Analyze")}</button>
      </form>
      <div className={styles.drawerAnswer} aria-live="polite" aria-busy={pending}>
        {response?.blocks?.map((block, index) => <article key={`${block.kind}-${index}`}><strong>{block.label}</strong>{block.value ? <p>{block.value}{block.delta !== undefined ? ` · ${block.delta > 0 ? "+" : ""}${block.delta}` : ""}</p> : null}{block.ranking ? <ol className={styles.assistantRanking}>{block.ranking.map((entry) => <li key={`${entry.rank}-${entry.label}`}><span>{entry.rank}. {entry.label}</span><strong>{number.format(entry.count)}</strong></li>)}</ol> : null}<small className={styles.srOnly}>{block.evidenceIds.join(", ")}</small></article>)}
        {response?.source ? <p className={styles.answerSource}>{fr ? "Source" : "Source"}: {response.source}</p> : null}
        {response?.error ? <p role="alert">{response.error}</p> : null}
      </div>
    </div>
  </div>;
}
