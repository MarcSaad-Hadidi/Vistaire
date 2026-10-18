"use client";

/*
 * Calendar interaction and presentation adapted from the approved BeUI picker.
 * Copyright (c) 2026 Saurabh Chauhan.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Popover } from "radix-ui";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { AdminDashboardRange, AdminObservationWindow } from "../../../lib/admin/dashboardRange.ts";
import styles from "./StudioDateRangePicker.module.css";

type DateValue = { from: string; to: string };
type DateDraft = { from: string; to?: string } | null;
type Locale = "fr" | "en";
type View = "days" | "months" | "years";
type DateError =
  "start" | "end" | "invalid" | "order" | "future" | "duration" | "unavailable";
const DAY = 86_400_000;
const firstCalendarDate = "0001-01-01";
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const monthOf = (date: string) => `${date.slice(0, 7)}-01`;
function dateTime(date: string) {
  const time = Date.parse(`${date}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(time) &&
    iso(time) === date
    ? time
    : NaN;
}
function shiftMonth(date: string, amount: number) {
  const value = new Date(dateTime(monthOf(date)));
  value.setUTCMonth(value.getUTCMonth() + amount);
  const last = new Date(value);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  value.setUTCDate(Math.min(Number(date.slice(8)), last.getUTCDate()));
  return iso(value.getTime());
}

// This shared public/admin control must not import the private admin runtime.
// Keep this date-only preview arithmetic aligned with the server range contract.
function studioDateWindow(range: AdminDashboardRange, now: Date) {
  let end = now.getTime();
  let start: number;
  const custom = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(range);
  if (custom && dateTime(custom[1]) < end) {
    start = dateTime(custom[1]);
    end = Math.min(dateTime(custom[2]) + DAY, end);
  } else if (range === "today-utc") start = dateTime(iso(end));
  else if (range === "month") start = dateTime(monthOf(iso(end)));
  else if (range === "year") start = dateTime(`${iso(end).slice(0, 4)}-01-01`);
  else
    start =
      end -
      ({ "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[range as "7d"] ?? 7) *
        DAY;
  const timestamp = (time: number) => new Date(time).toISOString();
  return {
    startInclusive: timestamp(start),
    endExclusive: timestamp(end),
    comparisonStartInclusive: timestamp(start - (end - start)),
    comparisonEndExclusive: timestamp(start),
  };
}

// Preserve the exact instants behind the displayed data until the user edits.
export function studioDatePreview(
  range: AdminDashboardRange,
  now: Date,
  observationWindow?: AdminObservationWindow,
) {
  const window = observationWindow ?? studioDateWindow(range, now);
  return {
    window,
    dayCount: Math.max(1, Math.ceil((Date.parse(window.endExclusive) - Date.parse(window.startInclusive)) / DAY)),
  };
}

// Presets keep the backend's rolling-window semantics, including partial UTC days.
export function studioDatePresets(now: Date, locale: Locale, demoEnd?: string) {
  const definitions: { range: AdminDashboardRange; label: string }[] = [
    { range: "today-utc", label: locale === "fr" ? "Aujourd’hui" : "Today" },
    { range: "7d", label: locale === "fr" ? "7 jours" : "7 days" },
    { range: "month", label: "MTD" },
    { range: "30d", label: locale === "fr" ? "30 jours" : "30 days" },
    { range: "year", label: "YTD" },
    { range: "365d", label: locale === "fr" ? "1 an" : "1 year" },
    { range: "90d", label: locale === "fr" ? "90 jours" : "90 days" },
  ];
  return definitions.map((definition) => {
    // The existing public fixture consists of complete UTC calendar days.
    // Anchor its previews to the supplied data, never a hard-coded demo date.
    if (demoEnd) {
      const days = {
        "today-utc": 1,
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "365d": 365,
      }[definition.range as "7d"];
      const from =
        definition.range === "month"
          ? monthOf(demoEnd)
          : definition.range === "year"
            ? `${demoEnd.slice(0, 4)}-01-01`
            : iso(dateTime(demoEnd) - ((days ?? 1) - 1) * DAY);
      return { ...definition, value: { from, to: demoEnd } };
    }
    const window = studioDateWindow(definition.range, now);
    return {
      ...definition,
      value: {
        from: window.startInclusive.slice(0, 10),
        to: iso(
          Math.max(
            Date.parse(window.startInclusive),
            Date.parse(window.endExclusive) - 1,
          ),
        ),
      },
    };
  });
}

export function selectStudioDate(value: DateDraft, date: string): DateDraft {
  if (!value || value.to) return { from: date };
  return value.from <= date
    ? { from: value.from, to: date }
    : { from: date, to: value.from };
}

export function studioDateRangeResult(
  value: DateDraft,
  preset: AdminDashboardRange | null,
  allowedRanges: readonly AdminDashboardRange[] | undefined,
  now: Date,
):
  | { range: AdminDashboardRange; error: null }
  | { range: null; error: DateError } {
  if (!value?.from) return { range: null, error: "start" };
  if (!value.to) return { range: null, error: "end" };
  const start = dateTime(value.from),
    end = dateTime(value.to);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    value.from < firstCalendarDate
  )
    return { range: null, error: "invalid" };
  if (end < start) return { range: null, error: "order" };
  if (value.to > iso(now.getTime())) return { range: null, error: "future" };
  if (end - start >= 730 * DAY) return { range: null, error: "duration" };
  const range: AdminDashboardRange =
    preset ?? `custom:${value.from}:${value.to}`;
  if (allowedRanges && !allowedRanges.includes(range))
    return { range: null, error: "unavailable" };
  return { range, error: null };
}

const errors: Record<Locale, Record<DateError, string>> = {
  fr: {
    start: "Choisissez une date de début.",
    end: "Choisissez une date de fin pour compléter la période.",
    invalid:
      "Une date est invalide. Choisissez des dates valides dans le calendrier.",
    order: "La date de début ne peut pas être postérieure à la date de fin.",
    future: "La date de fin ne peut pas dépasser aujourd’hui (UTC).",
    duration: "La période ne peut pas dépasser 730 jours.",
    unavailable: "Cette période n’est pas disponible dans la démo.",
  },
  en: {
    start: "Choose a start date.",
    end: "Choose an end date to complete the range.",
    invalid: "A date is invalid. Choose valid dates in the calendar.",
    order: "The start date cannot be after the end date.",
    future: "The end date cannot be later than today (UTC).",
    duration: "The range cannot exceed 730 days.",
    unavailable: "This range is not available in the demo.",
  },
};

export type StudioDateRangePickerProps = {
  value: DateValue;
  range: AdminDashboardRange;
  observationWindow?: AdminObservationWindow;
  onApply: (range: AdminDashboardRange) => void;
  allowedRanges?: readonly AdminDashboardRange[];
  locale?: Locale;
};

export function StudioDateRangePicker({
  value,
  range,
  observationWindow,
  onApply,
  allowedRanges,
  locale = "fr",
}: StudioDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [draft, setDraft] = useState<DateDraft>(value);
  const [draftChanged, setDraftChanged] = useState(false);
  const [preset, setPreset] = useState<AdminDashboardRange | null>(
    range.startsWith("custom:") ? null : range,
  );
  const [month, setMonth] = useState(() => monthOf(value.to));
  const [cursor, setCursor] = useState(value.to);
  const [preview, setPreview] = useState<string | null>(null);
  const [view, setView] = useState<View>("days");
  const [yearPage, setYearPage] = useState(Number(value.to.slice(0, 4)) - 11);
  const [choiceCursor, setChoiceCursor] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const monthTrigger = useRef<HTMLButtonElement>(null);
  const yearTrigger = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"date" | "choice" | "months" | "years" | null>(null);
  const headingId = useId(),
    statusId = useId(),
    calendarId = useId(),
    helpId = useId(),
    choicesId = useId();
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const intlLocale = locale === "fr" ? "fr-CA" : "en-CA";
  const format = (
    date: string,
    options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ) =>
    Number.isFinite(dateTime(date))
      ? new Intl.DateTimeFormat(intlLocale, {
          ...options,
          timeZone: "UTC",
        }).format(dateTime(date))
      : t("Choisir une date", "Choose a date");
  const label = `${format(value.from)} – ${format(value.to)}`;
  const max = iso(now.getTime());
  const maxYear = Number(max.slice(0, 4));
  const year = Number(month.slice(0, 4));
  const presets = studioDatePresets(
    now,
    locale,
    allowedRanges ? value.to : undefined,
  ).filter((item) => !allowedRanges || allowedRanges.includes(item.range));
  const canChooseDates =
    !allowedRanges || allowedRanges.some((item) => item.startsWith("custom:"));
  const result = studioDateRangeResult(draft, preset, allowedRanges, now);
  const comparisonPreview = result.range
    ? studioDatePreview(
        allowedRanges && draft?.to
          ? `custom:${draft.from}:${draft.to}`
          : result.range,
        now,
        draftChanged ? undefined : observationWindow,
      )
    : null;
  const comparison = comparisonPreview?.window;
  const dayCount = comparisonPreview?.dayCount;
  const shownRange =
    draft && !draft.to && preview ? selectStudioDate(draft, preview) : draft;
  const firstWeekday = new Date(dateTime(month)).getUTCDay();
  const daysInMonth = new Date(
    dateTime(shiftMonth(month, 1)) - DAY,
  ).getUTCDate();
  const dates = Array.from({ length: 42 }, (_, index) =>
    index >= firstWeekday && index < firstWeekday + daysInMonth
      ? iso(dateTime(month) + (index - firstWeekday) * DAY)
      : null,
  );
  const enabledDates = dates.filter(
    (date): date is string =>
      !!date && date <= max && date >= firstCalendarDate,
  );
  const activeDate = enabledDates.includes(cursor) ? cursor : enabledDates[0];
  const choices =
    view === "months"
      ? Array.from({ length: 12 }, (_, index) => {
          const date = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}-01`;
          return {
            id: date,
            label: format(date, { month: "long" }),
            disabled: date > monthOf(max),
            selected: date === month,
          };
        })
      : Array.from(
          { length: Math.min(12, maxYear - yearPage + 1) },
          (_, index) => ({
            id: String(yearPage + index),
            label: String(yearPage + index),
            disabled: false,
            selected: yearPage + index === year,
          }),
        );
  const activeChoice =
    choices[choiceCursor] && !choices[choiceCursor].disabled
      ? choiceCursor
      : Math.max(
          0,
          choices.findIndex((choice) => !choice.disabled),
        );
  const previousDisabled =
    view === "years"
      ? yearPage <= 1
      : view === "months"
        ? year <= 1
        : month <= monthOf(firstCalendarDate);
  const nextDisabled =
    view === "years"
      ? yearPage + 11 >= maxYear
      : view === "months"
        ? year >= maxYear
        : month >= monthOf(max);

  useLayoutEffect(() => {
    const target = focusNext.current;
    if (!target || !open) return;
    focusNext.current = null;
    if (target === "months")
      monthTrigger.current?.focus({ preventScroll: true });
    else if (target === "years")
      yearTrigger.current?.focus({ preventScroll: true });
    else
      content.current
        ?.querySelector<HTMLButtonElement>(
          target === "date"
            ? '[data-calendar-day][tabindex="0"]'
            : '[data-calendar-choice][tabindex="0"]',
        )
        ?.focus({ preventScroll: true });
  });

  function changeOpen(next: boolean) {
    setDraftChanged(false);
    setDraft({ ...value });
    setPreset(range.startsWith("custom:") ? null : range);
    setPreview(null);
    setView("days");
    if (next) {
      const current = new Date();
      const last =
        value.to > iso(current.getTime()) ? iso(current.getTime()) : value.to;
      setNow(current);
      setMonth(monthOf(last));
      setCursor(last);
    }
    setOpen(next);
  }
  function goTo(date: string, focus = false) {
    const next =
      date < firstCalendarDate ? firstCalendarDate : date > max ? max : date;
    setMonth(monthOf(next));
    setCursor(next);
    setPreview(null);
    if (focus) focusNext.current = "date";
  }
  function toggleChoices(next: "months" | "years") {
    if (view === next) {
      setView("days");
      focusNext.current = next;
      return;
    }
    const start = Math.max(1, Math.min(maxYear - 11, year - (year % 12)));
    setYearPage(start);
    setChoiceCursor(
      next === "months" ? Number(month.slice(5, 7)) - 1 : year - start,
    );
    setPreview(null);
    setView(next);
    focusNext.current = "choice";
  }
  function page(direction: number) {
    if (view === "years") {
      setYearPage(
        Math.max(1, Math.min(maxYear - 11, yearPage + direction * 12)),
      );
      setChoiceCursor(0);
    } else goTo(shiftMonth(month, direction * (view === "months" ? 12 : 1)));
  }
  function onDateKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const weekday = new Date(dateTime(date)).getUTCDay();
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    let next: string;
    if (event.key === "PageUp" || event.key === "PageDown")
      next = shiftMonth(
        date,
        (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1),
      );
    else if (event.key in offsets)
      next = iso(dateTime(date) + offsets[event.key] * DAY);
    else return;
    event.preventDefault();
    if (next < firstCalendarDate || next > max) return;
    goTo(next, true);
    if (draft && !draft.to) setPreview(next);
  }
  function onChoiceKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      focusNext.current = view === "months" ? "months" : "years";
      setView("days");
      return;
    }
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
    };
    let next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? choices.length - 1
          : event.key in offsets
            ? index + offsets[event.key]
            : null;
    if (next === null) return;
    event.preventDefault();
    const direction = next >= index ? 1 : -1;
    while (next >= 0 && next < choices.length && choices[next].disabled)
      next += direction;
    if (next < 0 || next >= choices.length) return;
    setChoiceCursor(next);
    focusNext.current = "choice";
  }
  function apply() {
    const checked = studioDateRangeResult(
      draft,
      preset,
      allowedRanges,
      new Date(),
    );
    if (!checked.range) return;
    setOpen(false);
    onApply(checked.range);
  }

  return (
    <div className={styles.picker} data-date-picker="beui">
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger
          className={styles.trigger}
          aria-label={`${t("Modifier la période d’analyse", "Change analysis period")} : ${label}`}
        >
          <CalendarDays size={16} aria-hidden="true" />
          <span>{label}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Content
          ref={content}
          className={styles.content}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={headingId}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const target = canChooseDates
              ? content.current?.querySelector<HTMLButtonElement>(
                  '[data-calendar-day][tabindex="0"]',
                )
              : content.current?.querySelector<HTMLButtonElement>(
                  '[data-preset][aria-pressed="true"]',
                );
            (
              target ??
              content.current?.querySelector<HTMLButtonElement>("button")
            )?.focus({ preventScroll: true });
          }}
        >
          <header className={styles.heading}>
            <span>{t("PÉRIODE D’ANALYSE", "ANALYSIS PERIOD")}</span>
            <strong id={headingId}>
              {t("Choisir les dates", "Choose dates")}
            </strong>
          </header>
          <div
            className={styles.presets}
            aria-label={t("Périodes rapides", "Quick ranges")}
          >
            {presets.map((item) => (
              <button
                type="button"
                key={item.range}
                data-preset
                aria-pressed={preset === item.range}
                className={styles.preset}
                onClick={() => {
                  setDraftChanged(true);
                  setDraft(item.value);
                  setPreset(item.range);
                  setView("days");
                  goTo(item.value.from);
                }}
              >
                {item.label}
              </button>
            ))}
            {canChooseDates && (
              <button
                type="button"
                className={`${styles.preset} ${styles.custom}`}
                aria-pressed={preset === null}
                onClick={() => {
                  setDraftChanged(true);
                  setDraft(null);
                  setPreset(null);
                  setPreview(null);
                  setView("days");
                  focusNext.current = "date";
                }}
              >
                {t("Personnalisé", "Custom")}
              </button>
            )}
          </div>
          <section
            className={styles.calendar}
            aria-label={t("Période d’analyse", "Analysis period")}
          >
            <div className={styles.summary}>
              <div>
                <p>{t("Date de début", "Start date")}</p>
                <strong>
                  {draft
                    ? format(draft.from)
                    : t("Choisir une date", "Choose a date")}
                </strong>
              </div>
              <ArrowRight size={14} aria-hidden="true" />
              <div>
                <p>{t("Date de fin", "End date")}</p>
                <strong>
                  {draft?.to
                    ? format(draft.to)
                    : t("Choisir une date", "Choose a date")}
                </strong>
              </div>
            </div>
            <div className={styles.calendarHeader}>
              <div>
                <button
                  ref={monthTrigger}
                  type="button"
                  hidden={view === "years"}
                  aria-label={t("Choisir le mois", "Choose month")}
                  aria-expanded={view === "months"}
                  aria-controls={view === "months" ? choicesId : undefined}
                  onClick={() => toggleChoices("months")}
                >
                  {format(month, { month: "long" })}
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
                <button
                  ref={yearTrigger}
                  type="button"
                  aria-label={t("Choisir l’année", "Choose year")}
                  aria-expanded={view === "years"}
                  aria-controls={view === "years" ? choicesId : undefined}
                  onClick={() => toggleChoices("years")}
                >
                  {view === "years"
                    ? `${yearPage}–${Math.min(yearPage + 11, maxYear)}`
                    : year}
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
              </div>
              <div>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={previousDisabled}
                  aria-label={
                    view === "years"
                      ? t("Années précédentes", "Previous years")
                      : view === "months"
                        ? t("Année précédente", "Previous year")
                        : t("Mois précédent", "Previous month")
                  }
                  onClick={() => page(-1)}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={nextDisabled}
                  aria-label={
                    view === "years"
                      ? t("Années suivantes", "Next years")
                      : view === "months"
                        ? t("Année suivante", "Next year")
                        : t("Mois suivant", "Next month")
                  }
                  onClick={() => page(1)}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <h3 id={calendarId} className={styles.srOnly} aria-live="polite">
              {format(month, { month: "long", year: "numeric" })}
            </h3>
            <p id={helpId} className={styles.srOnly}>
              {t(
                "Utilisez les flèches pour parcourir les dates, Début et Fin pour la semaine, Page précédente et Page suivante pour les mois, avec Maj pour les années. Entrée ou Espace sélectionne une date. Dans les choix de mois et d’année, utilisez les flèches et Échap pour revenir.",
                "Use arrow keys for dates, Home and End for the week, Page Up and Page Down for months, with Shift for years. Enter or Space selects a date. In month and year choices use arrows, and Escape to return.",
              )}
            </p>
            <div
              className={styles.gridArea}
              onPointerLeave={() => setPreview(null)}
            >
              {view === "days" ? (
                <table
                  role="grid"
                  className={styles.grid}
                  aria-labelledby={calendarId}
                  aria-describedby={`${helpId} ${statusId}`}
                >
                  <thead>
                    <tr>
                      {Array.from({ length: 7 }, (_, index) => {
                        const date = iso(
                          dateTime(month) - firstWeekday * DAY + index * DAY,
                        );
                        return (
                          <th
                            key={index}
                            scope="col"
                            abbr={format(date, { weekday: "long" })}
                          >
                            {format(date, { weekday: "short" })}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }, (_, week) => (
                      <tr key={week}>
                        {dates
                          .slice(week * 7, week * 7 + 7)
                          .map((date, column) => {
                            const shown = !!(
                              date &&
                              shownRange &&
                              date >= shownRange.from &&
                              date <= (shownRange.to ?? shownRange.from)
                            );
                            const selected = !!(
                              date &&
                              draft &&
                              date >= draft.from &&
                              date <= (draft.to ?? draft.from)
                            );
                            const endpoint = !!(
                              date &&
                              draft &&
                              (date === draft.from || date === draft.to)
                            );
                            const disabled =
                              !date ||
                              date > max ||
                              date < firstCalendarDate ||
                              !canChooseDates;
                            return (
                              <td
                                key={date ?? column}
                                role="gridcell"
                                aria-selected={date ? selected : undefined}
                                data-shown={shown || undefined}
                                data-start={
                                  (shown &&
                                    (column === 0 ||
                                      date === shownRange?.from)) ||
                                  undefined
                                }
                                data-end={
                                  (shown &&
                                    (column === 6 ||
                                      date === shownRange?.to ||
                                      !shownRange?.to)) ||
                                  undefined
                                }
                                data-endpoint-start={
                                  (shown &&
                                    endpoint &&
                                    (date === shownRange?.from ||
                                      column === 0)) ||
                                  undefined
                                }
                                data-endpoint-end={
                                  (shown &&
                                    endpoint &&
                                    (date ===
                                      (shownRange?.to ?? shownRange?.from) ||
                                      column === 6)) ||
                                  undefined
                                }
                                onPointerEnter={(event) => {
                                  if (
                                    event.pointerType !== "touch" &&
                                    date &&
                                    !disabled &&
                                    draft &&
                                    !draft.to
                                  )
                                    setPreview(date);
                                }}
                              >
                                {date && (
                                  <button
                                    type="button"
                                    data-calendar-day
                                    data-endpoint={endpoint || undefined}
                                    disabled={disabled}
                                    tabIndex={date === activeDate ? 0 : -1}
                                    aria-label={format(date, {
                                      weekday: "long",
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    })}
                                    aria-current={
                                      date === max ? "date" : undefined
                                    }
                                    onClick={() => {
                                      setDraftChanged(true);
                                      setDraft(selectStudioDate(draft, date));
                                      setPreset(null);
                                      setPreview(null);
                                      setCursor(date);
                                    }}
                                    onFocus={() => {
                                      setCursor(date);
                                      if (draft && !draft.to) setPreview(date);
                                    }}
                                    onKeyDown={(event) =>
                                      onDateKey(event, date)
                                    }
                                  >
                                    {Number(date.slice(8))}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <fieldset
                  id={choicesId}
                  className={styles.choices}
                  aria-label={
                    view === "months"
                      ? t(
                          `Choisir un mois de ${year}`,
                          `Choose a month in ${year}`,
                        )
                      : t(
                          `Choisir une année de ${yearPage} à ${Math.min(yearPage + 11, maxYear)}`,
                          `Choose a year from ${yearPage} to ${Math.min(yearPage + 11, maxYear)}`,
                        )
                  }
                >
                  {choices.map((choice, index) => (
                    <button
                      type="button"
                      key={choice.id}
                      data-calendar-choice
                      disabled={choice.disabled}
                      aria-pressed={choice.selected}
                      tabIndex={index === activeChoice ? 0 : -1}
                      onFocus={() => setChoiceCursor(index)}
                      onKeyDown={(event) => onChoiceKey(event, index)}
                      onClick={() => {
                        goTo(
                          view === "months"
                            ? choice.id
                            : `${choice.id.padStart(4, "0")}-${month.slice(5, 7)}-01`,
                        );
                        focusNext.current =
                          view === "months" ? "months" : "years";
                        setView("days");
                      }}
                    >
                      {choice.label}
                    </button>
                  ))}
                </fieldset>
              )}
            </div>
            <footer className={styles.footer}>
              <p>
                {dayCount
                  ? t(
                      `${dayCount} ${dayCount === 1 ? "jour sélectionné" : "jours sélectionnés"}`,
                      `${dayCount} ${dayCount === 1 ? "day" : "days"} selected`,
                    )
                  : draft
                    ? t("Choisir une date de fin", "Choose an end date")
                    : t("Choisir une date de début", "Choose a start date")}
              </p>
              <p
                id={statusId}
                className={styles.status}
                data-invalid={!!result.error || undefined}
                role="status"
                aria-live="polite"
              >
                {result.error
                  ? errors[locale][result.error]
                  : comparison
                    ? `${t("Comparaison", "Comparison")} : ${format(comparison.comparisonStartInclusive.slice(0, 10))} – ${format(iso(Date.parse(comparison.comparisonEndExclusive) - 1))}.`
                    : ""}
              </p>
              <p className={styles.hint}>
                {t(
                  "Les données restent inchangées jusqu’à l’application.",
                  "Data stays unchanged until you apply.",
                )}
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.cancel}
                  onClick={() => changeOpen(false)}
                >
                  {t("Annuler", "Cancel")}
                </button>
                <button
                  type="button"
                  className={styles.apply}
                  disabled={!!result.error}
                  aria-describedby={statusId}
                  onClick={apply}
                >
                  {t("Appliquer", "Apply")}
                </button>
              </div>
              {(!allowedRanges || allowedRanges.includes("30d")) && (
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() => {
                    setOpen(false);
                    onApply("30d");
                  }}
                >
                  {t("Effacer · rétablir 30 jours", "Clear · reset to 30 days")}
                </button>
              )}
            </footer>
          </section>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
