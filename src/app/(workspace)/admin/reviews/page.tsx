import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { GrantsToSend } from "@/components/review/GrantsToSend";
import { TierPill } from "@/components/ui/Pill";
import { Stat } from "@/components/ui/Stat";
import { cx } from "@/components/ui/cx";
import { requireReviewer } from "@/lib/auth/session";
import { formatDuration } from "@/lib/format";
import {
  listGrantsToSend,
  listQueue,
  parseKind,
  queueStats,
  type QueueRow,
  type SubmissionKind,
} from "@/lib/reviews";
import { formatHoursExact, minutesToHours } from "@/lib/tiers";

export const metadata: Metadata = { title: "Reviews · Throttle" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ReviewsPage({ searchParams }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reviews</h1>
      <Suspense fallback={<QueueSkeleton />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-[74px] rounded-lg border border-line bg-white" />
      <div className="h-8 w-56 rounded bg-line/60" />
      <div className="h-64 rounded-lg border border-line bg-white" />
    </div>
  );
}

const KIND_LABEL: Record<SubmissionKind, string> = { design: "Design", flight: "Flight" };

async function Queue({ searchParams }: Props) {
  const user = await requireReviewer();
  const kind = parseKind((await searchParams).kind);
  const [stats, rows, grants] = await Promise.all([
    queueStats(kind),
    listQueue(kind),
    listGrantsToSend(),
  ]);

  const statItems = [
    { label: `Pending · ${KIND_LABEL[kind]}`, value: stats.pending[kind] },
    {
      label: "Oldest wait",
      value: stats.oldestSeconds === null ? "—" : formatDuration(stats.oldestSeconds),
    },
    {
      label: "Avg turnaround · 30d",
      value:
        stats.avgTurnaroundSeconds === null ? "—" : formatDuration(stats.avgTurnaroundSeconds),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-white">
        {statItems.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} className="px-5 py-4" />
        ))}
      </div>

      {grants.length > 0 && <GrantsToSend grants={grants} />}

      <nav aria-label="Review queues" className="flex gap-6 border-b border-line">
        {(["design", "flight"] as const).map((k) => {
          const current = k === kind;
          return (
            <Link
              key={k}
              href={`/admin/reviews?kind=${k}`}
              scroll={false}
              aria-current={current ? "page" : undefined}
              className={cx(
                "-mb-px border-b-2 pb-2.5 font-mono text-sm transition-colors",
                current
                  ? "border-hc-blue text-hc-dark"
                  : "border-transparent text-hc-muted hover:text-hc-dark",
              )}
            >
              {KIND_LABEL[k]} <span className="tabular-nums">({stats.pending[k]})</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-white px-5 py-10 text-center text-sm text-hc-dark/70">
          Queue&apos;s clear.
        </div>
      ) : (
        <QueueTable rows={rows} viewerId={user.id} />
      )}
    </div>
  );
}

const th = "px-3 py-2 text-left font-normal first:pl-5 last:pr-5";

function QueueTable({ rows, viewerId }: { rows: QueueRow[]; viewerId: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wide text-hc-muted">
            <th scope="col" className={th}>
              Waiting
            </th>
            <th scope="col" className={th}>
              Aircraft
            </th>
            <th scope="col" className={th}>
              Maker
            </th>
            <th scope="col" className={th}>
              Tier
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Hours
            </th>
            <th scope="col" className={th}>
              Claimed
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const href = `/admin/reviews/${r.id}`;
            const takenByOther = r.claim !== null && r.claim.byId !== viewerId;
            // Every cell links so the whole row is clickable; only the title
            // link is in the tab order / accessibility tree.
            const cell = (children: ReactNode, opts: { primary?: boolean; className?: string } = {}) => (
              <Link
                href={href}
                tabIndex={opts.primary ? undefined : -1}
                aria-hidden={opts.primary ? undefined : true}
                className={cx("block px-3 py-2.5 focus-visible:outline-none", opts.className)}
              >
                {children}
              </Link>
            );
            return (
              <tr
                key={r.id}
                className={cx(
                  "transition-colors hover:bg-mist focus-within:bg-mist",
                  takenByOther && "opacity-50",
                )}
              >
                <td className="[&>a]:pl-5">
                  {cell(formatDuration(r.waitingSeconds), {
                    className: "font-mono tabular-nums",
                  })}
                </td>
                <td className="max-w-64">
                  {cell(<span className="block truncate font-medium">{r.title}</span>, {
                    primary: true,
                  })}
                </td>
                <td className="max-w-48">
                  {cell(<span className="block truncate">{r.makerName}</span>)}
                </td>
                <td>{cell(<TierPill tier={r.tier} />)}</td>
                <td>
                  {cell(formatHoursExact(minutesToHours(r.minutes)), {
                    className: "text-right font-mono tabular-nums",
                  })}
                </td>
                <td className="[&>a]:pr-5">
                  {cell(
                    r.claim ? (
                      <span className="font-mono text-xs">
                        {r.claim.byName} ·{" "}
                        {formatDuration(r.claim.ageSeconds)} ago
                      </span>
                    ) : (
                      <span className="text-hc-muted">—</span>
                    ),
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
