"use client";

import { useId, useState } from "react";

type SeoFaqItemProps = {
  answer: string;
  initialOpen?: boolean;
  question: string;
};

export function SeoFaqItem({
  answer,
  initialOpen = false,
  question
}: SeoFaqItemProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const reactId = useId();
  const buttonId = `seo-faq-question-${reactId}`;
  const answerId = `seo-faq-answer-${reactId}`;

  return (
    <article className="group p-5 sm:p-6">
      <h3>
        <button
          id={buttonId}
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-5 rounded-md text-left font-display text-xl leading-tight text-cream outline-none transition-colors hover:text-[#f1d8a6] focus-visible:ring-2 focus-visible:ring-[#e8cf9b] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d0907] motion-reduce:transition-none"
          aria-controls={answerId}
          aria-expanded={isOpen}
          data-seo-faq-question
          onClick={() => setIsOpen((open) => !open)}
        >
          <span>{question}</span>
          <svg
            aria-hidden="true"
            className={`size-5 shrink-0 text-[#d7b978] transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
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
      <div
        id={answerId}
        role="region"
        aria-labelledby={buttonId}
        data-seo-faq-answer
        hidden={!isOpen}
      >
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#cdbfa9]">
          {answer}
        </p>
      </div>
    </article>
  );
}
