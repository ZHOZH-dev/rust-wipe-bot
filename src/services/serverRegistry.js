import { readFile } from "node:fs/promises";
import { parseSchedule } from "../config.js";

function normalizeEntry(raw, index) {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid server entry at index ${index}, expected an object`);
  }
  const id = Number(raw.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid server id "${raw.id}" at index ${index}`);
  }
  if (typeof raw.label !== "string" || !raw.label.trim()) {
    throw new Error(`Invalid label for server ${id} at index ${index}`);
  }
  if (typeof raw.network !== "string" || !raw.network.trim()) {
    throw new Error(`Invalid network for server ${id} at index ${index}`);
  }
  return {
    id,
    label: raw.label.trim(),
    network: raw.network.trim().toLowerCase(),
    schedule: raw.schedule ? parseSchedule(raw.schedule) : null,
  };
}

export function createRegistry(servers) {
  const byId = new Map(servers.map((server) => [server.id, server]));
  return {
    servers,
    byId,
    networks() {
      return [...new Set(servers.map((server) => server.network))];
    },
    byNetwork(network) {
      const key = network.toLowerCase();
      return servers.filter((server) => server.network === key);
    },
    autocomplete(query, limit = 25) {
      const needle = query.trim().toLowerCase();
      const pool = needle
        ? servers.filter((server) => server.label.toLowerCase().includes(needle))
        : servers;
      return pool.slice(0, limit);
    },
  };
}

export async function loadServerRegistry(path = "servers.json") {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Failed to read server registry "${path}": ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in server registry "${path}": ${error.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Server registry "${path}" must be a non-empty array`);
  }
  const servers = parsed.map(normalizeEntry);
  const seen = new Set();
  for (const server of servers) {
    if (seen.has(server.id)) {
      throw new Error(`Duplicate server id ${server.id} in "${path}"`);
    }
    seen.add(server.id);
  }
  return createRegistry(servers);
}
