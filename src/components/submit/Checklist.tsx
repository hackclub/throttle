import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";

export type CheckItem = { ok: boolean; label: string; value?: ReactNode };

/** Auto checklist for submit pages: check/x, label, mono value on the right. */
export function Checklist({ items }: { items: CheckItem[] }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-white">
      {items.map((c) => (
        <li key={c.label} className="flex items-start gap-3 px-5 py-3 text-sm">
          <Icon
            name={c.ok ? "check" : "x"}
            label={c.ok ? "Done" : "Not yet"}
            className={cx("mt-0.5 shrink-0", c.ok ? "text-hc-dark" : "text-hc-red")}
          />
          <span className={cx("min-w-0 flex-1", c.ok ? "text-hc-dark" : "text-hc-dark/80")}>
            {c.label}
          </span>
          {c.value !== undefined && (
            <span className="min-w-0 text-right font-mono text-xs tabular-nums break-words text-hc-dark/80">
              {c.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
