"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { StudioDialog } from "./StudioDialog";
import "./StudioPlanning.css";

type Rule = { type: "weekly" | "once"; days: number[]; date?: string; start: string; end: string; available: boolean };
type Schedule = { dish_id: string; base_available: boolean; manual_override: boolean | null; revision: number; rules: Rule[] };
type History = { id: string; kind: string; occurred_at: string; dish_id: string | null; before_value: unknown; after_value: unknown };
type PlanningData = { ok: true; timezone: string | null; schedules: Schedule[]; history: History[] };
type Draft = { requestId: string; schedule: Schedule; timezone: string; expectedTimezone: string | null };
const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const dateFromKey = (key: string) => new Date(`${key}T12:00:00Z`);
function shiftDay(key: string, amount: number) {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayKey(date);
}
function restaurantToday(timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((part) => parts.find((item) => item.type === part)?.value).join("-");
}
function weekStart(key: string) {
  return shiftDay(key, -((dateFromKey(key).getUTCDay() + 6) % 7));
}
function dateLabel(key: string) {
  return dateFromKey(key).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}
function isOnDay(rule: Rule, date: string) {
  return rule.type === "once" ? rule.date === date : rule.days.includes(((dateFromKey(date).getUTCDay() + 6) % 7) + 1);
}
function valueLabel(value: unknown): string {
  if (value === true) return "Disponible";
  if (value === false) return "Indisponible";
  if (value === null) return "Planification automatique";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value) ?? "—";
}

