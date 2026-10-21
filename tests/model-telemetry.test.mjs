import test from "node:test";
import assert from "node:assert/strict";
import { createModelTelemetry } from "../components/dish/modelTelemetry.ts";

test("model telemetry distinguishes load result from intent and bounds active visible time", () => {
  let now = 0;
  const events = [];
  const model = createModelTelemetry({
    now: () => now,
    emit: (event) => events.push(event),
  });
  model.start();
  model.start();
  now = 250;
  model.loaded();
  model.loaded();
  model.visibility(true);
  now = 1250;
  model.interact("rotate");
  now = 2250;
  model.visibility(false);
  now = 60000;
  model.flush();
  assert.deepEqual(
    events.map((x) => x.eventName),
    [
      "model_load_started",
      "model_load_succeeded",
      "model_interacted",
      "model_active_duration",
    ],
  );
  assert.equal(events[1].metadata.loadDurationMs, 250);
  assert.equal(events[3].metadata.durationMs, 2000);
  now = 61000;
  model.visibility(true);
  now = 100000;
  model.flush();
  assert.equal(
    events.filter((x) => x.eventName === "model_active_duration").length,
    1,
    "idle viewer adds no active duration",
  );
  model.interact("zoom");
  now = 102000;
  model.dispose();
  assert.equal(events.at(-1).metadata.durationMs, 2000);
});

test("AR external launch never invents successful presentation and outcomes deduplicate", () => {
  let now = 0;
  const events = [];
  const model = createModelTelemetry({
    now: () => now,
    emit: (event) => events.push(event),
  });
  model.arIntent();
  model.arOutcome("unknown");
  model.arOutcome("unknown");
  assert.deepEqual(
    events.map((x) => x.metadata.outcome),
    ["launched", "unknown"],
  );
  model.arOutcome("session-started");
  model.arOutcome("object-placed");
  model.arOutcome("ended");
  assert.deepEqual(
    events.slice(-3).map((x) => x.metadata.outcome),
    ["session-started", "object-placed", "ended"],
  );
  assert.equal(
    events.some((x) => x.metadata.outcome === "success"),
    false,
  );
});

test("load failure is bounded and terminal until a new actual attempt", () => {
  let now = 0;
  const events = [];
  const model = createModelTelemetry({
    now: () => now,
    emit: (event) => events.push(event),
  });
  model.start();
  now = 999999;
  model.failed("timeout");
  model.failed("load-failed");
  model.loaded();
  assert.equal(events.length, 2);
  assert.equal(events[1].metadata.loadDurationMs, 120000);
  model.visibility(true);
  now += 10000;
  model.dispose();
  assert.equal(events.length, 2);
});
