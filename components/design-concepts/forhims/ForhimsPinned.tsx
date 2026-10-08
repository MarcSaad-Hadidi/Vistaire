"use client";

import { useRef } from "react";
import shared from "./shared.module.css";
import { PhoneFrame, useScrubProgress } from "./ForhimsMotion";
import { ScreenChapter, ScreenExperiences, ScreenLesson, ScreenSignatures } from "./ForhimsPhones";
import s from "./ForhimsPinned.module.css";

const STATES = [
  { word: 0, screen: <ScreenExperiences /> },
  { word: 0, screen: <ScreenChapter /> },
  { word: 1, screen: <ScreenLesson /> },
  { word: 2, screen: <ScreenSignatures /> }
];

const WORDS = [
  { text: "tout est…", color: "#a9dcc8" },
  { text: "…dans", color: "#7fb6e8" },
  { text: "la carte", color: "#7fb6e8" }
];

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export function ForhimsPinned() {
  const ref = useRef<HTMLElement | null>(null);
  const p = useScrubProgress(ref);

  const seg = p * STATES.length;
  // gradient panel fades in during the last state (like the reference)
  const gradientOn = clamp01((p - 0.62) / 0.2);

  return (
    <section ref={ref} className={s.wrap} aria-label="Tout est dans la carte">
      <div className={s.sticky}>
        <div className={s.bgWhite} style={{ opacity: 1 - gradientOn }} />
        <div className={s.bgGradient} style={{ opacity: gradientOn }} />
        {WORDS.map((w, i) => {
          const first = STATES.findIndex((st) => st.word === i);
          const last = STATES.length - 1 - [...STATES].reverse().findIndex((st) => st.word === i);
          const center = (first + last + 1) / 2;
          const span = last - first + 1;
          const o = clamp01(1 - (Math.abs(seg - center) / (span / 2)) * 0.9);
          return (
            <div
              key={w.text}
              className={`${shared.headline} ${s.giantWord}`}
              style={{ color: w.color, opacity: o }}
              aria-hidden="true"
            >
              {w.text}
            </div>
          );
        })}
        <div className={s.phoneStage}>
          {STATES.map((st, i) => {
            const o = clamp01(1 - Math.abs(seg - (i + 0.5)) * 1.7);
            return (
              <div key={i} className={s.phoneLayer} style={{ opacity: o, zIndex: o > 0.5 ? 2 : 1 }}>
                <PhoneFrame>{st.screen}</PhoneFrame>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
