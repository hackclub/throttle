"use client";

import { useSyncExternalStore } from "react";
import { cx } from "@/components/ui/cx";

type Day = { day: string; minutes: number; entries: number };

const WEEKS = 26;
const DAY_MS = 24 * 60 * 60 * 1000;

const LEVELS = ["bg-hc-blue/10", "bg-hc-blue/30", "bg-hc-blue/60", "bg-hc-blue"] as const;

/** 0, under 1 h, 1 to 3 h, 3 h and up. */
function level(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 60) return 1;
  if (minutes < 180) return 2;
  return 3;
}

const subscribe = () => () => {};

// Buckets come from SQL as UTC days, so the grid counts in UTC too.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function keyToTime(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

function timeToKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function hours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10} h`;
}

type Cell = { key: string; minutes: number; future: boolean };

/** 7 rows (Sun to Sat) by 26 week columns, ending with the current week. */
function buildCells(today: string, byDay: Map<string, Day>): Cell[] {
  const todayTime = keyToTime(today);
  const dow = new Date(todayTime).getUTCDay();
  const start = todayTime - (dow + (WEEKS - 1) * 7) * DAY_MS;
  return Array.from({ length: WEEKS * 7 }, (_, i) => {
    const time = start + i * DAY_MS;
    const key = timeToKey(time);
    return { key, minutes: byDay.get(key)?.minutes ?? 0, future: time > todayTime };
  });
}

export function ActivityGrid({ days }: { days: Day[] }) {
  // Null on the server and during hydration; the browser's date after that.
  const today = useSyncExternalStore(subscribe, todayKey, () => null);
  const byDay = new Map(days.map((d) => [d.day, d]));

  const cells = today ? buildCells(today, byDay) : null;
  // The caption counts what the grid shows; before hydration, everything sent.
  const visible = cells ? new Set(cells.filter((c) => !c.future).map((c) => c.key)) : null;
  const shown = visible ? days.filter((d) => visible.has(d.day)) : days;
  const entries = shown.reduce((sum, d) => sum + d.entries, 0);
  const minutes = shown.reduce((sum, d) => sum + d.minutes, 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div
          role="img"
          aria-label={`Hours logged per day over the last ${WEEKS} weeks: ${entries} entries, ${hours(minutes)}`}
          className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
        >
          {cells
            ? cells.map((c) => (
                <span
                  key={c.key}
                  title={c.future ? undefined : `${dayFmt.format(keyToTime(c.key))} · ${hours(c.minutes)}`}
                  className={cx("size-[11px] rounded-[2px]", c.future ? "bg-transparent" : LEVELS[level(c.minutes)])}
                />
              ))
            : Array.from({ length: WEEKS * 7 }, (_, i) => (
                <span key={i} className={cx("size-[11px] rounded-[2px]", LEVELS[0])} />
              ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="font-mono text-xs tabular-nums text-hc-muted">
          {entries} {entries === 1 ? "entry" : "entries"} · {hours(minutes)} logged
        </p>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-hc-muted" aria-hidden>
          <span>0</span>
          {LEVELS.map((cls) => (
            <span key={cls} className={cx("size-[9px] rounded-[2px]", cls)} />
          ))}
          <span>3h+</span>
        </div>
      </div>
    </div>
  );
}
