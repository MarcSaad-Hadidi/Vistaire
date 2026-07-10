"use client";

import { useMemo, useState, useTransition } from "react";
import type { AdminRecommendation } from "@/lib/demoAdminInsights";

type AdminAssistantProps = {
  dailySummary: string;
  recommendations: AdminRecommendation[];
};

type AssistantResponse = {
  ok: boolean;
  answer?: string;
  error?: string;
};

const SUGGESTED_QUESTIONS = [
  "Quels plats attirent le plus les clients ?",
  "Qu'est-ce que les clients recherchent le plus ?",
  "Est-ce que les clients utilisent la vue immersive ?",
  "Quels plats reçoivent moins d'attention aujourd'hui ?"
];

async function requestAssistantAnswer(question: string): Promise<AssistantResponse> {
  try {
    const response = await fetch("/admin/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "question", question })
    });
    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? ((await response.json()) as AssistantResponse)
      : ({ ok: false } satisfies AssistantResponse);

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        error:
          data.error ??
          "L'assistant n'a pas pu lire l'activité du menu pour le moment."
      };
    }
    return data;
  } catch {
    return {
      ok: false,
      error: "L'assistant n'a pas pu lire l'activité du menu pour le moment."
    };
  }
}

export function AdminAssistant({
  dailySummary,
  recommendations
}: AdminAssistantProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleRecommendations = useMemo(
    () => recommendations.slice(0, 3),
    [recommendations]
  );

  function runAssistant(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion) {
      setNotice("Posez une question courte sur l'activité du menu.");
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const result = await requestAssistantAnswer(cleanQuestion);

      if (result.ok && result.answer) {
        setAnswer(result.answer);
        setQuestion(cleanQuestion);
        return;
      }

      setNotice(
        result.error ??
          "Recommandations automatiques basées sur l'activité du menu."
      );
    });
  }

  return (
    <section
      aria-labelledby="admin-assistant-heading"
      className="rounded-[13px] border border-white/[0.14] bg-black/[0.08] p-5 shadow-[inset_0_1px_0_rgba(255,250,240,0.12)] backdrop-blur-sm sm:p-6"
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase leading-relaxed tracking-[0.18em] text-champagne/80">
            Assistant Vistaire
          </p>
          <h2
            id="admin-assistant-heading"
            className="mt-3 font-display text-2xl leading-tight text-cream sm:text-3xl"
          >
            Votre analyste Vistaire lit les signaux clients anonymes.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#cdbfa9]">
            {dailySummary}
          </p>

          <form
            className="mt-5 flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              runAssistant();
            }}
          >
            <label className="sr-only" htmlFor="admin-assistant-question">
              Posez une question sur l&apos;activité du menu
            </label>
            <input
              id="admin-assistant-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 160))}
              placeholder="Question sur le service..."
              className="min-h-11 w-full min-w-0 rounded-full border border-white/14 bg-black/15 px-4 text-sm text-cream outline-none transition placeholder:text-[#756856] focus:border-champagne/45 focus:ring-2 focus:ring-champagne/20"
            />
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-transparent px-5 text-sm font-semibold text-cream shadow-[inset_0_1px_0_rgba(255,250,240,0.16)] transition hover:border-white/50 hover:bg-black/10 disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
            >
              {isPending ? "Lecture" : "Lire les signaux"}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => runAssistant(suggestion)}
                disabled={isPending}
                className="max-w-full rounded-full border border-white/[0.1] bg-white/[0.025] px-3 py-2 text-left text-xs leading-snug text-[#d2c4ad] transition [overflow-wrap:anywhere] hover:border-champagne/35 hover:text-cream disabled:cursor-wait disabled:opacity-65"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {answer ? (
            <div className="mt-4 rounded-lg border border-champagne/18 bg-champagne/[0.055] p-4">
              <p className="text-sm leading-relaxed text-[#eadcc6] [overflow-wrap:anywhere]">
                {answer}
              </p>
            </div>
          ) : null}

          {notice ? (
            <p className="mt-3 text-xs leading-relaxed text-[#9e8f7c]">
              {notice}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          {visibleRecommendations.map((recommendation, index) => (
            <article
              key={`${recommendation.type}-${recommendation.title}`}
              className="rounded-[12px] border border-white/[0.12] bg-black/[0.08] p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-champagne/30 bg-champagne/10 font-display text-sm text-champagne">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-champagne/75">
                    {recommendation.type}
                  </p>
                  <h3 className="mt-2 text-base font-semibold leading-snug text-cream [overflow-wrap:anywhere]">
                    {recommendation.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#a99a86] [overflow-wrap:anywhere]">
                    {recommendation.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
