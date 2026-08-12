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
  assert.match(cancel, /ADMIN_AVAILABILITY_SCHEDULING_ENABLED/);
  assert.match(cancel, /p_dish_id\s*:\s*dishId/);
  assert.match(cancel, /const\s+\{\s*dishId\s*,\s*scheduleId\s*\}/);
  assert.match(worker, /ADMIN_AVAILABILITY_WORKER_SECRET/);
  assert.match(worker, /ADMIN_AVAILABILITY_SCHEDULING_ENABLED/);
  assert.match(worker, /readBoundedJsonBody\(request,\s*1_024\)/);
  assert.match(worker, /content-type/);
  assert.match(worker, /mark_admin_availability_worker_attempt/);
  assert.match(worker, /run_due_admin_dish_availability/);
  assert.doesNotMatch(worker, /restaurantId|dishId/);
  assert.match(schedule, /revalidatePath\(scope\.publicMenuPath\)/);
  assert.match(cancel, /readPublishedMenuScope/);
  assert.match(cancel, /revalidatePath\(scope\.publicMenuPath\)/);
});

test("availability SQL gates exercise behavior rather than source shape only", async () => {
  const lifecycle = await readFile("tests/postgres/admin-availability-scheduling/lifecycle.test.sql", "utf8");
  const security = await readFile("tests/postgres/admin-availability-scheduling/security.test.sql", "utf8");
  const concurrency = await readFile("tests/postgres/admin-availability-scheduling/concurrency.test.sql", "utf8");
  const migration = await readFile("supabase/migrations/20260811190000_admin_availability_schedule.sql", "utf8");
  assert.match(lifecycle, /schedule_admin_dish_availability\s*\(/i);
  assert.match(lifecycle, /run_due_admin_dish_availability\s*\(/i);
  assert.match(lifecycle, /cancel_admin_dish_availability\s*\(/i);
  assert.match(lifecycle, /status\s*=\s*'applied'/i);
  assert.match(security, /set local role anon/i);
  assert.match(security, /set local role authenticated/i);
  assert.match(concurrency, /idempotency/i);
  assert.doesNotMatch(migration, /revoke all on all sequences in schema public/i);
  assert.match(migration, /mark_admin_availability_worker_attempt/i);
  assert.match(migration, /p_dish_id uuid,\s*p_schedule_id uuid/i);
  assert.match(migration, /status\s*=\s*case[\s\S]+then 'failed'[\s\S]+else 'pending'/i);
});
