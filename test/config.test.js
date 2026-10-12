import test from "node:test";
import assert from "node:assert/strict";
import { parseSchedule } from "../src/config.js";

test("parses a weekly schedule", () => {
  assert.deepEqual(parseSchedule("type=weekly;day=4;time=19:00"), {
    type: "weekly",
    day: 4,
    hour: 19,
    minute: 0,
  });
});

test("parses a monthly schedule", () => {
  assert.deepEqual(parseSchedule("type=monthly;week=1;day=4;time=14:00"), {
    type: "monthly",
    week: 1,
    day: 4,
    hour: 14,
    minute: 0,
  });
});

test("parses a fixed date schedule", () => {
  assert.deepEqual(parseSchedule("type=fixed;date=2026-11-05;time=14:00"), {
    type: "fixed",
    date: "2026-11-05",
    hour: 14,
    minute: 0,
  });
});

test("is tolerant to whitespace and key case", () => {
  assert.deepEqual(parseSchedule(" TYPE = Weekly ; DAY = 4 ; TIME = 19:00 "), {
    type: "weekly",
    day: 4,
    hour: 19,
    minute: 0,
  });
});

test("rejects an unknown schedule type", () => {
  assert.throws(() => parseSchedule("type=daily;time=19:00"), /weekly, monthly or fixed/);
});

test("rejects an out of range weekday", () => {
  assert.throws(() => parseSchedule("type=weekly;day=0;time=19:00"), /day/);
  assert.throws(() => parseSchedule("type=weekly;day=8;time=19:00"), /day/);
});

test("rejects an out of range monthly week", () => {
  assert.throws(() => parseSchedule("type=monthly;week=5;day=4;time=14:00"), /week/);
  assert.throws(() => parseSchedule("type=monthly;day=4;time=14:00"), /week/);
});

test("rejects an invalid time", () => {
  assert.throws(() => parseSchedule("type=weekly;day=4;time=25:00"), /time/);
  assert.throws(() => parseSchedule("type=weekly;day=4;time=9:5"), /time/);
  assert.throws(() => parseSchedule("type=weekly;day=4"), /time/);
});

test("rejects an invalid fixed date", () => {
  assert.throws(() => parseSchedule("type=fixed;date=05-11-2026;time=14:00"), /date/);
  assert.throws(() => parseSchedule("type=fixed;time=14:00"), /date/);
});
