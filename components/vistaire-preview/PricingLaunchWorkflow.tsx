"use client";

import { useEffect, useRef } from "react";
import type { PricingWorkflowContent } from "@/lib/pricingPage";
import baseStyles from "./VistairePricingPreview.module.css";
import styles from "./PricingPageExtensions.module.css";

export function PricingLaunchWorkflow({
  content
}: {
  content: PricingWorkflowContent;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion || !("IntersectionObserver" in window)) return;

    const rect = section.getBoundingClientRect();
    const alreadyVisible =
      rect.top <= window.innerHeight * 0.88 && rect.bottom >= 0;

    if (alreadyVisible) {
      section.dataset.motion = "visible";
      return;
    }

    section.dataset.motion = "ready";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        section.dataset.motion = "visible";
        observer.disconnect();
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.18
      }
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      aria-labelledby="pricing-workflow-title"
      className={styles.workflowSection}
      data-pricing-launch-workflow
      ref={sectionRef}
    >
      <header className={styles.workflowIntro}>
        <p className={baseStyles.eyebrow}>{content.eyebrow}</p>
        <h2 id="pricing-workflow-title">{content.title}</h2>
        <p>{content.body}</p>
      </header>

      <div className={styles.workflowTimeline}>
        <div aria-hidden="true" className={styles.workflowTrack}>
          <span className={styles.workflowTrackBase} />
          <span className={styles.workflowProgress} />
        </div>

        <ol className={styles.workflowList}>
          {content.steps.map((step) => (
            <li className={styles.workflowStep} key={step.index}>
              <span aria-hidden="true" className={styles.workflowMarker}>
                {step.index}
              </span>
              <div className={styles.workflowStepCopy}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className={styles.workflowLeadTime}>{content.leadTime}</p>
    </section>
  );
}
