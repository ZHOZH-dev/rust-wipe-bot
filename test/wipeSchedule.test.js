import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import {
  calculateNextWipe,
  fixedWipeDate,
  nextMonthlyWipeDate,
  nextWeeklyWipeDate,
  shouldShowLastWipe,
} from "../src/services/wipeSchedule.js";

const MOSCOW = "Europe/Moscow";
const HOUR_MS = 3600000;

function instantInZone(zone, isoLocal) {
  return DateTime.fromISO(isoLocal, { zone }).toMillis();
}

test("weekly wipe later in the same week", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T23:50");
  const schedule = { type: "weekly", day: 4, hour: 19, minute: 0 };
  assert.equal(nextWeeklyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-15T19:00:00.000+03:00");
});

test("weekly wipe later the same day", () => {
  const now = instantInZone(MOSCOW, "2026-10-15T18:00");
  const schedule = { type: "weekly", day: 4, hour: 19, minute: 0 };
  assert.equal(nextWeeklyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-15T19:00:00.000+03:00");
});

test("weekly wipe exactly at the scheduled moment rolls to next week", () => {
  const now = instantInZone(MOSCOW, "2026-10-15T19:00");
  const schedule = { type: "weekly", day: 4, hour: 19, minute: 0 };
  assert.equal(nextWeeklyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-22T19:00:00.000+03:00");
});

test("weekly wipe after the scheduled time rolls to next week", () => {
  const now = instantInZone(MOSCOW, "2026-10-15T19:30");
  const schedule = { type: "weekly", day: 4, hour: 19, minute: 0 };
  assert.equal(nextWeeklyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-22T19:00:00.000+03:00");
});

test("weekly wipe crossing midnight", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T23:00");
  const schedule = { type: "weekly", day: 1, hour: 0, minute: 0 };
  assert.equal(nextWeeklyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-12T00:00:00.000+03:00");
});

test("weekly wipe from Monday to the Sunday of the same week", () => {
  const now = instantInZone(MOSCOW, "2026-10-12T10:00");
  const schedule = { type: "weekly", day: 7, hour: 15, minute: 0 };
  assert.equal(nextWeeklyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-18T15:00:00.000+03:00");
});

test("weekly wipe result differs between timezones at the same instant", () => {
  const now = DateTime.fromISO("2026-10-12T22:30:00", { zone: "utc" }).toMillis();
  const schedule = { type: "weekly", day: 2, hour: 0, minute: 30 };
  const inMoscow = nextWeeklyWipeDate(schedule, MOSCOW, now);
  const inUtc = nextWeeklyWipeDate(schedule, "utc", now);
  assert.equal(inMoscow.toISO(), "2026-10-20T00:30:00.000+03:00");
  assert.equal(inUtc.toISO(), "2026-10-13T00:30:00.000Z");
});

test("weekly wipe across a DST switch", () => {
  const now = instantInZone("Europe/Berlin", "2026-10-24T12:00");
  const schedule = { type: "weekly", day: 1, hour: 2, minute: 30 };
  assert.equal(nextWeeklyWipeDate(schedule, "Europe/Berlin", now).toISO(), "2026-10-26T02:30:00.000+01:00");
});

test("monthly first Thursday later the same day", () => {
  const now = instantInZone(MOSCOW, "2026-10-01T13:00");
  const schedule = { type: "monthly", week: 1, day: 4, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-01T14:00:00.000+03:00");
});

test("monthly first Thursday after the scheduled time moves to next month", () => {
  const now = instantInZone(MOSCOW, "2026-10-01T15:00");
  const schedule = { type: "monthly", week: 1, day: 4, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2026-11-05T14:00:00.000+03:00");
});

test("monthly wipe from late in the month rolls over", () => {
  const now = instantInZone(MOSCOW, "2026-10-29T10:00");
  const schedule = { type: "monthly", week: 1, day: 4, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2026-11-05T14:00:00.000+03:00");
});

test("monthly wipe rolls over the year boundary", () => {
  const now = instantInZone(MOSCOW, "2026-12-10T10:00");
  const schedule = { type: "monthly", week: 1, day: 4, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2027-01-07T14:00:00.000+03:00");
});

test("monthly wipe exactly at the scheduled moment moves to next month", () => {
  const now = instantInZone(MOSCOW, "2026-10-01T14:00");
  const schedule = { type: "monthly", week: 1, day: 4, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2026-11-05T14:00:00.000+03:00");
});

test("monthly second weekday of the month", () => {
  const now = instantInZone(MOSCOW, "2026-10-01T13:00");
  const schedule = { type: "monthly", week: 2, day: 4, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-08T14:00:00.000+03:00");
});

test("monthly fourth weekday rolls to the next month when passed", () => {
  const now = instantInZone(MOSCOW, "2026-10-23T00:00");
  const schedule = { type: "monthly", week: 4, day: 4, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2026-11-26T14:00:00.000+03:00");
});

test("monthly weekday earlier in the week than the first day of the month", () => {
  const now = instantInZone(MOSCOW, "2026-10-01T12:00");
  const schedule = { type: "monthly", week: 1, day: 1, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2026-10-05T14:00:00.000+03:00");
});

test("monthly weekday earlier than the first day of a month starting on Friday", () => {
  const now = instantInZone(MOSCOW, "2026-05-02T10:00");
  const schedule = { type: "monthly", week: 1, day: 1, hour: 14, minute: 0 };
  assert.equal(nextMonthlyWipeDate(schedule, MOSCOW, now).toISO(), "2026-05-04T14:00:00.000+03:00");
});

test("fixed wipe in the future", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T20:00");
  const schedule = { type: "fixed", date: "2026-11-05", hour: 14, minute: 0 };
  const result = calculateNextWipe(schedule, MOSCOW, now);
  assert.equal(result.date.toISOString(), "2026-11-05T11:00:00.000Z");
  assert.equal(result.isPast, false);
});

test("fixed wipe in the past is flagged", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T20:00");
  const schedule = { type: "fixed", date: "2026-10-01", hour: 14, minute: 0 };
  const result = calculateNextWipe(schedule, MOSCOW, now);
  assert.equal(result.isPast, true);
});

test("fixed wipe exactly at the current moment is flagged as past", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T20:00");
  const schedule = { type: "fixed", date: "2026-10-11", hour: 20, minute: 0 };
  const result = calculateNextWipe(schedule, MOSCOW, now);
  assert.equal(result.isPast, true);
});

test("fixed wipe time is interpreted in the configured timezone", () => {
  const schedule = { type: "fixed", date: "2026-11-05", hour: 14, minute: 0 };
  assert.equal(fixedWipeDate(schedule, MOSCOW).toMillis(), DateTime.fromISO("2026-11-05T11:00:00", { zone: "utc" }).toMillis());
  assert.equal(fixedWipeDate(schedule, "utc").toMillis(), DateTime.fromISO("2026-11-05T14:00:00", { zone: "utc" }).toMillis());
});

test("calculateNextWipe returns a Date object for weekly schedules", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T23:50");
  const schedule = { type: "weekly", day: 4, hour: 19, minute: 0 };
  const result = calculateNextWipe(schedule, MOSCOW, now);
  assert.ok(result.date instanceof Date);
  assert.equal(result.date.toISOString(), "2026-10-15T16:00:00.000Z");
  assert.equal(result.isPast, false);
});

test("shouldShowLastWipe within the threshold", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T19:00");
  assert.equal(shouldShowLastWipe(new Date(now - 2 * HOUR_MS), now, 24), true);
  assert.equal(shouldShowLastWipe(new Date(now - 23 * HOUR_MS), now, 24), true);
});

test("shouldShowLastWipe exactly at the 24 hour threshold still shows", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T19:00");
  assert.equal(shouldShowLastWipe(new Date(now - 24 * HOUR_MS), now, 24), true);
});

test("shouldShowLastWipe beyond the threshold is hidden", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T19:00");
  assert.equal(shouldShowLastWipe(new Date(now - 24 * HOUR_MS - 1), now, 24), false);
  assert.equal(shouldShowLastWipe(new Date(now - 25 * HOUR_MS), now, 24), false);
});

test("shouldShowLastWipe with a custom threshold", () => {
  const now = instantInZone(MOSCOW, "2026-10-11T19:00");
  assert.equal(shouldShowLastWipe(new Date(now - 5 * HOUR_MS), now, 6), true);
  assert.equal(shouldShowLastWipe(new Date(now - 7 * HOUR_MS), now, 6), false);
});

test("shouldShowLastWipe without a wipe date is hidden", () => {
  assert.equal(shouldShowLastWipe(null, Date.now(), 24), false);
});
