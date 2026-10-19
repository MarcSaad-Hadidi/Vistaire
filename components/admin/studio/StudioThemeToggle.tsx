"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sun, Moon } from "lucide-react";
import { createStudioThemeTransition } from "./studioThemeTransition";
import { useStudioLocale } from "./studioLocale";
import styles from "./StudioControls.module.css";
import "./studio-theme-transition.css";

/** Approved BeUI ThemeToggle: circle from center, with the original blur icon swap. */
export function StudioThemeToggle({
  theme,
  onChange,
}: {
  theme: "light" | "dark";
  onChange: (theme: "light" | "dark") => void;
}) {
  const { t } = useStudioLocale();
  const reduced = useReducedMotion();
  const current = useRef({ theme, onChange });
  useEffect(() => {
    current.current = { theme, onChange };
  }, [theme, onChange]);
  const [pending, setPending] = useState(false);
  const controller = useRef<ReturnType<
    typeof createStudioThemeTransition
  > | null>(null);
  useEffect(() => {
    let disposing = false;
    const transition = createStudioThemeTransition({
      document,
      getTheme: () => current.current.theme,
      setTheme: (next) =>
        disposing
          ? current.current.onChange(next)
          : flushSync(() => current.current.onChange(next)),
      onPendingChange: setPending,
    });
    controller.current = transition;
    return () => {
      disposing = true;
      transition.dispose();
      controller.current = null;
    };
  }, []);
  const label = t(
    theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre",
  );
  return (
    <button
      className={styles.themeToggle}
      type="button"
      data-component="beui-theme-toggle"
      aria-label={label}
      title={label}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={() =>
        controller.current?.toggle(
          Boolean(
            reduced ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          ),
        )
      }
    >
      <span className={styles.themeIcon}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={theme}
            aria-hidden
            initial={
              reduced ? false : { opacity: 0, scale: 0.25, filter: "blur(8px)" }
            }
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={
              reduced
                ? undefined
                : { opacity: 0, scale: 0.25, filter: "blur(8px)" }
            }
            transition={{ duration: reduced ? 0 : 0.2, ease: "easeInOut" }}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}
