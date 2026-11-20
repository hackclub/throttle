import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { markGrantSent } from "@/app/(workspace)/admin/reviews/actions";
import {
  EmptyPanel,
  FilterTabs,
  PageTitle,
  TableSkeleton,
  monoLabel,
  panel,
  td,
  th,
  theadRow,
} from "@/components/admin/AdminUI";
import { TierPill } from "@/components/ui/Pill";
import { cx } from "@/components/ui/cx";
import { GRANT_FILTERS, listGrants, parseGrantFilter, type GrantRow } from "@/lib/admin";
import { requireReviewer } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { reviewedHours, reviewedTier } from "@/lib/projects";
import { formatHoursExact, formatUSD } from "@/lib/tiers";

export const metadata: Metadata = { title: "Grants · Staff · Throttle" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function GrantsPage({ searchParams }: Props) {
  return (
    <div className="space-y-6">
      <PageTitle title="Grants" />
      <Suspense fallback={<TableSkeleton />}>
        <Grants searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Grants({ searchParams }: Props) {
  await requireReviewer();
  const filter = parseGrantFilter((await searchParams).filter);
  const rows = await listGrants(filter);
  const total = rows.reduce((sum, r) => sum + r.grantCents, 0);

  return (
    <div className="space-y-5">
      <FilterTabs
        label="Grant status"
        items={GRANT_FILTERS.map((f) => ({
          href: f.key === "to_send" ? "/admin/grants" : `/admin/grants?filter=${f.key}`,
          label: f.label,
          current: f.key === filter,
        }))}
      />

      {rows.length === 0 ? (
        <EmptyPanel>
          {filter === "to_send" ? "Every approved grant has been sent." : "No grants here yet."}
        </EmptyPanel>
      ) : (
        <GrantsTable rows={rows} total={total} />
      )}
    </div>
  );
}

function GrantStatus({ row }: { row: GrantRow }) {
  if (row.sent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-hc-green/20 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-hc-dark">
        <span aria-hidden className="size-1.5 rounded-full bg-hc-green" />
        Sent
      </span>
    );
  }
  if (row.grantCents === 0) return <span className={monoLabel}>No grant</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-hc-red/15 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-hc-dark">
      <span aria-hidden className="size-1.5 rounded-full bg-hc-red" />
      To send
    </span>
  );
}

function GrantsTable({ rows, total }: { rows: GrantRow[]; total: number }) {
  return (
    <div className={cx(panel, "overflow-x-auto")}>
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className={theadRow}>
            <th scope="col" className={th}>
              Maker
            </th>
            <th scope="col" className={th}>
              Aircraft
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Hours
            </th>
            <th scope="col" className={th}>
              Tier
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Amount
            </th>
            <th scope="col" className={th}>
              Approved
            </th>
            <th scope="col" className={th}>
              Status
            </th>
            <th scope="col" className={th}>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.reviewId}>
              <td className={cx(td, "max-w-56")}>
                <span className="block truncate font-medium">{r.ownerName}</span>
                <span className="block truncate font-mono text-xs text-hc-muted">{r.ownerEmail}</span>
              </td>
              <td className={cx(td, "max-w-56")}>
                <Link href={`/projects/${r.projectId}`} className="block truncate hover:underline">
                  {r.title}
                </Link>
              </td>
              <td className={cx(td, "text-right font-mono tabular-nums")}>
                {formatHoursExact(reviewedHours(r))}
              </td>
              <td className={td}>
                <TierPill tier={reviewedTier(r)} />
              </td>
              <td className={cx(td, "text-right font-mono font-bold tabular-nums")}>
                {formatUSD(r.grantCents)}
              </td>
              <td className={cx(td, "whitespace-nowrap font-mono text-xs text-hc-muted")}>
                <time dateTime={r.approvedAt.toISOString()}>{formatDate(r.approvedAt)}</time>
              </td>
              <td className={td}>
                <GrantStatus row={r} />
              </td>
              <td className={cx(td, "text-right")}>
                {!r.sent && r.grantCents > 0 && (
                  <form action={markGrantSent}>
                    <input type="hidden" name="reviewId" value={r.reviewId} />
                    <button
                      type="submit"
                      className="rounded-md border border-line px-2 py-0.5 text-xs whitespace-nowrap text-hc-dark transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40"
                    >
                      Mark sent
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line">
            <td colSpan={4} className={cx(td, monoLabel)}>
              Total · {rows.length} {rows.length === 1 ? "grant" : "grants"}
            </td>
            <td className={cx(td, "text-right font-mono font-bold tabular-nums")}>
              {formatUSD(total)}
            </td>
            <td colSpan={3} className={td} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
