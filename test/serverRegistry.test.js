import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRegistry, loadServerRegistry } from "../src/services/serverRegistry.js";

function makeEntry(overrides = {}) {
  return {
    id: 1,
    label: "Test Server",
    network: "atlas",
    schedule: "type=weekly;day=4;time=19:00",
    ...overrides,
  };
}

test("loadServerRegistry loads and normalizes a valid file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "registry-"));
  const path = join(dir, "servers.json");
  await writeFile(
    path,
    JSON.stringify([
      { id: 1, label: "A", network: "Atlas", schedule: "type=weekly;day=4;time=19:00" },
      { id: 2, label: "B", network: "atlas" },
    ]),
    "utf8"
  );
  const registry = await loadServerRegistry(path);
  assert.equal(registry.servers.length, 2);
  assert.equal(registry.servers[0].network, "atlas");
  assert.deepEqual(registry.servers[0].schedule, { type: "weekly", day: 4, hour: 19, minute: 0 });
  assert.equal(registry.servers[1].schedule, null);
  await rm(dir, { recursive: true, force: true });
});

test("loadServerRegistry rejects a missing file", async () => {
  await assert.rejects(
    loadServerRegistry("C:/definitely-missing/servers.json"),
    /Failed to read server registry/
  );
});

test("loadServerRegistry rejects invalid JSON", async () => {
  const dir = await mkdtemp(join(tmpdir(), "registry-"));
  const path = join(dir, "servers.json");
  await writeFile(path, "{not json", "utf8");
  await assert.rejects(loadServerRegistry(path), /Invalid JSON/);
  await rm(dir, { recursive: true, force: true });
});

test("loadServerRegistry rejects an empty or non-array file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "registry-"));
  const path = join(dir, "servers.json");
  await writeFile(path, "[]", "utf8");
  await assert.rejects(loadServerRegistry(path), /non-empty array/);
  await rm(dir, { recursive: true, force: true });
});

test("loadServerRegistry rejects invalid entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "registry-"));
  const path = join(dir, "servers.json");
  await writeFile(path, JSON.stringify([{ id: "abc", label: "A", network: "atlas" }]), "utf8");
  await assert.rejects(loadServerRegistry(path), /Invalid server id/);
  await rm(dir, { recursive: true, force: true });
});

test("loadServerRegistry rejects duplicate ids", async () => {
  const dir = await mkdtemp(join(tmpdir(), "registry-"));
  const path = join(dir, "servers.json");
  await writeFile(
    path,
    JSON.stringify([
      { id: 7, label: "A", network: "atlas" },
      { id: 7, label: "B", network: "atlas" },
    ]),
    "utf8"
  );
  await assert.rejects(loadServerRegistry(path), /Duplicate server id 7/);
  await rm(dir, { recursive: true, force: true });
});

test("loadServerRegistry rejects an invalid schedule string", async () => {
  const dir = await mkdtemp(join(tmpdir(), "registry-"));
  const path = join(dir, "servers.json");
  await writeFile(
    path,
    JSON.stringify([{ id: 1, label: "A", network: "atlas", schedule: "type=daily;time=19:00" }]),
    "utf8"
  );
  await assert.rejects(loadServerRegistry(path), /weekly, monthly or fixed/);
  await rm(dir, { recursive: true, force: true });
});

test("registry networks returns distinct network keys", () => {
  const registry = createRegistry([
    makeEntry({ id: 1, network: "atlas" }),
    makeEntry({ id: 2, network: "atlas" }),
    makeEntry({ id: 3, network: "survivors" }),
  ]);
  assert.deepEqual(registry.networks(), ["atlas", "survivors"]);
});

test("registry byNetwork is case-insensitive", () => {
  const registry = createRegistry([
    makeEntry({ id: 1, network: "atlas" }),
    makeEntry({ id: 2, network: "survivors" }),
  ]);
  assert.equal(registry.byNetwork("ATLAS").length, 1);
  assert.equal(registry.byNetwork("Atlas")[0].id, 1);
  assert.equal(registry.byNetwork("unknown").length, 0);
});

test("registry byId looks entries up", () => {
  const registry = createRegistry([makeEntry({ id: 42 })]);
  assert.equal(registry.byId.get(42).label, "Test Server");
  assert.equal(registry.byId.get(999), undefined);
});

test("registry autocomplete filters by label and caps results", () => {
  const servers = Array.from({ length: 30 }, (_, index) =>
    makeEntry({ id: index + 1, label: index < 3 ? `MIRAGE ${index}` : `OTHER ${index}`, network: "mirage" })
  );
  const registry = createRegistry(servers);
  assert.equal(registry.autocomplete("mirage").length, 3);
  assert.equal(registry.autocomplete("MIRAGE").length, 3);
  assert.equal(registry.autocomplete("").length, 25);
  assert.deepEqual(
    registry.autocomplete("").map((server) => server.id),
    Array.from({ length: 25 }, (_, index) => index + 1)
  );
});
