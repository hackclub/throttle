import { SubmissionPill } from "@/components/ui/Pill";
import type { Submission } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import type { PublicReview } from "@/lib/projects";

const KIND_LABEL: Record<Submission["kind"], string> = {
  design: "Design Review",
  flight: "Flight Review",
};

type Props = {
  /** Newest first. */
  submissions: Pick<Submission, "id" | "kind" | "status" | "createdAt">[];
  /** Newest first. */
  reviews: Pick<PublicReview, "submissionId" | "feedback">[];
};

export function SubmissionsList({ submissions, reviews }: Props) {
  if (submissions.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white px-5 py-10 text-center text-sm text-hc-dark/70">
        Nothing submitted yet.
      </div>
    );
  }

  // Reviews come newest first, so the first one seen per submission is the latest.
  const feedbackFor = new Map<string, string>();
  for (const r of reviews) {
    if (r.feedback && !feedbackFor.has(r.submissionId)) feedbackFor.set(r.submissionId, r.feedback);
  }

  return (
    <ol className="divide-y divide-line rounded-lg border border-line bg-white">
      {submissions.map((s) => {
        const feedback = feedbackFor.get(s.id);
        return (
          <li key={s.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{KIND_LABEL[s.kind]}</span>
              <SubmissionPill status={s.status} />
              <time
                dateTime={s.createdAt.toISOString()}
                className="ml-auto font-mono text-xs text-hc-muted"
              >
                {formatDate(s.createdAt)}
              </time>
            </div>
            {feedback && (
              <p className="mt-2 text-sm whitespace-pre-line text-hc-dark/80">{feedback}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
