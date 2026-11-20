"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { requireReviewer } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  auditLog,
  logEntries,
  projects,
  reviews,
  submissions,
  users,
  type Project,
} from "@/lib/db/schema";
import { reviewableMinutes } from "@/lib/projects";
import { CLAIM_MINUTES, nextPendingId } from "@/lib/reviews";
import { fuelFor, grantCents, isTier, minutesToHours, toTier } from "@/lib/tiers";
import {
  MAX_OVERRIDE_HOURS,
  MAX_REVIEW_TEXT_CHARS,
  MIN_JUSTIFICATION_CHARS,
  RESULTS,
  type DecideState,
  type ReviewResult,
} from "./form-state";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * Marks the submission as being looked at by this reviewer, unless someone
 * else holds a claim younger than CLAIM_MINUTES.
 */
export async function claimSubmission(submissionId: string): Promise<{ claimed: boolean }> {
  const user = await requireReviewer();
  const db = await getDb();
  const rows = await db
    .update(submissions)
    .set({ claimedById: user.id, claimedAt: sql`now()` })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.status, "pending"),
        or(
          isNull(submissions.claimedById),
          eq(submissions.claimedById, user.id),
          isNull(submissions.claimedAt),
          lt(submissions.claimedAt, sql`now() - ${sql.raw(`interval '${CLAIM_MINUTES} minutes'`)}`),
        ),
      ),
    )
    .returning({ id: submissions.id });
  return { claimed: rows.length > 0 };
}

const NEXT_STATUS: Record<"design" | "flight", Record<ReviewResult, Project["status"]>> = {
  design: { approved: "parts_funded", returned: "design_returned", rejected: "rejected" },
  flight: { approved: "airborne", returned: "flight_returned", rejected: "rejected" },
};

export async function decide(_prev: DecideState, formData: FormData): Promise<DecideState> {
  const user = await requireReviewer();
  const submissionId = str(formData, "submissionId");
  const result = str(formData, "result") as ReviewResult;
  if (!RESULTS.includes(result)) return { error: "Pick Approve, Return or Reject." };

  const db = await getDb();
  const [row] = await db
    .select({ submission: submissions, project: projects })
    .from(submissions)
    .innerJoin(projects, eq(submissions.projectId, projects.id))
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!row) return { error: "That submission doesn't exist." };
  const { submission, project } = row;
  if (submission.status !== "pending") return { error: "This submission was already decided." };

  const fieldErrors: NonNullable<DecideState["fieldErrors"]> = {};

  // Recomputed here so the panel can't send a different number.
  const entries = await db
    .select({ phase: logEntries.phase, minutes: logEntries.minutes, createdAt: logEntries.createdAt })
    .from(logEntries)
    .where(eq(logEntries.projectId, project.id));
  const hoursSubmitted = minutesToHours(reviewableMinutes(entries, submission));

  const rawOverride = str(formData, "hoursOverride").trim();
  let hoursOverride: number | null = null;
  if (rawOverride !== "") {
    const n = Number(rawOverride);
    if (!Number.isFinite(n) || n < 0 || n > MAX_OVERRIDE_HOURS) {
      fieldErrors.hoursOverride = `Hours must be between 0 and ${MAX_OVERRIDE_HOURS}.`;
    } else {
      const rounded = Math.round(n * 100) / 100;
      hoursOverride = rounded === hoursSubmitted ? null : rounded;
    }
  }

  const projectTier = toTier(project.tier);
  const rawTier = Number(str(formData, "tier") || projectTier);
  if (!isTier(rawTier)) fieldErrors.tier = "Pick a tier.";
  const tierOverride = isTier(rawTier) && rawTier !== projectTier ? rawTier : null;

  const justification = str(formData, "justification").trim();
  if (justification.length < MIN_JUSTIFICATION_CHARS) {
    fieldErrors.justification = `Write at least ${MIN_JUSTIFICATION_CHARS} characters: what did you check?`;
  } else if (justification.length > MAX_REVIEW_TEXT_CHARS) {
    fieldErrors.justification = `Keep it under ${MAX_REVIEW_TEXT_CHARS.toLocaleString("en-US")} characters.`;
  }

  const feedback = str(formData, "feedback").trim();
  if (result !== "approved" && feedback.length === 0) {
    fieldErrors.feedback = "Tell the builder what to change.";
  } else if (feedback.length > MAX_REVIEW_TEXT_CHARS) {
    fieldErrors.feedback = `Keep it under ${MAX_REVIEW_TEXT_CHARS.toLocaleString("en-US")} characters.`;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const hours = hoursOverride ?? hoursSubmitted;
  const tier = tierOverride ?? projectTier;
  const approved = result === "approved";
  const grant = approved && submission.kind === "design" ? grantCents(hours, tier) : 0;
  const fuel = approved && submission.kind === "flight" ? fuelFor(hours, tier) : 0;

  // Only one decision can flip it out of pending, so a double click or two
  // reviewers deciding at once can't pay out twice.
  const locked = await db
    .update(submissions)
    .set({ status: result, claimedById: null, claimedAt: null })
    .where(and(eq(submissions.id, submission.id), eq(submissions.status, "pending")))
    .returning({ id: submissions.id });
  if (locked.length === 0) return { error: "Someone else just decided this one." };

  const [review] = await db
    .insert(reviews)
    .values({
      submissionId: submission.id,
      projectId: project.id,
      reviewerId: user.id,
      result,
      hoursSubmitted,
      hoursOverride,
      tier: projectTier,
      tierOverride,
      grantCents: grant,
      fuel,
      justification,
      feedback: feedback || null,
    })
    .returning({ id: reviews.id });

  await db
    .update(projects)
    .set({
      status: NEXT_STATUS[submission.kind][result],
      ...(approved && submission.kind === "design" ? { tier } : {}),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  if (fuel > 0) {
    await db
      .update(users)
      .set({ fuel: sql`${users.fuel} + ${fuel}` })
      .where(eq(users.id, project.ownerId));
  }

  await logAudit(user.id, `review.${result}`, "submission", submission.id, {
    projectId: project.id,
    reviewId: review.id,
    kind: submission.kind,
    hoursSubmitted,
    hoursOverride,
    tier,
    tierOverride,
    grantCents: grant,
    fuel,
  });

  revalidatePath("/admin", "layout");
  revalidatePath(`/projects/${project.id}`);
  revalidatePath("/hangar");

  const next = await nextPendingId(submission.kind, user.id);
  redirect(next ? `/admin/reviews/${next}` : `/admin/reviews?kind=${submission.kind}`);
}

/** Records (in the audit log) that an approved design grant was sent on HCB. */
export async function markGrantSent(formData: FormData): Promise<void> {
  const user = await requireReviewer();
  const reviewId = str(formData, "reviewId");
  const db = await getDb();

  const [row] = await db
    .select({ review: reviews, kind: submissions.kind })
    .from(reviews)
    .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
    .where(eq(reviews.id, reviewId))
    .limit(1);
  if (!row || row.kind !== "design" || row.review.result !== "approved") return;

  const [already] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "grant.sent"),
        eq(auditLog.targetType, "review"),
        eq(auditLog.targetId, reviewId),
      ),
    )
    .limit(1);
  if (already) return;

  await logAudit(user.id, "grant.sent", "review", reviewId, {
    projectId: row.review.projectId,
    grantCents: row.review.grantCents,
  });
  revalidatePath("/admin", "layout");
}
