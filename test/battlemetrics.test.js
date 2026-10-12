import test from "node:test";
import assert from "node:assert/strict";
import { createBattleMetricsClient, BattleMetricsError } from "../src/services/battlemetrics.js";

const rawList = {
  game: "rust",
  page: 1,
  per_page: 100,
  total: 2,
  pages: 1,
  servers: [
    {
      id: 50122287,
      game: "rust",
      name: "Test Rust Server",
      address: "168.100.161.166:28015",
      map: "Procedural Map",
      players: 10,
      max_players: 100,
      online: true,
      last_wipe: "2026-10-11T05:03:10.000Z",
    },
    {
      id: 50122288,
      game: "rust",
      name: "Other Server",
      map: "Barren",
      players: 5,
      max_players: 50,
      online: false,
      last_wipe: null,
    },
  ],
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function createRecordingFetch(handler) {
  const calls = [];
  const fetchFn = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve(handler(calls.length - 1, url, options));
  };
  return { calls, fetchFn };
}

test("searchServers maps snake_case fields and sends the bearer token", async () => {
  const { calls, fetchFn } = createRecordingFetch(() => jsonResponse(rawList));
  const client = createBattleMetricsClient({ apiKey: "bm_live_test", fetchFn });
  const servers = await client.searchServers("warbandits");
  assert.equal(servers.length, 2);
  assert.equal(servers[0].id, 50122287);
  assert.equal(servers[0].name, "Test Rust Server");
  assert.equal(servers[0].address, "168.100.161.166:28015");
  assert.equal(servers[0].map, "Procedural Map");
  assert.equal(servers[0].players, 10);
  assert.equal(servers[0].maxPlayers, 100);
  assert.equal(servers[0].online, true);
  assert.ok(servers[0].lastWipe instanceof Date);
  assert.equal(servers[0].lastWipe.toISOString(), "2026-10-11T05:03:10.000Z");
  assert.equal(servers[1].lastWipe, null);
  assert.equal(servers[1].address, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/v1\/servers\?game=rust&q=warbandits&per_page=100$/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer bm_live_test");
});

test("searchServers encodes the query", async () => {
  const { calls, fetchFn } = createRecordingFetch(() => jsonResponse(rawList));
  const client = createBattleMetricsClient({ apiKey: "key", fetchFn });
  await client.searchServers("Восток");
  assert.match(calls[0].url, /q=%D0%92%D0%BE%D1%81%D1%82%D0%BE%D0%BA/);
});

test("successful search is cached per query for the ttl window", async () => {
  const { calls, fetchFn } = createRecordingFetch(() => jsonResponse(rawList));
  let currentTime = 0;
  const client = createBattleMetricsClient({ apiKey: "key", fetchFn, now: () => currentTime });
  await client.searchServers("atlas");
  currentTime = 30000;
  await client.searchServers("atlas");
  assert.equal(calls.length, 1);
  await client.searchServers("survivors");
  assert.equal(calls.length, 2);
  currentTime = 60001;
  await client.searchServers("atlas");
  assert.equal(calls.length, 3);
});

test("failed requests are not cached", async () => {
  const { calls, fetchFn } = createRecordingFetch((index) =>
    index < 2 ? jsonResponse({}, 500) : jsonResponse(rawList)
  );
  let currentTime = 0;
  const client = createBattleMetricsClient({ apiKey: "key", fetchFn, now: () => currentTime });
  await assert.rejects(client.searchServers("atlas"));
  const servers = await client.searchServers("atlas");
  assert.equal(servers.length, 2);
  assert.equal(calls.length, 3);
});

test("request is retried once after a failure", async () => {
  const { calls, fetchFn } = createRecordingFetch((index) =>
    index === 0 ? jsonResponse({}, 500) : jsonResponse(rawList)
  );
  const client = createBattleMetricsClient({ apiKey: "key", fetchFn });
  const servers = await client.searchServers("atlas");
  assert.equal(servers.length, 2);
  assert.equal(calls.length, 2);
});

test("persistent failure throws BattleMetricsError with the status", async () => {
  const { calls, fetchFn } = createRecordingFetch(() => jsonResponse({}, 503));
  const client = createBattleMetricsClient({ apiKey: "key", fetchFn });
  await assert.rejects(
    client.searchServers("atlas"),
    (error) => {
      assert.ok(error instanceof BattleMetricsError);
      assert.equal(error.status, 503);
      assert.match(error.message, /503/);
      return true;
    }
  );
  assert.equal(calls.length, 2);
});

test("unexpected response shape throws BattleMetricsError", async () => {
  const { fetchFn } = createRecordingFetch(() => jsonResponse({ game: "rust" }));
  const client = createBattleMetricsClient({ apiKey: "key", fetchFn });
  await assert.rejects(
    client.searchServers("atlas"),
    (error) => {
      assert.ok(error instanceof BattleMetricsError);
      assert.match(error.message, /unexpected response/);
      return true;
    }
  );
});

test("timeout aborts the request and throws after retries", async () => {
  const fetchFn = (url, options) =>
    new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  const client = createBattleMetricsClient({ apiKey: "key", fetchFn, timeoutMs: 20 });
  await assert.rejects(
    client.searchServers("atlas"),
    (error) => {
      assert.ok(error instanceof BattleMetricsError);
      assert.match(error.message, /timed out/);
      return true;
    }
  );
});

test("network error is wrapped into BattleMetricsError", async () => {
  const fetchFn = async () => {
    throw new Error("ECONNRESET");
  };
  const client = createBattleMetricsClient({ apiKey: "key", fetchFn });
  await assert.rejects(
    client.searchServers("atlas"),
    (error) => {
      assert.ok(error instanceof BattleMetricsError);
      assert.match(error.message, /ECONNRESET/);
      return true;
    }
  );
});
