export type LocalScheduleResult = { ok: true; instant: string } | { ok: false; reason: "invalid-input" | "invalid-timezone" | "nonexistent-local-time" | "ambiguous-local-time" };

function partsAt(epochMs: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(epochMs));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function localScheduleToInstant(input: { date: string; time: string; timezone: string; disambiguation?: "earlier" | "later" }): LocalScheduleResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) return { ok: false, reason: "invalid-input" };
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(); } catch { return { ok: false, reason: "invalid-timezone" }; }
  const [year, month, day] = input.date.split("-").map(Number);
  const [hour, minute] = input.time.split(":").map(Number);
  if (hour > 23 || minute > 59) return { ok: false, reason: "invalid-input" };
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const candidates: number[] = [];
  for (let delta = -14 * 60; delta <= 14 * 60; delta += 15) {
    const epoch = guess + delta * 60_000;
    const parts = partsAt(epoch, input.timezone);
    if (parts.year === String(year).padStart(4, "0") && parts.month === String(month).padStart(2, "0") && parts.day === String(day).padStart(2, "0") && parts.hour === String(hour).padStart(2, "0") && parts.minute === String(minute).padStart(2, "0")) candidates.push(epoch);
  }
  const unique = [...new Set(candidates)].sort((a, b) => a - b);
  if (!unique.length) return { ok: false, reason: "nonexistent-local-time" };
  if (unique.length > 1 && !input.disambiguation) return { ok: false, reason: "ambiguous-local-time" };
  const selected = input.disambiguation === "later" ? unique.at(-1)! : unique[0];
  return { ok: true, instant: new Date(selected).toISOString() };
}
