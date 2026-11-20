import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Checklist, type CheckItem } from "@/components/submit/Checklist";
import { FlightSubmitForm } from "@/components/submit/FlightSubmitForm";
import { requireUser } from "@/lib/auth/session";
import { SUBMIT_FROM, flightChecks, loadOwnProject } from "@/lib/submissions";
import {
  FUEL_PER_HOUR,
  formatHoursExact,
  formatMultiplier,
  fuelFor,
  minutesToHours,
  toTier,
} from "@/lib/tiers";

export const metadata: Metadata = { title: "Maiden Flight · Throttle" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function FlightSubmitPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<SubmitSkeleton />}>
        <FlightSubmit searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SubmitSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-4 w-32 rounded bg-line" />
      <div className="mt-3 h-8 w-56 rounded-lg bg-line" />
      <div className="mt-6 h-24 rounded-lg border border-line bg-white" />
      <div className="mt-6 h-[520px] rounded-lg border border-line bg-white" />
    </div>
  );
}

async function FlightSubmit({ searchParams }: Props) {
  const user = await requireUser();
  const raw = (await searchParams).project;
  const projectId = Array.isArray(raw) ? raw[0] : raw;
  if (!projectId) redirect("/hangar");

  const own = await loadOwnProject(projectId, user.id);
  if (!own || !SUBMIT_FROM.flight.includes(own.project.status)) {
    redirect(`/projects/${projectId}`);
  }
  const { project, entries } = own;

  const checks = flightChecks(entries);
  const tier = toTier(project.tier);
  const hours = minutesToHours(checks.minutes);

  const items: CheckItem[] = [
    {
      ok: checks.entryCount > 0,
      label: "At least 1 build entry",
      value: `${checks.entryCount} logged`,
    },
    {
      ok: checks.minutes > 0,
      label: "Build hours",
      value: `${formatHoursExact(hours)} × ${FUEL_PER_HOUR} × ${formatMultiplier(tier)} = ${fuelFor(hours, tier).toLocaleString("en-US")} fuel`,
    },
  ];

  return (
    <>
      <Link
        href={`/projects/${project.id}`}
        className="font-mono text-xs text-hc-muted transition-colors hover:text-hc-dark"
      >
        ← {project.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Maiden Flight</h1>
      <p className="mt-1 text-hc-dark/70">
        Get it in the air, film it, ship it. Approved build hours earn fuel for the shop.
      </p>

      <h2 className="mt-8 mb-2 font-mono text-[11px] uppercase tracking-wide text-hc-muted">
        Checklist
      </h2>
      <Checklist items={items} />

      <div className="mt-8">
        <FlightSubmitForm
          projectId={project.id}
          blockedReason={checks.ready ? null : "Log at least one build entry first."}
        />
      </div>
    </>
  );
}
