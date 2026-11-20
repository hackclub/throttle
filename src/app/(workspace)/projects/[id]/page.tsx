import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BomPanel, BomSkeleton } from "@/components/project/BomPanel";
import { FlightLogComposer } from "@/components/project/FlightLogComposer";
import { FlightLogFeed } from "@/components/project/FlightLogFeed";
import { FlightStepper } from "@/components/project/FlightStepper";
import { GrantReadout } from "@/components/project/GrantReadout";
import { NextStep, NextStepSkeleton } from "@/components/project/NextStep";
import { ProjectTabs, parseTab } from "@/components/project/ProjectTabs";
import { SubmissionsList } from "@/components/project/SubmissionsList";
import { ArtSlot } from "@/components/ui/ArtSlot";
import { Icon } from "@/components/ui/Icon";
import { StatusPill, TierPill } from "@/components/ui/Pill";
import { requireUser } from "@/lib/auth/session";
import { CATEGORY_LABEL } from "@/lib/categories";
import { parseRepoUrl, repoWebUrl } from "@/lib/github";
import {
  canDeleteEntry,
  canEdit,
  canView,
  getProject,
  latestApprovedReview,
  minutesByPhase,
} from "@/lib/projects";
import { isInReview, logPhaseFor, type ProjectStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Aircraft · Throttle" };

// Funded but not yet airborne. Airborne gets its own stamp in NextStep.
const CLEARED: ProjectStatus[] = ["parts_funded", "flight_review", "flight_returned"];

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The back link prerenders into the shell; everything that needs the session,
// params or searchParams streams in behind the boundary.
export default function ProjectPage({ params, searchParams }: Props) {
  return (
    <div>
      <Link
        href="/hangar"
        className="font-mono text-xs text-hc-muted transition-colors hover:text-hc-dark"
      >
        ← Hangar
      </Link>
      <Suspense fallback={<WorkspaceSkeleton />}>
        <Workspace params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div aria-hidden>
      <div className="mt-3 h-9 w-72 rounded-lg bg-line" />
      <div className="mt-3 h-5 w-96 max-w-full rounded-lg bg-line/60" />
      <div className="mt-6 h-[92px] rounded-lg border border-line bg-white" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="h-96 rounded-lg border border-line bg-white lg:col-span-2" />
        <div className="h-64 rounded-lg border border-line bg-white" />
      </div>
    </div>
  );
}

async function Workspace({ params, searchParams }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getProject(id);
  if (!detail || !canView(user, detail.project)) notFound();

  const { project, entries, submissions, reviews } = detail;
  const tab = parseTab((await searchParams).tab);

  const [approvedDesign, approvedFlight] = await Promise.all([
    latestApprovedReview(project.id, "design"),
    latestApprovedReview(project.id, "flight"),
  ]);

  const minutes = minutesByPhase(entries);
  const editable = canEdit(user, project);
  const showComposer = editable && !isInReview(project.status);
  const deletable = new Set(
    entries.filter((e) => canDeleteEntry(user, project, e)).map((e) => e.id),
  );
  const repo = parseRepoUrl(project.repoUrl);

  return (
    <>
      <header className="mt-3">
        <h1 className="text-3xl font-bold tracking-tight break-words">{project.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-hc-dark/80">
          <span>{CATEGORY_LABEL[project.category]}</span>
          <span aria-hidden className="text-hc-muted">
            ·
          </span>
          <TierPill tier={project.tier} />
          <span aria-hidden className="text-hc-muted">
            ·
          </span>
          <StatusPill status={project.status} />
          <span aria-hidden className="text-hc-muted">
            ·
          </span>
          {repo ? (
            <a
              href={repoWebUrl(repo)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1 font-mono text-xs text-hc-blue hover:underline"
            >
              <span className="truncate">
                {repo.owner}/{repo.repo}
              </span>
              <Icon name="external" size={13} className="shrink-0" />
            </a>
          ) : (
            <span className="font-mono text-xs text-hc-muted">no repo</span>
          )}
        </div>
        {project.pitch && (
          <p className="mt-3 max-w-2xl text-hc-dark/80">{project.pitch}</p>
        )}
      </header>

      <div className="mt-6">
        <FlightStepper status={project.status} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-start-3 lg:row-start-1">
          <GrantReadout
            project={project}
            designMinutes={minutes.design}
            buildMinutes={minutes.build}
            approvedDesign={approvedDesign}
            approvedFlight={approvedFlight}
          />
          {CLEARED.includes(project.status) && (
            <div className="flex justify-center">
              <div className="w-28">
                <ArtSlot name="stamp-cleared.svg" ratio="1/1" alt="Cleared: parts funded" />
              </div>
            </div>
          )}
          <Suspense fallback={<NextStepSkeleton />}>
            <NextStep
              project={project}
              entries={entries}
              submissions={submissions}
              reviews={reviews}
              canAct={editable}
            />
          </Suspense>
        </aside>

        <div className="min-w-0 space-y-5 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <ProjectTabs projectId={project.id} active={tab} />

          {tab === "log" && (
            <>
              {showComposer && (
                <FlightLogComposer projectId={project.id} phase={logPhaseFor(project.status)} />
              )}
              <FlightLogFeed entries={entries} deletable={deletable} />
            </>
          )}

          {tab === "bom" && (
            <Suspense fallback={<BomSkeleton />}>
              <BomPanel repoUrl={project.repoUrl} />
            </Suspense>
          )}

          {tab === "submissions" && (
            <SubmissionsList submissions={submissions} reviews={reviews} />
          )}
        </div>
      </div>
    </>
  );
}
