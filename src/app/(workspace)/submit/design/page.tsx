import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Checklist, type CheckItem } from "@/components/submit/Checklist";
import { DesignSubmitForm } from "@/components/submit/DesignSubmitForm";
import { requireUser } from "@/lib/auth/session";
import { isBomError } from "@/lib/bom";
import { SUBMIT_FROM, designChecks, loadOwnProject } from "@/lib/submissions";
import {
  formatHoursExact,
  formatUSD,
  grantCents,
  minutesToHours,
  rateCents,
  toTier,
} from "@/lib/tiers";

export const metadata: Metadata = { title: "Design Review · Throttle" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function DesignSubmitPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<SubmitSkeleton />}>
        <DesignSubmit searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SubmitSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-4 w-32 rounded bg-line" />
      <div className="mt-3 h-8 w-56 rounded-lg bg-line" />
      <div className="mt-6 h-44 rounded-lg border border-line bg-white" />
      <div className="mt-6 h-[640px] rounded-lg border border-line bg-white" />
    </div>
  );
}

async function DesignSubmit({ searchParams }: Props) {
  const user = await requireUser();
  const raw = (await searchParams).project;
  const projectId = Array.isArray(raw) ? raw[0] : raw;
  if (!projectId) redirect("/hangar");

  const own = await loadOwnProject(projectId, user.id);
  if (!own || !SUBMIT_FROM.design.includes(own.project.status)) {
    redirect(`/projects/${projectId}`);
  }
  const { project, entries } = own;

  await connection();
  const checks = await designChecks(project, entries);
  const tier = toTier(project.tier);
  const hours = minutesToHours(checks.minutes);

  const items: CheckItem[] = [
    {
      ok: checks.repo !== null,
      label: "Repo link valid",
      value: checks.repo ? `${checks.repo.owner}/${checks.repo.repo}` : "not a GitHub repo",
    },
    {
      ok: !isBomError(checks.bom),
      label: "bom.csv found",
      value: isBomError(checks.bom)
        ? checks.bom.error === "not_found"
          ? "not found"
          : "unreadable"
        : `${checks.bom.rows.length} ${checks.bom.rows.length === 1 ? "part" : "parts"} · ${formatUSD(checks.bom.totalCents)}`,
    },
    {
      ok: checks.entryCount > 0,
      label: "At least 1 design log entry",
      value: `${checks.entryCount} logged`,
    },
    {
      ok: checks.minutes > 0,
      label: "Design hours",
      value: `${formatHoursExact(hours)} × ${formatUSD(rateCents(tier))} = ${formatUSD(grantCents(hours, tier))}`,
    },
  ];

  const blockedReason = !checks.repo
    ? "Fix the repo link on your project first."
    : isBomError(checks.bom)
      ? "Add a bom.csv to the root of your repo first."
      : checks.entryCount === 0 || checks.minutes === 0
        ? "Log at least one design entry first."
        : null;

  return (
    <>
      <Link
        href={`/projects/${project.id}`}
        className="font-mono text-xs text-hc-muted transition-colors hover:text-hc-dark"
      >
        ← {project.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Design Review</h1>
      <p className="mt-1 text-hc-dark/70">
        Show us the plan. If it&apos;s approved you get a grant for parts: design hours × tier
        rate.
      </p>

      <h2 className="mt-8 mb-2 font-mono text-[11px] uppercase tracking-wide text-hc-muted">
        Checklist
      </h2>
      <Checklist items={items} />

      <div className="mt-8">
        <DesignSubmitForm
          projectId={project.id}
          defaultTier={tier}
          designMinutes={checks.minutes}
          blockedReason={blockedReason}
        />
      </div>
    </>
  );
}
