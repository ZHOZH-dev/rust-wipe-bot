import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import {
  buildNetworkFields,
  buildOverviewEmbed,
  buildOverviewField,
  buildSingleServerEmbed,
} from "../src/commands/wipe.js";

const MOSCOW = "Europe/Moscow";
const HOUR_MS = 3600000;

function utcInstant(isoUtc) {
  return DateTime.fromISO(isoUtc, { zone: "utc" }).toJSDate();
}

function makeEntry(overrides = {}) {
  return {
    id: 1,
    label: "Test Server",
    network: "atlas",
    schedule: { type: "weekly", day: 4, hour: 19, minute: 0 },
    ...overrides,
  };
}

function makeLiveServer(overrides = {}) {
  return {
    id: 1,
    name: "Test Server",
    address: "168.100.161.166:28015",
    map: "Procedural Map",
    players: 10,
    maxPlayers: 100,
    online: true,
    lastWipe: utcInstant("2026-10-11T17:00:00.000Z"),
    ...overrides,
  };
}

const now = DateTime.fromISO("2026-10-11T19:00:00", { zone: "utc" }).toMillis();

test("network fields rank servers by players and cap at 25", () => {
  const entries = Array.from({ length: 30 }, (_, index) => makeEntry({ id: index + 1 }));
  const liveServers = Array.from({ length: 30 }, (_, index) =>
    makeLiveServer({ id: index + 1, players: index })
  );
  const fields = buildNetworkFields(entries, liveServers, MOSCOW, 24, now);
  assert.equal(fields.length, 25);
  assert.equal(fields[0].name, "Test Server");
});

test("network field includes next wipe and recent last wipe", () => {
  const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
  const liveServers = [makeLiveServer({ id: 1, lastWipe: new Date(now - 2 * HOUR_MS) })];
  const fields = buildNetworkFields(entries, liveServers, MOSCOW, 24, now);
  assert.match(fields[0].value, /Следующий вайп: через/);
  assert.match(fields[0].value, /<t:\d+:F> \(<t:\d+:R>\)/);
  assert.match(fields[0].value, /С последнего вайпа прошло: 2 ч/);
  assert.doesNotMatch(fields[1].value, /С последнего вайпа прошло/);
});

test("network field includes the inline connect line when address is known", () => {
  const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
  const liveServers = [
    makeLiveServer({ id: 1 }),
    makeLiveServer({ id: 2, address: null }),
  ];
  const fields = buildNetworkFields(entries, liveServers, MOSCOW, 24, now);
  assert.match(fields[0].value, /`connect 168\.100\.161\.166:28015`/);
  assert.doesNotMatch(fields[1].value, /connect/);
});

test("network field hides the last wipe line beyond the threshold", () => {
  const entries = [makeEntry({ id: 1 })];
  const liveServers = [makeLiveServer({ id: 1, lastWipe: new Date(now - 25 * HOUR_MS) })];
  const fields = buildNetworkFields(entries, liveServers, MOSCOW, 24, now);
  assert.doesNotMatch(fields[0].value, /С последнего вайпа прошло/);
});

test("network field handles missing live data and schedule", () => {
  const fields = buildNetworkFields(
    [makeEntry({ id: 1, schedule: null }), makeEntry({ id: 2 })],
    [],
    MOSCOW,
    24,
    now
  );
  assert.match(fields[0].value, /расписание неизвестно/);
  assert.match(fields[1].value, /Следующий вайп: через/);
});