export function StudioPlanning({ dishes, canWrite, initialDishId }: { dishes: { id: string; name: string }[]; canWrite: boolean; initialDishId?: string }) {
  const formId = useId();
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [week, setWeek] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const saveLock = useRef(false);
  const openedDish = useRef<string | undefined>(undefined);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/admin/api/scheduling", { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(response.status === 503 ? "La planification est indisponible pour ce restaurant. Aucun horaire n’a été chargé." : "Impossible de charger la planification. Réessayez.");
      setError("");
      setData(result);
      if (canWrite && initialDishId && openedDish.current !== initialDishId) {
        const schedule = (result as PlanningData).schedules.find((item) => item.dish_id === initialDishId);
        if (schedule) {
          openedDish.current = initialDishId;
          setDraft({ requestId: crypto.randomUUID(), timezone: result.timezone ?? "", expectedTimezone: result.timezone, schedule: { ...schedule, rules: schedule.rules.map((rule) => ({ ...rule, days: [...rule.days] })) } });
        }
      }
      if (result.timezone) setWeek((current) => current ?? weekStart(restaurantToday(result.timezone)));
    } catch (reason) {
      if (signal?.aborted) return;
      setData(null);
      setError(reason instanceof Error ? reason.message : "Impossible de charger la planification.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [canWrite, initialDishId]);
  useEffect(() => {
    const controller = new AbortController();
    // Loading synchronizes this view with the scheduling API; state changes follow the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function refresh() { setLoading(true); setError(""); void load(); }
  function openEditor(dishId?: string, date?: string) {
    const schedule = data?.schedules.find((item) => item.dish_id === (dishId ?? dishes[0]?.id));
    if (!schedule || !canWrite) return;
    const copy: Schedule = { ...schedule, rules: schedule.rules.map((rule) => ({ ...rule, days: [...rule.days] })) };
    if (date) copy.rules.push({ type: "once", days: [], date, start: "18:00", end: "22:00", available: true });
    setDraft({ requestId: crypto.randomUUID(), schedule: copy, timezone: data?.timezone ?? "", expectedTimezone: data?.timezone ?? null });
    setFormError("");
  }
  function updateRule(index: number, update: Partial<Rule>) {
    setDraft((current) => current && ({ ...current, schedule: { ...current.schedule, rules: current.schedule.rules.map((rule, position) => position === index ? { ...rule, ...update } : rule) } }));
  }
  async function save() {
    if (!draft || saveLock.current || !canWrite) return;
    const timezone = draft.timezone.trim();
    try { if (!timezone) throw new Error(); new Intl.DateTimeFormat("fr", { timeZone: timezone }).format(); }
    catch { setFormError("Renseignez un fuseau horaire IANA valide, par exemple Europe/Paris ou America/Montreal."); return; }
    for (const rule of draft.schedule.rules) {
      if (!rule.start || !rule.end || rule.start === rule.end || (rule.type === "weekly" && !rule.days.length) || (rule.type === "once" && !rule.date)) {
        setFormError("Chaque horaire doit avoir des heures différentes et au moins un jour ou une date."); return;
      }
    }
    saveLock.current = true;
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/admin/api/scheduling", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dishId: draft.schedule.dish_id, timezone, expectedTimezone: draft.expectedTimezone, baseAvailable: draft.schedule.base_available, manualOverride: draft.schedule.manual_override, rules: draft.schedule.rules, expectedRevision: draft.schedule.revision, requestId: draft.requestId }) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(response.status === 409 ? "Ce planning ou le fuseau du restaurant a changé. Fermez ce formulaire et actualisez pour charger les valeurs enregistrées avant de réessayer." : "L’enregistrement a échoué. Vos modifications ne sont pas confirmées.");
      setDraft(null);
      setNotice(result.revalidation === "retry-required" ? "Planification enregistrée. L’actualisation du menu public est en attente." : "Planification enregistrée.");
      await load();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "L’enregistrement a échoué.");
    } finally { saveLock.current = false; setSaving(false); }
  }

  const today = data?.timezone ? restaurantToday(data.timezone) : null;
  const dates = week ? Array.from({ length: 7 }, (_, index) => shiftDay(week, index)) : [];
  const dishName = (id: string) => dishes.find((dish) => dish.id === id)?.name ?? "Plat supprimé";
  return <div className="studio-planning">
    <header className="planning-heading"><div><h2>Le bon plat, au bon moment.</h2><p>Organisez vos services récurrents et vos disponibilités ponctuelles.</p></div><button type="button" className="planning-primary" disabled={!canWrite || !data || !data.schedules.length || loading} onClick={() => openEditor()}>Gérer les horaires</button></header>
    {!canWrite && <p>Lecture seule</p>}
    {notice && <p role="status">{notice}</p>}
    {loading && <p role="status">Chargement de la planification…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={refresh}>Réessayer</button></div>}
    {data && !loading && <>
      <div className="planning-hint"><strong>{data.timezone ? `Fuseau du restaurant : ${data.timezone}` : "Fuseau horaire non configuré"}</strong><p>{data.timezone ? "Les horaires utilisent l’heure locale du restaurant. Une fin avant le début se poursuit le lendemain. Un choix manuel reste actif jusqu’au retour à la planification." : "Configurez le fuseau horaire dans « Gérer les horaires » avant de planifier un service. Aucun fuseau n’est choisi automatiquement."}</p><button type="button" onClick={refresh}>Actualiser</button></div>
      {dates.length > 0 && data.timezone && <section className="planning-panel" aria-label="Calendrier hebdomadaire">
        <div className="week-toolbar"><h2>{dateLabel(dates[0])} — {dateLabel(dates[6])}</h2><div className="planning-navigation"><button type="button" aria-label="Semaine précédente" onClick={() => setWeek(shiftDay(dates[0], -7))}>←</button><button type="button" onClick={() => today && setWeek(weekStart(today))}>Cette semaine</button><button type="button" aria-label="Semaine suivante" onClick={() => setWeek(shiftDay(dates[0], 7))}>→</button></div></div>
        <div className="calendar">{dates.map((date, index) => <section key={date} className={`day ${date === today ? "today" : ""}`} aria-label={dateLabel(date)}><h3 className="day-header">{weekdays[index]}<strong>{Number(date.slice(-2))}</strong></h3><div className="day-events">{data.schedules.flatMap((schedule) => schedule.rules.flatMap((rule, position) => {
          const starts = isOnDay(rule, date);
          const carries = rule.end < rule.start && isOnDay(rule, shiftDay(date, -1));
          if (!starts && !carries) return [];
          return <button type="button" key={`${schedule.dish_id}-${position}`} className={`event ${rule.type}`} disabled={!canWrite} onClick={() => openEditor(schedule.dish_id)}><span>{starts ? `${rule.start} — ${rule.end}${rule.end < rule.start ? " (+1 jour)" : ""}` : `Suite de la veille · jusqu’à ${rule.end}`}</span><strong>{dishName(schedule.dish_id)}</strong><span>{rule.available ? "Disponible" : "Indisponible"} · {rule.type === "weekly" ? "Récurrent" : "Exception"}{schedule.manual_override !== null ? " · choix manuel actif" : ""}</span>{starts && carries && <span>Également jusqu’à {rule.end} depuis la veille</span>}</button>;
        }))}{canWrite && <button type="button" className="addday" aria-label={`Ajouter un horaire le ${dateLabel(date)}`} disabled={!data.schedules.length} onClick={() => openEditor(undefined, date)}>+</button>}</div></section>)}</div>
      </section>}
      <section className="planning-panel planning-history"><h2>Historique de la carte</h2><p className="planning-muted">Les 100 derniers changements enregistrés au maximum.</p>{data.history.length ? <ol>{data.history.map((event) => <li key={event.id}><strong>{event.dish_id ? dishName(event.dish_id) : "Carte"}</strong><span>{({ availability: "Disponibilité", schedule: "Planning", price: "Prix", promotion: "Promotion", "menu-version": "Version de la carte" } as Record<string, string>)[event.kind] ?? event.kind} · {new Date(event.occurred_at).toLocaleString("fr-FR", { timeZone: data.timezone ?? "UTC" })}{data.timezone ? "" : " UTC"}</span><details><summary>Voir le changement</summary><p>Avant : {valueLabel(event.before_value)}</p><p>Après : {valueLabel(event.after_value)}</p></details></li>)}</ol> : <p>Aucun changement enregistré.</p>}</section>
    </>}
    {draft && <StudioDialog title="Gérer les horaires" onClose={() => { if (!saveLock.current) setDraft(null); }}><form className="studio-planning planning-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={saving}><div className="planning-field"><label htmlFor={`${formId}-dish`}> Plat</label><select id={`${formId}-dish`} value={draft.schedule.dish_id} onChange={(event) => { const schedule = data?.schedules.find((item) => item.dish_id === event.target.value); if (schedule) setDraft({ ...draft, schedule: { ...schedule, rules: schedule.rules.map((rule) => ({ ...rule, days: [...rule.days] })) } }); }}>{dishes.filter((dish) => data?.schedules.some((schedule) => schedule.dish_id === dish.id)).map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}</select></div>
        <label>Fuseau horaire du restaurant<input required value={draft.timezone} placeholder="Europe/Paris" onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /></label><p className="planning-muted">Ce fuseau s’applique à tous les plats du restaurant.</p>{draft.timezone.trim() !== draft.expectedTimezone && <p role="status" className="planning-hint">L’enregistrement changera le fuseau horaire de tous les horaires du restaurant, y compris ceux des autres plats.</p>}
        <div className="planning-form-row"><div className="planning-field"><label htmlFor={`${formId}-base`}> En dehors des horaires</label><select id={`${formId}-base`} value={String(draft.schedule.base_available)} onChange={(event) => setDraft({ ...draft, schedule: { ...draft.schedule, base_available: event.target.value === "true" } })}><option value="true">Disponible</option><option value="false">Indisponible</option></select></div><div className="planning-field"><label htmlFor={`${formId}-manual`}> Choix manuel</label><select id={`${formId}-manual`} value={draft.schedule.manual_override === null ? "auto" : String(draft.schedule.manual_override)} onChange={(event) => setDraft({ ...draft, schedule: { ...draft.schedule, manual_override: event.target.value === "auto" ? null : event.target.value === "true" } })}><option value="auto">Suivre la planification</option><option value="true">Toujours disponible</option><option value="false">Toujours indisponible</option></select></div></div>
        {draft.schedule.manual_override !== null && <div className="planning-hint">Le choix manuel prime sur les horaires.<button type="button" onClick={() => setDraft({ ...draft, schedule: { ...draft.schedule, manual_override: null } })}>Revenir à la planification</button><span>Enregistrez pour appliquer ce changement.</span></div>}
        <h3>Horaires · {draft.schedule.rules.length}</h3>{draft.schedule.rules.map((rule, index) => <fieldset className="planning-rule" key={index}><legend>Horaire {index + 1}</legend><div className="planning-form-row"><div className="planning-field"><label htmlFor={`${formId}-type-${index}`}> Répétition</label><select id={`${formId}-type-${index}`} value={rule.type} onChange={(event) => updateRule(index, { type: event.target.value as Rule["type"], days: [], date: undefined })}><option value="weekly">Chaque semaine</option><option value="once">Une date précise</option></select></div><div className="planning-field"><label htmlFor={`${formId}-available-${index}`}> Disponibilité</label><select id={`${formId}-available-${index}`} value={String(rule.available)} onChange={(event) => updateRule(index, { available: event.target.value === "true" })}><option value="true">Disponible</option><option value="false">Indisponible</option></select></div></div>
          {rule.type === "once" ? <label>Date<input type="date" required value={rule.date ?? ""} onChange={(event) => updateRule(index, { date: event.target.value })} /></label> : <div className="planning-days" role="group" aria-label={`Jours de l’horaire ${index + 1}`}>{weekdays.map((day, dayIndex) => <label key={day}><input type="checkbox" checked={rule.days.includes(dayIndex + 1)} onChange={(event) => updateRule(index, { days: event.target.checked ? [...rule.days, dayIndex + 1] : rule.days.filter((value) => value !== dayIndex + 1) })} />{day}</label>)}</div>}
          <div className="planning-form-row"><label>Heure de début<input required type="time" value={rule.start} onChange={(event) => updateRule(index, { start: event.target.value })} /></label><label>Heure de fin<input required type="time" value={rule.end} onChange={(event) => updateRule(index, { end: event.target.value })} /></label></div>{rule.end < rule.start && <p className="planning-muted">Se termine le lendemain.</p>}<button type="button" onClick={() => setDraft({ ...draft, schedule: { ...draft.schedule, rules: draft.schedule.rules.filter((_, position) => position !== index) } })} aria-label={`Supprimer l’horaire ${index + 1}`}>Supprimer</button>
        </fieldset>)}
        <button type="button" onClick={() => setDraft({ ...draft, schedule: { ...draft.schedule, rules: [...draft.schedule.rules, { type: "weekly", days: [], start: "18:00", end: "22:00", available: true }] } })}>+ Ajouter un horaire</button>
        <p className="planning-muted">Les heures sont locales au restaurant. Une fin avant le début indique le lendemain. Les exceptions datées priment sur les horaires récurrents. Dans un même groupe, « indisponible » l’emporte en cas de chevauchement. Les modifications et suppressions sont appliquées à l’enregistrement.</p>
      </fieldset>{formError && <p role="alert">{formError}</p>}<footer className="planning-footer"><button type="button" disabled={saving} onClick={() => setDraft(null)}>Annuler</button><button type="submit" disabled={saving} className="planning-primary">{saving ? "Enregistrement…" : "Enregistrer"}</button></footer>
    </form></StudioDialog>}
  </div>;
}
