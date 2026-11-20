import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  EmptyPanel,
  FilterTabs,
  PageTitle,
  Pager,
  SearchForm,
  TableSkeleton,
  hrefWith,
  panel,
  td,
  th,
  theadRow,
} from "@/components/admin/AdminUI";
import { StatusPill, TierPill } from "@/components/ui/Pill";
import { cx } from "@/components/ui/cx";
import {
  PROJECT_FILTERS,
  listAllProjects,
  parsePage,
  parseProjectFilter,
  parseQuery,
  type AdminProjectRow,
} from "@/lib/admin";
import { requireReviewer } from "@/lib/auth/session";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatDate } from "@/lib/format";
import { formatHours } from "@/lib/tiers";

export const metadata: Metadata = { title: "Projects · Staff · Throttle" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const BASE = "/admin/projects";

export default function AdminProjectsPage({ searchParams }: Props) {
  return (
    <div className="space-y-6">
      <PageTitle title="Projects" />
      <Suspense fallback={<TableSkeleton />}>
        <Projects searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Projects({ searchParams }: Props) {
  await requireReviewer();
  const params = await searchParams;
  const filter = parseProjectFilter(params.status);
  const q = parseQuery(params.q);
  const page = parsePage(params.page);
  const result = await listAllProjects({ statuses: filter.statuses, q, page });

  const status = filter.key === "all" ? undefined : filter.key;

  return (
    <div className="space-y-5">
      <SearchForm
        action={BASE}
        q={q}
        placeholder="Title, maker name or email"
        keep={status ? { status } : {}}
      />

      <FilterTabs
        label="Project status"
        items={PROJECT_FILTERS.map((f) => ({
          href: hrefWith(BASE, { status: f.key === "all" ? undefined : f.key, q }),
          label: f.label,
          current: f.key === filter.key,
        }))}
      />

      {result.rows.length === 0 ? (
        <EmptyPanel>No projects match.</EmptyPanel>
      ) : (
        <ProjectsTable rows={result.rows} />
      )}

      <Pager
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun={result.total === 1 ? "project" : "projects"}
        hrefFor={(p) => hrefWith(BASE, { status, q, page: p > 1 ? p : undefined })}
      />
    </div>
  );
}

function ProjectsTable({ rows }: { rows: AdminProjectRow[] }) {
  return (
    <div className={cx(panel, "overflow-x-auto")}>
      <table className="w-full min-w-[60rem] text-sm">
        <thead>
          <tr className={theadRow}>
            <th scope="col" className={th}>
              Title
            </th>
            <th scope="col" className={th}>
              Maker
            </th>
            <th scope="col" className={th}>
              Category
            </th>
            <th scope="col" className={th}>
              Tier
            </th>
            <th scope="col" className={th}>
              Status
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Design
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Build
            </th>
            <th scope="col" className={th}>
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((p) => (
            <tr key={p.id}>
              <td className={cx(td, "max-w-64")}>
                <Link href={`/projects/${p.id}`} className="block truncate font-medium hover:underline">
                  {p.title}
                </Link>
              </td>
              <td className={cx(td, "max-w-52")}>
                <span className="block truncate">{p.ownerName}</span>
                <span className="block truncate font-mono text-xs text-hc-muted">{p.ownerEmail}</span>
              </td>
              <td className={cx(td, "whitespace-nowrap text-hc-dark/80")}>
                {CATEGORY_LABEL[p.category]}
              </td>
              <td className={td}>
                <TierPill tier={p.tier} />
              </td>
              <td className={cx(td, "whitespace-nowrap")}>
                <StatusPill status={p.status} />
              </td>
              <td className={cx(td, "text-right font-mono tabular-nums")}>
                {formatHours(p.designMinutes, "minutes")}
              </td>
              <td className={cx(td, "text-right font-mono tabular-nums")}>
                {formatHours(p.buildMinutes, "minutes")}
              </td>
              <td className={cx(td, "whitespace-nowrap font-mono text-xs text-hc-muted")}>
                <time dateTime={p.updatedAt.toISOString()}>{formatDate(p.updatedAt)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
