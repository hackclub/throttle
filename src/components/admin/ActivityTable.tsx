import Link from "next/link";
import { cx } from "@/components/ui/cx";
import type { ActivityRow } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { panel, td, th, theadRow } from "./AdminUI";

const MAX_META_CHARS = 120;

function compactMeta(meta: Record<string, unknown> | null): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  return JSON.stringify(meta);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Where an audit entry's target should link, and what to call it. */
function target(row: ActivityRow): { href: string | null; label: string } {
  const short = row.targetId.slice(0, 8);
  switch (row.targetType) {
    case "submission":
      return { href: `/admin/reviews/${row.targetId}`, label: row.projectTitle ?? short };
    case "user":
      return {
        href: row.targetUserEmail ? `/admin/users?q=${encodeURIComponent(row.targetUserEmail)}` : null,
        label: row.targetUserName ?? short,
      };
    default:
      return row.projectId
        ? { href: `/projects/${row.projectId}`, label: row.projectTitle ?? short }
        : { href: null, label: short };
  }
}

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className={cx(panel, "overflow-x-auto")}>
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className={theadRow}>
            <th scope="col" className={th}>
              Time
            </th>
            <th scope="col" className={th}>
              Actor
            </th>
            <th scope="col" className={th}>
              Action
            </th>
            <th scope="col" className={th}>
              Target
            </th>
            <th scope="col" className={th}>
              Details
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const t = target(r);
            const meta = compactMeta(r.meta);
            return (
              <tr key={r.id}>
                <td className={cx(td, "whitespace-nowrap font-mono text-xs tabular-nums text-hc-muted")}>
                  <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt)}</time>
                </td>
                <td className={cx(td, "max-w-40 truncate")}>{r.actorName ?? "system"}</td>
                <td className={cx(td, "whitespace-nowrap font-mono text-xs")}>{r.action}</td>
                <td className={cx(td, "max-w-56")}>
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="shrink-0 font-mono text-[11px] text-hc-muted">{r.targetType}</span>
                    {t.href ? (
                      <Link href={t.href} className="truncate text-hc-blue hover:underline">
                        {t.label}
                      </Link>
                    ) : (
                      <span className="truncate font-mono text-xs">{t.label}</span>
                    )}
                  </span>
                </td>
                <td
                  className={cx(td, "max-w-72 truncate font-mono text-xs text-hc-muted")}
                  title={meta || undefined}
                >
                  {truncate(meta, MAX_META_CHARS)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
