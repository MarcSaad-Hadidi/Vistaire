"use client";

import { ChevronRightIcon } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import styles from "./SeoFaq.module.css";

// Adapted from the official @reui/c-accordion-10 (radix-nova) registry block:
// https://reui.io/r/radix-nova/c-accordion-10.json
// Registry IconPlaceholder is resolved to its lucide ChevronRightIcon.
export function SeoFaqItem({ answer, question, value }: { answer: string; question: string; value: string }) {
  return (
    <AccordionItem value={value} className={styles.item}>
      <AccordionTrigger
        className={`flex-row-reverse items-center justify-end gap-3 py-3 hover:no-underline *:data-[slot=accordion-trigger-icon]:hidden ${styles.trigger}`}
        data-hydrated="true"
        data-seo-faq-question
      >
        <span>{question}</span>
        <ChevronRightIcon
          aria-hidden="true"
          data-seo-faq-chevron
          className={`size-4 shrink-0 transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-90 ${styles.chevron}`}
        />
      </AccordionTrigger>
      <AccordionContent className={`ps-7 leading-relaxed ${styles.answer}`} data-seo-faq-answer role={undefined}>
        {answer}
      </AccordionContent>
    </AccordionItem>
  );
}
