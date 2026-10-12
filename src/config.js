import "dotenv/config";
import { DateTime } from "luxon";

const DEFAULT_TIMEZONE = "Europe/Moscow";
const DEFAULT_THRESHOLD_HOURS = 24;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

function parseTimeValue(raw) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw ?? "");
  if (!match) {
    throw new Error(`Invalid time "${raw}" in WIPE_SCHEDULE, expected HH:mm`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Invalid time "${raw}" in WIPE_SCHEDULE`);
  }
  return { hour, minute };
}

function parseWeekday(raw) {
  const day = Number(raw);
  if (!Number.isInteger(day) || day < 1 || day > 7) {
    throw new Error(`Invalid day "${raw}" in WIPE_SCHEDULE, expected integer 1-7 (1 = Monday, 7 = Sunday)`);
  }
  return day;
}

function parseSchedule(raw) {
  const fields = {};
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    if (key) fields[key] = value;
  }
  const type = fields.type?.toLowerCase();
  if (type === "weekly") {
    return {
      type,
      day: parseWeekday(fields.day),
      ...parseTimeValue(fields.time),
    };
  }
  if (type === "monthly") {
    const week = Number(fields.week);
    if (!Number.isInteger(week) || week < 1 || week > 4) {
      throw new Error(`Invalid week "${fields.week}" in WIPE_SCHEDULE, expected integer 1-4`);
    }
    return {
      type,
      week,
      day: parseWeekday(fields.day),
      ...parseTimeValue(fields.time),
    };
  }
  if (type === "fixed") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date ?? "")) {
      throw new Error(`Invalid date "${fields.date}" in WIPE_SCHEDULE, expected YYYY-MM-DD`);
    }
    return {
      type,
      date: fields.date,
      ...parseTimeValue(fields.time),
    };
  }
  throw new Error(`Invalid WIPE_SCHEDULE type "${type ?? ""}", expected weekly, monthly or fixed`);
}

function parseThresholdHours(raw) {
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error(`Invalid LAST_WIPE_THRESHOLD_HOURS "${raw}", expected a positive number`);
  }
  return hours;
}

function parseTimezone(raw) {
  const zone = raw || DEFAULT_TIMEZONE;
  if (!DateTime.now().setZone(zone).isValid) {
    throw new Error(`Invalid TIMEZONE "${zone}"`);
  }
  return zone;
}

export function loadConfig() {
  return {
    discordToken: requireEnv("DISCORD_TOKEN"),
    clientId: requireEnv("CLIENT_ID"),
    guildId: process.env.GUILD_ID?.trim() || null,
    apiKey: requireEnv("BATTLEMETRICS_API_KEY"),
    timezone: parseTimezone(process.env.TIMEZONE),
    thresholdHours: parseThresholdHours(
      process.env.LAST_WIPE_THRESHOLD_HOURS || DEFAULT_THRESHOLD_HOURS
    ),
  };
}

export { parseSchedule };
