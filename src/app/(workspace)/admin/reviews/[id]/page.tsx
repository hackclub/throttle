import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BomPanel, BomSkeleton } from "@/components/project/BomPanel";
import { ClaimOnOpen } from "@/components/review/ClaimOnOpen";
import { HistoryPanel, JournalPanel, SubmissionPanel } from "@/components/review/ReviewPanels";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";
import { SubmissionPill } from "@/components/ui/Pill";
import { requireReviewer } from "@/lib/auth/session";
import { formatDuration } from "@/lib/format";
import { parseRepoUrl, repoWebUrl } from "@/lib/github";
import { reviewableMinutes } from "@/lib/projects";
import { getReviewDetail, nextPendingId } from "@/lib/reviews";
import { minutesToHours, toTier } from "@/lib/tiers";

export const metadata: Metadata = { title: "Review · Throttle" };

type Props = { params: Promise<{ id: string }> };

export default function ReviewPage({ params }: Props) {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <Review params={params} />
    </Suspense>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-14 rounded-lg border border-line bg-white" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-96 rounded-lg border border-line bg-white lg:col-span-2" />
        <div className="h-[560px] rounded-lg border border-line bg-white" />
      </div>
    </div>
  );
}

async function Review({ params }: Props) {
  const user = await requireReviewer();
  const { id } = await params;
  const detail = await getReviewDetail(id);
  if (!detail) notFound();

  const { submission, project, owner, claim } = detail;
  const kind = submission.kind;
  const pending = submission.status === "pending";
  const phase = kind === "design" ? "design" : "build";

  // Same entries reviewableMinutes counts: this phase, logged before submitting.
  const phaseEntries = detail.entries.filter(
    (e) => e.phase === phase && e.createdAt < submission.createdAt,
  );
  const hoursSubmitted = minutesToHours(reviewableMinutes(detail.entries, submission));

  const queueHref = `/admin/reviews?kind=${kind}`;
  const skipId = await nextPendingId(kind, user.id, {
    excludeId: submission.id,
    after: submission.createdAt,
  });
  const repo = parseRepoUrl(project.repoUrl);
  const otherClaim = pending && claim && claim.byId !== user.id ? claim : null;

  return (
    <>
      {pending && <ClaimOnOpen submissionId={submission.id} />}
      <ReviewWorkspace
        submissionId={submission.id}
        kind={kind}
        title={project.title}
        makerName={owner.name}
        makerEmail={owner.email}
        waiting={pending ? `waiting ${formatDuration(detail.waitingSeconds)}` : "decided"}
        repoUrl={repo ? repoWebUrl(repo) : null}
        queueHref={queueHref}
        skipHref={skipId ? `/admin/reviews/${skipId}` : queueHref}
        banner={
          otherClaim && (
            <div className="rounded-lg border border-hc-yellow bg-hc-yellow/15 px-4 py-2.5 text-sm text-hc-dark">
              <span className="font-medium">{otherClaim.byName}</span> is reviewing this (claimed{" "}
              <span className="font-mono tabular-nums">{formatDuration(otherClaim.ageSeconds)}</span>{" "}
              ago). You can still look.
            </div>
          )
        }
        panels={{
          journal: <JournalPanel entries={phaseEntries} />,
          bom: (
            <Suspense fallback={<BomSkeleton />}>
              <BomPanel repoUrl={project.repoUrl} />
            </Suspense>
          ),
          submission: <SubmissionPanel submission={submission} />,
          history: (
            <HistoryPanel reviews={detail.history} audit={detail.audit} ownerEmail={owner.email} />
          ),
        }}
        decidedNote={
          pending ? null : (
            <div className="space-y-2 rounded-lg border border-line bg-white px-5 py-4 text-sm">
              <SubmissionPill status={submission.status} />
              <p className="text-hc-dark/80">
                This submission has already been decided. See History for the review.
              </p>
            </div>
          )
        }
        hoursSubmitted={hoursSubmitted}
        projectTier={toTier(project.tier)}
      />
    </>
  );
}
