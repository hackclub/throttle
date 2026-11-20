"use client";

import { useSyncExternalStore } from "react";

const fmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });

const subscribe = () => () => {};

/**
 * Today's date in the browser's time zone. The server snapshot is null, so
 * nothing reads the clock while the server renders.
 */
export function DateLabel() {
  const label = useSyncExternalStore(
    subscribe,
    () => fmt.format(new Date()),
    () => null,
  );
  // A non-breaking space holds the line height until the date is known.
  return (
    <p className="font-mono text-xs uppercase tracking-widest text-hc-muted">
      {label ?? " "}
    </p>
  );
}
