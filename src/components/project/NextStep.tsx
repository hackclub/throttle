import { connection } from "next/server";
import type { ReactNode } from "react";
import { ArtSlot } from "@/components/ui/ArtSlot";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { fetchBom, isBomError } from "@/lib/bom";
import type { LogEntry, Project, Submission } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { parseRepoUrl } from "@/lib/github";
import type { PublicReview } from "@/lib/projects";
import { formatHoursExact, minutesToHours } from "@/lib/tiers";

type Props = {
  project: Pick<Project, "id" | "status" | "repoUrl">;
  entries: Pick<LogEntry, "phase" | "minutes">[];
  /** Newest first. */
  submissions: Pick<Submission, "id" | "kind" | "status" | "createdAt">[];
  /** Newest first. */
  reviews: Pick<PublicReview, "submissionId" | "result" | "feedback">[];
  /** Owner of a project that's still open. Viewers see the state, not the buttons. */
  canAct: boolean;
};

export async function NextStep({ project, entries, submissions, reviews, canAct }: Props) {
  const { status } = project;

  if (status === "design_review" || status === "flight_review") {
    const pending = submissions.find((s) => s.status === "pending");
    return (
      <Panel title="In review">
        <p className="text-sm text-hc-dark/80">
          {status === "design_review" ? "Design Review" : "Flight Review"} is with a reviewer.
          The log is locked until it comes back.
        </p>
        {pending && (
          <p className="mt-3 font-mono text-xs text-hc-muted">
            Submitted {formatDate(pending.createdAt)}
          </p>
        )}
      </Panel>
    );
  }

  if (status === "airborne") {
    return (
      <Panel title="Airborne">
        <div className="flex items-center gap-4">
          <ArtSlot name="stamp-airborne.svg" ratio="1/1" className="w-20 shrink-0" />
          <p className="text-sm text-hc-dark/80">Shipped.</p>
        </div>
      </Panel>
    );
  }

  const latestFeedback = (kind: Submission["kind"], result: PublicReview["result"]) => {
    const kindOf = new Map(submissions.map((s) => [s.id, s.kind]));
    return reviews.find((r) => r.result === result && kindOf.get(r.submissionId) === kind)
      ?.feedback;
  };

  if (status === "rejected") {
    const feedback =
      latestFeedback("flight", "rejected") ?? latestFeedback("design", "rejected");
    return (
      <Panel title="Rejected">
        <p className="text-sm text-hc-dark/80">This aircraft won&apos;t move forward.</p>
        {feedback && <Feedback text={feedback} />}
      </Panel>
    );
  }

  const designPhase = status === "drafting" || status === "design_returned";
  const phase = designPhase ? "design" : "build";
  const phaseEntries = entries.filter((e) => e.phase === phase);
  const phaseMinutes = phaseEntries.reduce((sum, e) => sum + e.minutes, 0);
  const feedback =
    status === "design_returned"
      ? latestFeedback("design", "returned")
      : status === "flight_returned"
        ? latestFeedback("flight", "returned")
        : null;

  const logged = (
    <span className="font-mono text-xs text-hc-muted">
      {phaseEntries.length} logged · {formatHoursExact(minutesToHours(phaseMinutes))}
    </span>
  );

  if (designPhase) {
    await connection();
    const bom = await fetchBom(project.repoUrl);
    const checks: Check[] = [
      { ok: phaseEntries.length > 0, label: "At least 1 design entry", detail: logged },
      { ok: parseRepoUrl(project.repoUrl) !== null, label: "Repo link set" },
      { ok: !isBomError(bom), label: "bom.csv found in repo root" },
    ];
    const ready = checks.every((c) => c.ok);
    return (
      <Panel title="Next: Design Review">
        {feedback && <Feedback text={feedback} />}
        <Checklist checks={checks} />
        {canAct && (
          <Button
            href={`/submit/design?project=${project.id}`}
            disabled={!ready}
            className="mt-5 w-full"
          >
            Submit for Design Review
          </Button>
        )}
      </Panel>
    );
  }

  const checks: Check[] = [
    { ok: phaseEntries.length > 0, label: "At least 1 build entry", detail: logged },
  ];
  const ready = checks.every((c) => c.ok);
  return (
    <Panel title="Next: Flight Review">
      {feedback && <Feedback text={feedback} />}
      <Checklist checks={checks} />
      <p className="mt-3 text-sm text-hc-muted">
        Fly it, film the maiden flight, then send it in.
      </p>
      {canAct && (
        <Button
          href={`/submit/flight?project=${project.id}`}
          disabled={!ready}
          className="mt-5 w-full"
        >
          Submit maiden flight
        </Button>
      )}
    </Panel>
  );
}

type Check = { ok: boolean; label: string; detail?: ReactNode };

function Checklist({ checks }: { checks: Check[] }) {
  return (
    <ul className="space-y-2.5">
      {checks.map((c) => (
        <li key={c.label} className="flex items-start gap-2.5 text-sm">
          <Icon
            name={c.ok ? "check" : "x"}
            label={c.ok ? "Done" : "Not yet"}
            className={cx("mt-0.5 shrink-0", c.ok ? "text-hc-dark" : "text-hc-red")}
          />
          <span className="min-w-0">
            <span className={c.ok ? "text-hc-dark" : "text-hc-dark/80"}>{c.label}</span>
            {c.detail && <span className="block">{c.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Feedback({ text }: { text: string }) {
  return (
    <div className="mb-4 rounded-lg border border-l-2 border-line border-l-hc-red px-3 py-2.5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-hc-muted">
        Reviewer feedback
      </p>
      <p className="mt-1 text-sm whitespace-pre-line text-hc-dark">{text}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white px-5 py-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function NextStepSkeleton() {
  return <div className="h-48 rounded-lg border border-line bg-white" aria-hidden />;
}
