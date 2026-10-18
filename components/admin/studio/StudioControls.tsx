"use client";
/** Adapted from the approved Vistaire v29 BeUI Input/Combobox/Switch/Checkbox
 * and AnimatedToastStack composition. MIT: docs/licenses/beui-MIT.txt.
 * Uses the existing controlled data/mutation contracts, never demo persistence.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronDown,
  Search,
  X,
  CircleCheck,
  AlertCircle,
} from "lucide-react";
import { useStudioLocale } from "./studioLocale";
import styles from "./StudioControls.module.css";

export function StudioSearch({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <label className={styles.search} data-component="beui-input">
      <span className={styles.srOnly}>{label}</span>
      <Search size={17} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function StudioCombobox({
  value,
  options,
  onChange,
  label,
  showLabel = false,
  searchIcon = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
  showLabel?: boolean;
  searchIcon?: boolean;
}) {
  const { t } = useStudioLocale();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const visible = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
    input.current?.focus();
  }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) =>
        !open
          ? 0
          : (index + (event.key === "ArrowDown" ? 1 : -1) + visible.length) %
            Math.max(1, visible.length),
      );
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActive(Math.max(0, visible.length - 1));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (visible[active]) choose(visible[active].value);
    }
  }
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  return (
    <div className={styles.combobox} ref={root} data-component="beui-combobox">
      <label
        className={showLabel ? styles.comboLabel : styles.srOnly}
        htmlFor={id}
      >
        {label}
      </label>
      <div
        className={styles.comboTrigger}
        onClick={() => {
          setOpen(true);
          input.current?.focus();
        }}
      >
        {searchIcon && <Search size={16} aria-hidden />}
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && visible[active] ? `${id}-${active}` : undefined
          }
          value={open ? query : (selected?.label ?? "")}
          placeholder={selected?.label ?? label}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={keyboard}
        />
        <ChevronDown size={16} aria-hidden />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.comboPanel}
            initial={reduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.15 }}
          >
            <div
              role="listbox"
              aria-label={label}
              id={`${id}-list`}
              className={styles.comboList}
            >
              {visible.length ? (
                visible.map((option, index) => (
                  <div
                    id={`${id}-${index}`}
                    key={option.value}
                    role="option"
                    aria-selected={option.value === value}
                    data-active={index === active}
                    className={styles.comboOption}
                    onPointerMove={() => setActive(index)}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(option.value)}
                  >
                    {option.label}
                    {option.value === value && <Check size={16} aria-hidden />}
                  </div>
                ))
              ) : (
                <p className={styles.comboEmpty}>{t("Aucun résultat")}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export function StudioSwitch({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  return (
    <span className={styles.switch} data-component="beui-switch">
      <motion.button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        initial={false}
      >
        <motion.div
          layout={!reduced}
          animate={{ scale: pressed && !disabled && !reduced ? 0.9 : 1 }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 800, damping: 80, mass: 4 }
          }
        />
      </motion.button>
    </span>
  );
}
export function StudioCheckbox({
  checked,
  onCheckedChange,
  disabled,
  label,
  children,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const id = useId();
  return (
    <label
      className={styles.checkbox}
      htmlFor={id}
      data-component="beui-checkbox"
    >
      <motion.button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        whileTap={reduced || disabled ? undefined : { scale: 0.92 }}
      >
        <AnimatePresence initial={false}>
          {checked && (
            <motion.svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              aria-hidden
              initial={reduced ? false : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
            >
              <motion.path
                d="M5 13l4 4L19 7"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduced ? 0 : 0.3 }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>
      {children && <span>{children}</span>}
    </label>
  );
}
export function StudioToast({
  message,
  error = false,
  onClose,
}: {
  message: string;
  error?: boolean;
  onClose: () => void;
}) {
  const { t } = useStudioLocale();
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={styles.toast}
      role={error ? "alert" : "status"}
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.75 }}
      data-component="beui-toast-stack"
    >
      {error ? <AlertCircle size={19} /> : <CircleCheck size={19} />}
      <span>{message}</span>
      <button type="button" aria-label={t("Fermer")} onClick={onClose}>
        <X size={16} />
      </button>
    </motion.div>
  );
}
/** SmoothUI AnimatedTabs composition restored from the approved metric toolbar. */
export function StudioMetricTabs({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div
      role="group"
      aria-label={label}
      className={styles.tabs}
      data-component="smoothui-animated-tabs"
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (
              ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? options.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        options.length) %
                      options.length;
              onChange(options[next].value);
              (
                event.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }
          }}
        >
          {option.value === value && (
            <motion.span
              className={styles.tabIndicator}
              layoutId={`studio-tabs-${id}`}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 300, damping: 30 }
              }
              aria-hidden
            />
          )}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
