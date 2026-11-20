import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityTable } from "@/components/admin/ActivityTable";
import { EmptyPanel, PageTitle, monoLabel, panel } from "@/components/admin/AdminUI";
import { GrantsToSend } from "@/components/review/GrantsToSend";
import { Icon } from "@/components/ui/Icon";
import { Stat } from "@/components/ui/Stat";
import { cx } from "@/components/ui/cx";
import { getOverviewStats, listActivity, listOldestPending } from "@/lib/admin";
import { requireReviewer } from "@/lib/auth/session";
import { formatDuration } from "@/lib/format";
import { listGrantsToSend } from "@/lib/reviews";
import { formatUSD } from "@/lib/tiers";

export const metadata: Metadata = { title: "Staff · Throttle" };

export default function StaffOverviewPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Overview" />
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-[74px] rounded-lg border border-line bg-white" />
      <div className="h-48 rounded-lg border border-line bg-white" />
      <div className="h-72 rounded-lg border border-line bg-white" />
    </div>
  );
}

async function Overview() {
  await requireReviewer();
  const [stats, pending, grants, activity] = await Promise.all([
    getOverviewStats(),
    listOldestPending(5),
    listGrantsToSend(),
    listActivity({ page: 1, pageSize: 15 }),
  ]);
  const grantTotal = grants.reduce((sum, g) => sum + g.grantCents, 0);

  const statItems = [
    { label: "Pending design", value: stats.pendingDesign },
    { label: "Pending flight", value: stats.pendingFlight },
    {
      label: "Oldest wait",
      value: stats.oldestSeconds === null ? "—" : formatDuration(stats.oldestSeconds),
    },
    {
      label: "Grants to send",
      value: (
        <>
          {grants.length}
          <span className="text-sm text-hc-muted"> · {formatUSD(grantTotal)}</span>
        </>
      ),
    },
    { label: "Makers", value: stats.makers.toLocaleString("en-US") },
    { label: "Aircraft airborne", value: stats.airborne.toLocaleString("en-US") },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        {statItems.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} className="bg-white px-5 py-4" />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Needs attention</h2>
        {pending.length === 0 ? (
          <EmptyPanel>Queue&apos;s clear.</EmptyPanel>
        ) : (
          <ul className={cx(panel, "divide-y divide-line")}>
            {pending.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/reviews/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-mist focus-visible:bg-mist focus-visible:outline-none"
                >
                  <span className={cx(monoLabel, "w-14 shrink-0")}>{p.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block truncate text-hc-muted">{p.makerName}</span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-hc-dark/80">
                    waiting {formatDuration(p.waitingSeconds)}
                  </span>
                  <Icon name="chevron-right" className="shrink-0 text-hc-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {grants.length > 0 && <GrantsToSend grants={grants} />}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <Link href="/admin/activity" className="font-mono text-xs text-hc-blue hover:underline">
            Full log →
          </Link>
        </div>
        {activity.rows.length === 0 ? (
          <EmptyPanel>Nothing logged yet.</EmptyPanel>
        ) : (
          <ActivityTable rows={activity.rows} />
        )}
      </section>
    </div>
  );
}
