import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { DateTime } from "luxon";
import { createBattleMetricsClient } from "../services/battlemetrics.js";

const NETWORKS = ["survivors", "magic rust", "rust room", "atlas", "warbandits", "восток"];
const MONTHLY_NAME_PATTERN = /monthly|месяч/i;

export function inferSchedule(lastWipe, name, timezone = "Europe/Moscow") {
  if (!(lastWipe instanceof Date) || Number.isNaN(lastWipe.getTime())) {
    return null;
  }
  const local = DateTime.fromJSDate(lastWipe).setZone(timezone);
  if (!local.isValid) {
    return null;
  }
  const time = `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
  if (MONTHLY_NAME_PATTERN.test(name ?? "") || local.day <= 3) {
    return `type=monthly;week=1;day=${local.weekday};time=${time}`;
  }
  return `type=weekly;day=${local.weekday};time=${time}`;
}

async function main() {
  const apiKey = process.env.BATTLEMETRICS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing required environment variable BATTLEMETRICS_API_KEY");
  }
  const timezone = process.env.TIMEZONE?.trim() || "Europe/Moscow";
  const client = createBattleMetricsClient({ apiKey });
  const entries = [];
  const seen = new Set();
  for (const network of NETWORKS) {
    const servers = await client.searchServers(network);
    console.log(`[generate] "${network}": ${servers.length} server(s) found`);
    for (const server of servers) {
      if (server.id == null || !server.name || seen.has(server.id)) {
        continue;
      }
      seen.add(server.id);
      entries.push({
        id: server.id,
        label: server.name,
        network,
        schedule: inferSchedule(server.lastWipe, server.name, timezone),
      });
    }
  }
  entries.sort((a, b) => a.network.localeCompare(b.network) || a.label.localeCompare(b.label));
  await writeFile("servers.json", `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  console.log(`[generate] wrote ${entries.length} server(s) to servers.json`);
}

const isMain =
  process.argv[1] &&
  (() => {
    try {
      return import.meta.url === pathToFileURL(process.argv[1]).href;
    } catch {
      return false;
    }
  })();

if (isMain) {
  main().catch((error) => {
    console.error("[generate] failed", error);
    process.exitCode = 1;
  });
}
