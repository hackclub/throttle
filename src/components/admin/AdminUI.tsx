import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import type { User } from "@/lib/db/schema";

// Small building blocks shared by the staff pages.

export const panel = "rounded-lg border border-line bg-white";
export const monoLabel = "font-mono text-[11px] uppercase tracking-wide text-hc-muted";
export const th = "px-3 py-2 text-left font-normal whitespace-nowrap first:pl-5 last:pr-5";
export const td = "px-3 py-2.5 first:pl-5 last:pr-5";
export const theadRow = "border-b border-line font-mono text-[11px] uppercase tracking-wide text-hc-muted";

/** Builds an href, dropping empty values so URLs stay tidy. */
export function hrefWith(
  base: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

export function FilterTabs({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; current: boolean }[];
}) {
  return (
    <nav aria-label={label} className="overflow-x-auto border-b border-line">
      <div className="flex gap-6 whitespace-nowrap">
        {items.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            scroll={false}
            aria-current={t.current ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 pb-2.5 font-mono text-sm transition-colors",
              t.current
                ? "border-hc-blue text-hc-dark"
                : "border-transparent text-hc-muted hover:text-hc-dark",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Plain GET search. Extra params (like the active filter) ride along as hidden inputs. */
export function SearchForm({
  action,
  q,
  placeholder,
  keep = {},
}: {
  action: string;
  q: string;
  placeholder: string;
  keep?: Record<string, string>;
}) {
  return (
    <Form action={action} className="flex w-full max-w-sm items-center gap-2" role="search">
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label="Search"
        className="block h-8 w-full rounded-lg border border-line bg-white px-3 text-sm text-hc-dark placeholder:text-hc-muted focus:border-hc-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40"
      />
      <button
        type="submit"
        className="h-8 shrink-0 rounded-lg border border-line bg-white px-3 text-sm font-medium text-hc-dark transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40"
      >
        Search
      </button>
    </Form>
  );
}

export function Pager({
  page,
  pageCount,
  total,
  noun,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  noun: string;
  hrefFor: (page: number) => string;
}) {
  const link =
    "inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-sm text-hc-dark transition-colors hover:bg-mist";
  const off = "pointer-events-none opacity-40";
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-mono text-xs tabular-nums text-hc-muted">
        {total.toLocaleString("en-US")} {noun} · page {Math.min(page, pageCount)} of {pageCount}
      </p>
      {pageCount > 1 && (
        <div className="flex gap-2">
          <Link
            href={hrefFor(page - 1)}
            aria-disabled={page <= 1 || undefined}
            tabIndex={page <= 1 ? -1 : undefined}
            className={cx(link, page <= 1 && off)}
          >
            <Icon name="chevron-left" size={14} />
            Prev
          </Link>
          <Link
            href={hrefFor(page + 1)}
            aria-disabled={page >= pageCount || undefined}
            tabIndex={page >= pageCount ? -1 : undefined}
            className={cx(link, page >= pageCount && off)}
          >
            Next
            <Icon name="chevron-right" size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

export function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className={cx(panel, "px-5 py-10 text-center text-sm text-hc-dark/70")}>{children}</div>
  );
}

const roleTone: Record<User["role"], string> = {
  maker: "bg-hc-muted/15 text-hc-dark",
  reviewer: "bg-hc-blue/15 text-hc-dark",
  admin: "bg-hc-red/15 text-hc-dark",
};

export function RolePill({ role }: { role: User["role"] }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide",
        roleTone[role],
      )}
    >
      {role}
    </span>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={cx(panel, "divide-y divide-line")} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10" />
      ))}
    </div>
  );
}
