import { DateTime } from "luxon";

const MS_PER_HOUR = 3600000;

function nowInZone(timezone, now) {
  return DateTime.fromMillis(now, { zone: timezone });
}

function atScheduledTime(dayInZone, schedule) {
  return dayInZone.set({ hour: schedule.hour, minute: schedule.minute, second: 0, millisecond: 0 });
}

export function nextWeeklyWipeDate(schedule, timezone, now = Date.now()) {
  const from = nowInZone(timezone, now);
  const thisWeek = atScheduledTime(from.startOf("day").set({ weekday: schedule.day }), schedule);
  if (thisWeek > from) {
    return thisWeek;
  }
  return thisWeek.plus({ weeks: 1 });
}

function firstWeekdayOfMonth(monthStart, weekday) {
  const shifted = monthStart.set({ weekday });
  if (shifted < monthStart) {
    return shifted.plus({ weeks: 1 });
  }
  return shifted;
}

function nthWeekdayOfMonth(monthStart, schedule) {
  const firstOccurrence = firstWeekdayOfMonth(monthStart, schedule.day);
  return atScheduledTime(firstOccurrence.plus({ weeks: schedule.week - 1 }), schedule);
}

export function nextMonthlyWipeDate(schedule, timezone, now = Date.now()) {
  const from = nowInZone(timezone, now);
  const thisMonth = nthWeekdayOfMonth(from.startOf("month"), schedule);
  if (thisMonth > from) {
    return thisMonth;
  }
  return nthWeekdayOfMonth(from.startOf("month").plus({ months: 1 }), schedule);
}

export function fixedWipeDate(schedule, timezone) {
  const hour = String(schedule.hour).padStart(2, "0");
  const minute = String(schedule.minute).padStart(2, "0");
  return DateTime.fromISO(`${schedule.date}T${hour}:${minute}`, { zone: timezone });
}

export function calculateNextWipe(schedule, timezone, now = Date.now()) {
  if (schedule.type === "weekly") {
    return { date: nextWeeklyWipeDate(schedule, timezone, now).toJSDate(), isPast: false };
  }
  if (schedule.type === "monthly") {
    return { date: nextMonthlyWipeDate(schedule, timezone, now).toJSDate(), isPast: false };
  }
  const fixed = fixedWipeDate(schedule, timezone);
  return { date: fixed.toJSDate(), isPast: fixed.toMillis() <= now };
}

export function shouldShowLastWipe(lastWipeDate, now = Date.now(), thresholdHours = 24) {
  if (!lastWipeDate) {
    return false;
  }
  const elapsedMs = now - lastWipeDate.getTime();
  return elapsedMs <= thresholdHours * MS_PER_HOUR;
}
