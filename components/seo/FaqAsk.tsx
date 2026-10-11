"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./FaqAsk.module.css";

type FaqAskResult = {
  question: string;
  status: string;
  answer: string;
  sources: Array<{ title: string; href: string | null }>;
};

const COPY = {
  fr: {
    label: "Une autre question ?",
    placeholder: "Posez votre question sur Vistaire",
    submit: "Envoyer la question",
    loading: "Recherche dans la documentation Vistaire…",
    source: "Source",
    sources: "Sources",
    tooShort: "Écrivez au moins 5 caractères.",
    unavailable: "La question libre est momentanément indisponible. Les réponses ci-dessus restent accessibles."
  },
  en: {
    label: "Another question?",
    placeholder: "Ask your question about Vistaire",
    submit: "Send question",
    loading: "Searching the Vistaire documentation…",
    source: "Source",
    sources: "Sources",
    tooShort: "Write at least 5 characters.",
    unavailable: "Free questions are temporarily unavailable. The answers above remain available."
  }
} as const;

const MIN_LENGTH = 5;
const MAX_LENGTH = 300;

function normalizeQuestion(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function FaqAsk({ locale = "fr", compact = false }: { locale?: Locale; compact?: boolean }) {
  const copy = COPY[locale];
  const reactId = useId();
  const inputId = `faq-ask-${reactId}`;
  const noteId = `faq-ask-note-${reactId}`;
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<FaqAskResult | null>(null);
  const [hint, setHint] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const asked = normalizeQuestion(question);
    if (asked.length < MIN_LENGTH) {
      setHint(copy.tooShort);
      return;
    }
    if (asked === pending) return;

    // One active question: a newer submit cancels the older request.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setHint("");
    setResult(null);
    setPending(asked);

    let next: FaqAskResult = { question: asked, status: "unavailable", answer: copy.unavailable, sources: [] };
    try {
      const response = await fetch("/api/public/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: asked, locale }),
        signal: controller.signal
      });
      const data = (await response.json()) as Partial<FaqAskResult>;
      if (typeof data.answer === "string" && typeof data.status === "string") {
        next = {
          question: asked,
          status: data.status,
          answer: data.answer,
          sources: Array.isArray(data.sources) ? data.sources : []
        };
      }
    } catch {
      if (controller.signal.aborted) return;
    }
    if (controllerRef.current !== controller) return;
    controllerRef.current = null;
    setPending(null);
    setResult(next);
  }

  // An edited question hides the answer that belonged to the previous wording.
  const visibleResult = result && result.question === normalizeQuestion(question) ? result : null;

  return (
    <div className={compact ? `${styles.root} ${styles.compact}` : styles.root} data-faq-ask>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.label} htmlFor={inputId}>
          {copy.label}
        </label>
        <div className={styles.field}>
          <input
            id={inputId}
            className={styles.input}
            type="text"
            name="question"
            value={question}
            maxLength={MAX_LENGTH}
            placeholder={copy.placeholder}
            autoComplete="off"
            enterKeyHint="send"
            aria-describedby={hint ? noteId : undefined}
            aria-invalid={hint ? true : undefined}
            onChange={(event) => {
              setQuestion(event.target.value);
              if (hint) setHint("");
            }}
            data-faq-ask-input
          />
          <button
            className={styles.submit}
            type="submit"
            aria-label={copy.submit}
            disabled={question.trim().length === 0}
            data-faq-ask-submit
          >
            {pending ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : (
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
        {hint ? (
          <p id={noteId} className={styles.note}>
            <span className={styles.hint}>{hint}</span>
          </p>
        ) : null}
      </form>

      <div className={styles.result} aria-live="polite" aria-busy={pending ? true : undefined} data-faq-ask-result>
        {pending ? <p className={styles.loading}>{copy.loading}</p> : null}
        {visibleResult ? (
          <div className={styles.answerBlock} data-faq-ask-status={visibleResult.status}>
            <p className={styles.answer}>{visibleResult.answer}</p>
            {visibleResult.sources.length ? (
              <p className={styles.sources}>
                <span>{visibleResult.sources.length > 1 ? copy.sources : copy.source}</span>
                {visibleResult.sources.map((source) =>
                  source.href && /^\/(?![/\\])/.test(source.href) ? (
                    <a key={source.title} href={source.href}>
                      {source.title}
                    </a>
                  ) : (
                    <span key={source.title}>{source.title}</span>
                  )
                )}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
