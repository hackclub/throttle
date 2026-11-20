import type { Metadata } from "next";
import { Suspense } from "react";
import {
  EmptyPanel,
  PageTitle,
  Pager,
  RolePill,
  SearchForm,
  TableSkeleton,
  hrefWith,
  panel,
  td,
  th,
  theadRow,
} from "@/components/admin/AdminUI";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { cx } from "@/components/ui/cx";
import { listUsers, parsePage, parseQuery, type AdminUserRow } from "@/lib/admin";
import { requireReviewer } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Users · Staff · Throttle" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const BASE = "/admin/users";

export default function AdminUsersPage({ searchParams }: Props) {
  return (
    <div className="space-y-6">
      <PageTitle title="Users" />
      <Suspense fallback={<TableSkeleton />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Users({ searchParams }: Props) {
  const viewer = await requireReviewer();
  const params = await searchParams;
  const q = parseQuery(params.q);
  const page = parsePage(params.page);
  const result = await listUsers({ q, page });

  return (
    <div className="space-y-5">
      <SearchForm action={BASE} q={q} placeholder="Name, email or Slack ID" />

      {result.rows.length === 0 ? (
        <EmptyPanel>No users match.</EmptyPanel>
      ) : (
        <UsersTable
          rows={result.rows}
          viewerId={viewer.id}
          canEditRoles={viewer.role === "admin"}
        />
      )}

      <Pager
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        noun={result.total === 1 ? "user" : "users"}
        hrefFor={(p) => hrefWith(BASE, { q, page: p > 1 ? p : undefined })}
      />
    </div>
  );
}

function UsersTable({
  rows,
  viewerId,
  canEditRoles,
}: {
  rows: AdminUserRow[];
  viewerId: string;
  canEditRoles: boolean;
}) {
  return (
    <div className={cx(panel, "overflow-x-auto")}>
      <table className="w-full min-w-[54rem] text-sm">
        <thead>
          <tr className={theadRow}>
            <th scope="col" className={th}>
              Name
            </th>
            <th scope="col" className={th}>
              Email
            </th>
            <th scope="col" className={th}>
              Slack ID
            </th>
            <th scope="col" className={th}>
              Role
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Aircraft
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Fuel
            </th>
            <th scope="col" className={th}>
              Joined
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((u) => (
            <tr key={u.id}>
              <td className={cx(td, "max-w-48 truncate font-medium")}>
                {u.name}
                {u.id === viewerId && <span className="font-normal text-hc-muted"> (you)</span>}
              </td>
              <td className={cx(td, "max-w-60 truncate font-mono text-xs")}>{u.email}</td>
              <td className={cx(td, "whitespace-nowrap font-mono text-xs text-hc-dark/80")}>
                {u.slackId ?? <span className="text-hc-muted">—</span>}
              </td>
              <td className={td}>
                {canEditRoles ? (
                  <RoleSelect
                    key={`${u.id}-${u.role}`}
                    userId={u.id}
                    role={u.role}
                    self={u.id === viewerId}
                  />
                ) : (
                  <RolePill role={u.role} />
                )}
              </td>
              <td className={cx(td, "text-right font-mono tabular-nums")}>{u.aircraft}</td>
              <td className={cx(td, "text-right font-mono tabular-nums")}>
                {u.fuel.toLocaleString("en-US")}
              </td>
              <td className={cx(td, "whitespace-nowrap font-mono text-xs text-hc-muted")}>
                <time dateTime={u.createdAt.toISOString()}>{formatDate(u.createdAt)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
