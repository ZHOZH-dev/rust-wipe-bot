import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { inferSchedule } from "../src/scripts/generate-servers.js";

const MOSCOW = "Europe/Moscow";

function utcInstant(isoUtc) {
  return DateTime.fromISO(isoUtc, { zone: "utc" }).toJSDate();
}

test("weekly inference from a mid-month wipe", () => {
  const lastWipe = utcInstant("2026-10-11T05:03:10.000Z");
  assert.equal(inferSchedule(lastWipe, "WARBANDITS.GG 2X", MOSCOW), "type=weekly;day=7;time=08:03");
});

test("weekly inference keeps the weekday from a Thursday wipe", () => {
  const lastWipe = utcInstant("2026-10-08T19:00:00.000Z");
  assert.equal(inferSchedule(lastWipe, "SOME SERVER", MOSCOW), "type=weekly;day=4;time=22:00");
});

test("monthly inference from a name keyword", () => {
  const lastWipe = utcInstant("2026-10-08T19:00:00.000Z");
  assert.equal(
    inferSchedule(lastWipe, "Atlas - EU 2X Monthly | Vanilla+", MOSCOW),
    "type=monthly;week=1;day=4;time=22:00"
  );
});

test("monthly inference from a wipe in the first days of the month", () => {
  const lastWipe = utcInstant("2026-10-01T18:01:34.000Z");
  assert.equal(inferSchedule(lastWipe, "ATLAS 2X", MOSCOW), "type=monthly;week=1;day=4;time=21:01");
});

test("monthly keyword wins even for a late-month wipe", () => {
  const lastWipe = utcInstant("2026-10-25T10:00:00.000Z");
  assert.equal(
    inferSchedule(lastWipe, "RUST ROOM Monthly", MOSCOW),
    "type=monthly;week=1;day=7;time=13:00"
  );
});

test("inference respects the configured timezone", () => {
  const lastWipe = utcInstant("2026-10-11T05:03:10.000Z");
  assert.equal(inferSchedule(lastWipe, "SERVER", "utc"), "type=weekly;day=7;time=05:03");
  assert.equal(inferSchedule(lastWipe, "SERVER", "Asia/Vladivostok"), "type=weekly;day=7;time=15:03");
});

test("no wipe date yields no schedule", () => {
  assert.equal(inferSchedule(null, "SERVER", MOSCOW), null);
});

test("invalid wipe date yields no schedule", () => {
  assert.equal(inferSchedule(new Date("not a date"), "SERVER", MOSCOW), null);
});
