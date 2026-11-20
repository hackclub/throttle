import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FlightStepper } from "@/components/project/FlightStepper";
import { ActivityGrid } from "@/components/hangar/ActivityGrid";
import { DateLabel } from "@/components/hangar/DateLabel";
import { ArtSlot } from "@/components/ui/ArtSlot";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { StatusPill, TierPill } from "@/components/ui/Pill";
import { Stat } from "@/components/ui/Stat";
import { cx } from "@/components/ui/cx";
import { requireUser } from "@/lib/auth/session";
import { CATEGORY_LABEL } from "@/lib/categories";
import { formatDate } from "@/lib/format";
import {
  approvedGrantCentsForUser,
  listProjectsForUser,
  listReturnedForUser,
  loggedDaysForUser,
  type ProjectSummary,
  type ReturnedItem,
} from "@/lib/projects";
import { isClosed, isInReview, logPhaseFor, nextStepSentence } from "@/lib/status";
import { formatHours, formatUSD } from "@/lib/tiers";

export const metadata: Metadata = { title: "Hangar · Throttle" };

const label = "font-mono text-[11px] uppercase tracking-wide text-hc-muted";

export default function HangarPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <DateLabel />
          <Suspense fallback={<h1 className="mt-1 text-3xl font-bold">Welcome back</h1>}>
            <Greeting />
          </Suspense>
        </div>
        <Button href="/projects/new">
          <Icon name="plus" />
          New aircraft
        </Button>
      </div>
      <Suspense fallback={<HangarSkeleton />}>
        <HangarContent />
      </Suspense>
    </div>
  );
}

async function Greeting() {
  const user = await requireUser();
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  return <h1 className="mt-1 text-3xl font-bold break-words">Welcome back, {firstName}</h1>;
}

function HangarSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-56 rounded-lg border border-line bg-white" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-40 rounded-lg border border-line bg-white" />
        <div className="h-40 rounded-lg border border-line bg-white" />
      </div>
      <div className="h-[74px] rounded-lg border border-line bg-white" />
      <div className="h-48 rounded-lg border border-line bg-white" />
    </div>
  );
}

async function HangarContent() {
  const user = await requireUser();
  const [list, grantTotal, returned, days] = await Promise.all([
    listProjectsForUser(user.id),
    approvedGrantCentsForUser(user.id),
    listReturnedForUser(user.id),
    loggedDaysForUser(user.id),
  ]);

  const loggedMinutes = list.reduce((sum, p) => sum + p.designMinutes + p.buildMinutes, 0);
  // Newest first, so this is the most recently touched aircraft still in progress.
  const active = list.find((p) => !isClosed(p.status));

  const stats = [
    { label: "Logged", value: formatHours(loggedMinutes, "minutes") },
    { label: "Grants approved", value: formatUSD(grantTotal) },
    { label: "Fuel", value: user.fuel.toLocaleString("en-US") },
    { label: "Aircraft", value: list.length },
  ];

  return (
    <div className="space-y-6">
      {active && <PickUp project={active} />}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <NeedsYou items={returned} />
        <section className="rounded-lg border border-line bg-white px-5 py-4">
          <h2 className="mb-3 text-sm font-medium">Activity</h2>
          <ActivityGrid days={days} />
        </section>
      </div>

      <div className="grid grid-cols-2 rounded-lg border border-line bg-white sm:grid-cols-4">
        {stats.map((s, i) => (
          <Stat
            key={s.label}
            label={s.label}
            value={s.value}
            className={cx(
              "border-line px-5 py-4",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t sm:border-t-0",
              i === 2 && "sm:border-l",
            )}
          />
        ))}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-lg border border-line bg-white px-6 py-12 text-center">
          <ArtSlot name="hangar-empty.svg" ratio="16/9" className="max-w-md" />
          <p className="text-hc-dark/80">
            No aircraft yet. Start with whatever you want to get off the ground.
          </p>
          <Button href="/projects/new">
            <Icon name="plus" />
            New aircraft
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
          {list.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-mist focus-visible:bg-mist focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-sm text-hc-muted">{CATEGORY_LABEL[p.category]}</p>
                </div>
                <TierPill tier={p.tier} className="hidden sm:inline-flex" />
                <span className="hidden w-16 text-right font-mono text-sm tabular-nums text-hc-dark/80 sm:inline">
                  {formatHours(p.designMinutes + p.buildMinutes, "minutes")}
                </span>
                <StatusPill status={p.status} />
                <Icon name="chevron-right" className="shrink-0 text-hc-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PickUp({ project }: { project: ProjectSummary }) {
  const phase = logPhaseFor(project.status);
  const phaseMinutes = phase === "design" ? project.designMinutes : project.buildMinutes;
  const href = `/projects/${project.id}`;
  // The log is locked while a review is pending, so there's nowhere to write.
  const canLog = !isInReview(project.status);

  return (
    <section className="rounded-lg border border-line bg-white px-5 py-5">
      <p className={label}>Pick up where you left off</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 className="min-w-0 text-xl font-bold tracking-tight break-words">
          <Link href={href} className="hover:underline">
            {project.title}
          </Link>
        </h2>
        <TierPill tier={project.tier} />
        <StatusPill status={project.status} />
      </div>

      <div className="mt-5">
        <FlightStepper status={project.status} compact />
      </div>

      <p className="mt-5 text-sm text-hc-dark/80">
        {nextStepSentence(project.status, phaseMinutes)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button href={`${href}#log`} disabled={!canLog}>
          <Icon name="plus" />
          New journal entry
        </Button>
        <Button href={href} variant="secondary">
          Open aircraft
        </Button>
      </div>
    </section>
  );
}

const REVIEW_NAME = { design: "Design Review", flight: "Flight Review" } as const;

function NeedsYou({ items }: { items: ReturnedItem[] }) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-sm font-medium">Needs you</h2>
        {items.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-hc-muted">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-hc-dark/70">You&apos;re all caught up.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {items.map((r) => (
            <li key={r.projectId} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="min-w-0 truncate font-medium">{r.title}</span>
                <span className={label}>{REVIEW_NAME[r.kind]} returned</span>
                <time
                  dateTime={r.returnedAt.toISOString()}
                  className="ml-auto font-mono text-xs text-hc-muted"
                >
                  {formatDate(r.returnedAt)}
                </time>
              </div>
              {r.feedback ? (
                <p className="line-clamp-4 border-l-2 border-hc-red pl-3 text-sm whitespace-pre-line text-hc-dark">
                  {r.feedback}
                </p>
              ) : (
                <p className="text-sm text-hc-muted">No feedback left.</p>
              )}
              <Link
                href={`/projects/${r.projectId}`}
                className="inline-flex items-center gap-1 text-sm text-hc-blue hover:underline"
              >
                Fix and resubmit
                <Icon name="chevron-right" size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
