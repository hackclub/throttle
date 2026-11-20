import Link from "next/link";
import { cx } from "@/components/ui/cx";

export const TABS = [
  { key: "log", label: "Flight Log" },
  { key: "bom", label: "BOM" },
  { key: "submissions", label: "Submissions" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export function parseTab(value: string | string[] | undefined): TabKey {
  const v = Array.isArray(value) ? value[0] : value;
  return TABS.some((t) => t.key === v) ? (v as TabKey) : "log";
}

export function ProjectTabs({ projectId, active }: { projectId: string; active: TabKey }) {
  return (
    <nav aria-label="Project sections" className="flex gap-6 border-b border-line">
      {TABS.map((t) => {
        const current = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.key === "log" ? `/projects/${projectId}` : `/projects/${projectId}?tab=${t.key}`}
            scroll={false}
            aria-current={current ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 pb-2.5 font-mono text-sm transition-colors",
              current
                ? "border-hc-blue text-hc-dark"
                : "border-transparent text-hc-muted hover:text-hc-dark",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
