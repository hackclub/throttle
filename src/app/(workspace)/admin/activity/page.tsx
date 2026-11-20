import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityTable } from "@/components/admin/ActivityTable";
import { EmptyPanel, PageTitle, Pager, TableSkeleton, hrefWith } from "@/components/admin/AdminUI";
import { listActivity, parsePage } from "@/lib/admin";
import { requireReviewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Activity · Staff · Throttle" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ActivityPage({ searchParams }: Props) {
  return (
    <div className="space-y-6">
      <PageTitle title="Activity" />
      <Suspense fallback={<TableSkeleton />}>
        <Activity searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Activity({ searchParams }: Props) {
  await requireReviewer();
  const page = parsePage((await searchParams).page);
  const result = await listActivity({ page });

  return (
    <div className="space-y-5">
      {result.rows.length === 0 ? (
        <EmptyPanel>Nothing logged{page > 1 ? " on this page" : " yet"}.</EmptyPanel>
      ) : (
        <ActivityTable rows={result.rows} />
      )}
      <Pager
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun={result.total === 1 ? "entry" : "entries"}
        hrefFor={(p) => hrefWith("/admin/activity", { page: p > 1 ? p : undefined })}
      />
    </div>
  );
}
