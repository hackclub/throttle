// Formats stored timestamps. Never reads the clock, so it's safe during render.
// Pinned to UTC so server and client agree.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Nov 20, 2026 */
export function formatDate(date: Date): string {
  return dateFmt.format(date);
}

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** Nov 20, 2026, 14:05 (UTC) */
export function formatDateTime(date: Date): string {
  return dateTimeFmt.format(date);
}

/**
 * Elapsed seconds (computed by the caller, e.g. in SQL) -> "2d 4h", "3h 5m", "35m".
 * Under a minute reads "0m".
 */
export function formatDuration(seconds: number): string {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${m}m`;
  return `${m}m`;
}
