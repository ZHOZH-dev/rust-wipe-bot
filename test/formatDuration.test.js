import test from "node:test";
import assert from "node:assert/strict";
import { formatDuration } from "../src/utils/formatDuration.js";

const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

test("zero and sub-minute durations render as minutes", () => {
  assert.equal(formatDuration(0), "0 мин");
  assert.equal(formatDuration(59999), "0 мин");
  assert.equal(formatDuration(MINUTE_MS), "1 мин");
});

test("durations under a day render as hours and minutes", () => {
  assert.equal(formatDuration(HOUR_MS), "1 ч 0 мин");
  assert.equal(formatDuration(HOUR_MS + 30 * MINUTE_MS), "1 ч 30 мин");
  assert.equal(formatDuration(23 * HOUR_MS + 59 * MINUTE_MS), "23 ч 59 мин");
});

test("exactly 24 hours renders with days", () => {
  assert.equal(formatDuration(DAY_MS), "1 д 0 ч 0 мин");
});

test("durations over 24 hours render with days", () => {
  assert.equal(formatDuration(DAY_MS + HOUR_MS), "1 д 1 ч 0 мин");
  assert.equal(formatDuration(2 * DAY_MS + 12 * HOUR_MS), "2 д 12 ч 0 мин");
});

test("negative durations clamp to zero", () => {
  assert.equal(formatDuration(-5000), "0 мин");
});
