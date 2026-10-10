"use client";

import { useCallback, useId, useState } from "react";

type SeoFaqItemProps = {
  answer: string;
  initialOpen?: boolean;
  question: string;
};

export function SeoFaqItem({
  answer,
  initialOpen = false,
  question,
}: SeoFaqItemProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const reactId = useId();
  const buttonId = `seo-faq-question-${reactId}`;
  const answerId = `seo-faq-answer-${reactId}`;
  const markHydrated = useCallback((element: HTMLButtonElement | null) => {
    if (element) element.dataset.hydrated = "true";
  }, []);

  return (
    <article className="group px-5 py-6 sm:px-7 sm:py-7">
      <h3>
        <button
          ref={markHydrated}
          id={buttonId}
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-5 rounded-sm text-left font-display text-2xl font-normal leading-tight text-cream outline-none transition-colors hover:text-[#ffd60a] focus-visible:ring-2 focus-visible:ring-[#ffc300] focus-visible:ring-offset-4 focus-visible:ring-offset-[#111110] motion-reduce:transition-none"
          aria-controls={answerId}
          aria-expanded={isOpen}
          data-hydrated="false"
          data-seo-faq-question
          onClick={() => setIsOpen((open) => !open)}
        >
          <span>{question}</span>
          <svg
            aria-hidden="true"
            className={`size-5 shrink-0 text-[#ffc300] transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
            data-seo-faq-chevron
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="m5 7.5 5 5 5-5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </h3>
      <div id={answerId} data-seo-faq-answer hidden={!isOpen}>
        <p className="mt-4 max-w-[70ch] text-base leading-7 text-[#cec8bd]">
          {answer}
        </p>
      </div>
    </article>
  );
}
