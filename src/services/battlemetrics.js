import { DateTime } from "luxon";

const API_BASE_URL = "https://battlemetrics.ru/api/v1";
const SEARCH_RESULTS_PER_PAGE = 100;
const DEFAULT_CACHE_TTL_MS = 60000;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_ATTEMPTS = 2;

export class BattleMetricsError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message);
    this.name = "BattleMetricsError";
    this.status = status;
    this.cause = cause;
  }
}

function parseIsoDateUtc(value) {
  if (!value) {
    return null;
  }
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.toJSDate() : null;
}

function mapServer(raw) {
  return {
    id: raw?.id ?? null,
    name: raw?.name ?? null,
    address: raw?.address ?? null,
    map: raw?.map ?? null,
    players: raw?.players ?? null,
    maxPlayers: raw?.max_players ?? null,
    online: raw?.online ?? null,
    lastWipe: parseIsoDateUtc(raw?.last_wipe),
  };
}

function toBattleMetricsError(error) {
  if (error instanceof BattleMetricsError) {
    return error;
  }
  if (error?.name === "AbortError") {
    return new BattleMetricsError("BattleMetrics API request timed out", { cause: error });
  }
  return new BattleMetricsError(`BattleMetrics API request failed: ${error?.message ?? "unknown error"}`, {
    cause: error,
  });
}

export function createBattleMetricsClient({
  apiKey,
  fetchFn = globalThis.fetch,
  now = () => Date.now(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  const cache = new Map();

  async function requestOnce(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BattleMetricsError(`BattleMetrics API returned status ${response.status}`, {
          status: response.status,
        });
      }
      return await response.json();
    } catch (error) {
      throw toBattleMetricsError(error);
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(url) {
    const currentTime = now();
    const cached = cache.get(url);
    if (cached && currentTime - cached.at < cacheTtlMs) {
      return cached.data;
    }
    let lastError = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const data = await requestOnce(url);
        cache.set(url, { at: currentTime, data });
        return data;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async function searchServers(query) {
    const encoded = encodeURIComponent(query);
    const url = `${API_BASE_URL}/servers?game=rust&q=${encoded}&per_page=${SEARCH_RESULTS_PER_PAGE}`;
    const body = await request(url);
    if (!Array.isArray(body?.servers)) {
      throw new BattleMetricsError("BattleMetrics API returned an unexpected response shape");
    }
    return body.servers.map(mapServer);
  }

  return { searchServers };
}
