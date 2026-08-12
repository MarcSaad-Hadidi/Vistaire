import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const loadScheduling = () => import("../lib/admin/availability/scheduling.ts");

test("Toronto DST conversion rejects gaps and requires fold disambiguation", async () => {
  const { localScheduleToInstant } = await loadScheduling();
  assert.deepEqual(localScheduleToInstant({ date: "2026-03-08", time: "02:30", timezone: "America/Toronto" }), { ok: false, reason: "nonexistent-local-time" });
  assert.deepEqual(localScheduleToInstant({ date: "2026-11-01", time: "01:30", timezone: "America/Toronto" }), { ok: false, reason: "ambiguous-local-time" });
  const earlier = localScheduleToInstant({ date: "2026-11-01", time: "01:30", timezone: "America/Toronto", disambiguation: "earlier" });
  const later = localScheduleToInstant({ date: "2026-11-01", time: "01:30", timezone: "America/Toronto", disambiguation: "later" });
  assert.equal(earlier.ok && earlier.instant, "2026-11-01T05:30:00.000Z");
  assert.equal(later.ok && later.instant, "2026-11-01T06:30:00.000Z");
});

test("schedule and worker routes are narrow and fail closed", async () => {
  const schedule = await readFile("app/admin/api/dishes/[dishId]/availability/schedule/route.ts", "utf8");
  const cancel = await readFile("app/admin/api/dishes/[dishId]/availability/schedule/[scheduleId]/route.ts", "utf8");
  const worker = await readFile("app/api/internal/admin-availability-worker/route.ts", "utf8");
  assert.match(schedule, /dish:availability:write/);
  assert.match(schedule, /ADMIN_AVAILABILITY_SCHEDULING_ENABLED/);
  assert.doesNotMatch(schedule, /body\.restaurantId|body\.timezone/);
  assert.match(cancel, /cancel_admin_dish_availability/);
  assert.match(worker, /ADMIN_AVAILABILITY_WORKER_SECRET/);
  assert.match(worker, /run_due_admin_dish_availability/);
  assert.doesNotMatch(worker, /restaurantId|dishId/);
});
