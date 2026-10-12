const MS_PER_MINUTE = 60000;
const MINUTES_PER_DAY = 1440;

export function formatDuration(durationMs) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / MS_PER_MINUTE));
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days} д ${hours} ч ${minutes} мин`;
  }
  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  return `${minutes} мин`;
}