test("overview embed shows one field per network with earliest wipe, its server and connect block", () => {
  const summaries = [
    {
      network: "atlas",
      entries: [
        makeEntry({ id: 1, schedule: { type: "weekly", day: 7, hour: 20, minute: 0 } }),
        makeEntry({ id: 2, schedule: { type: "weekly", day: 3, hour: 15, minute: 0 } }),
        makeEntry({ id: 3, schedule: null }),
      ],
      liveServers: [
        makeLiveServer({ id: 1, lastWipe: new Date(now - 3 * HOUR_MS) }),
        makeLiveServer({ id: 2, lastWipe: null }),
      ],
    },
    {
      network: "survivors",
      entries: [makeEntry({ id: 4 })],
      liveServers: [makeLiveServer({ id: 4, lastWipe: new Date(now - 30 * HOUR_MS) })],
    },
  ];
  const embed = buildOverviewEmbed(summaries, MOSCOW, 24, now);
  const fields = embed.data.fields;
  assert.equal(fields.length, 2);
  assert.equal(fields[0].name, "Atlas");
  const expectedEarliest = DateTime.fromISO("2026-10-14T12:00:00", { zone: "utc" }).toMillis();
  const unix = Math.floor(expectedEarliest / 1000);
  assert.match(fields[0].value, new RegExp(`<t:${unix}:F>`));
  assert.match(fields[0].value, /Test Server/);
  assert.match(fields[0].value, /```connect 168\.100\.161\.166:28015```/);
  assert.match(fields[0].value, /С последнего вайпа прошло: 3 ч/);
  assert.match(fields[0].value, /Серверов: 3/);
  assert.equal(fields[1].name, "Survivors");
  assert.doesNotMatch(fields[1].value, /С последнего вайпа прошло/);
});

test("overview field hides the connect block when the nearest server has no address", () => {
  const field = buildOverviewField(
    "atlas",
    [makeEntry({ id: 1, schedule: { type: "weekly", day: 3, hour: 15, minute: 0 } })],
    [makeLiveServer({ id: 1, address: null })],
    MOSCOW,
    24,
    now
  );
  assert.match(field.value, /Test Server/);
  assert.doesNotMatch(field.value, /connect/);
});

test("overview field hides the connect block without live data", () => {
  const field = buildOverviewField(
    "atlas",
    [makeEntry({ id: 1, schedule: { type: "weekly", day: 3, hour: 15, minute: 0 } })],
    [],
    MOSCOW,
    24,
    now
  );
  assert.doesNotMatch(field.value, /connect/);
});

test("overview field falls back when no schedule is known", () => {
  const field = buildOverviewField("mirage", [makeEntry({ schedule: null })], [], MOSCOW, 24, now);
  assert.match(field.value, /расписание неизвестно/);
  assert.match(field.value, /Серверов: 1/);
});

test("single server embed shows next wipe, since wipe, connect and online", () => {
  const embed = buildSingleServerEmbed(
    makeEntry(),
    makeLiveServer({ lastWipe: new Date(now - 23 * HOUR_MS) }),
    MOSCOW,
    24,
    now
  );
  const fields = embed.data.fields;
  assert.equal(fields[0].name, "Следующий вайп");
  assert.match(fields[0].value, /Следующий вайп: через/);
  assert.equal(fields[1].name, "Последний вайп");
  assert.match(fields[1].value, /С последнего вайпа прошло: 23 ч/);
  assert.equal(fields[2].name, "Подключение");
  assert.equal(fields[2].value, "```connect 168.100.161.166:28015```");
  assert.equal(fields[3].name, "Онлайн");
  assert.match(fields[3].value, /10\/100 — Procedural Map/);
});

test("single server embed hides the connect field without an address", () => {
  const embed = buildSingleServerEmbed(
    makeEntry(),
    makeLiveServer({ address: null }),
    MOSCOW,
    24,
    now
  );
  const names = embed.data.fields.map((field) => field.name);
  assert.deepEqual(names, ["Следующий вайп", "Последний вайп", "Онлайн"]);
});

test("single server embed without live data shows only the schedule", () => {
  const embed = buildSingleServerEmbed(makeEntry(), null, MOSCOW, 24, now);
  const fields = embed.data.fields;
  assert.equal(fields.length, 1);
  assert.match(fields[0].value, /Следующий вайп: через/);
});

test("single server embed handles an unknown schedule", () => {
  const embed = buildSingleServerEmbed(makeEntry({ schedule: null }), null, MOSCOW, 24, now);
  assert.match(embed.data.fields[0].value, /расписание неизвестно/);
});
