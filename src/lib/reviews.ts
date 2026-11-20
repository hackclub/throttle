import "server-only";
import { and, asc, desc, eq, gt, ne, not, or, sql, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import {
  auditLog,
  logEntries,
  projects,
  reviews,
  submissions,
  users,
  type LogEntry,
  type Project,
  type Review,
  type Submission,
} from "@/lib/db/schema";

export type SubmissionKind = Submission["kind"];

/** A claim older than this is up for grabs again. */
export const CLAIM_MINUTES = 30;
const CLAIM_SECONDS = CLAIM_MINUTES * 60;

export function parseKind(value: string | string[] | undefined): SubmissionKind {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "flight" ? "flight" : "design";
}

const owner = alias(users, "owner");
const claimer = alias(users, "claimer");
const reviewer = alias(users, "reviewer");
const actor = alias(users, "actor");

// Durations are worked out by the database clock so nothing reads the clock
// during render.
const secondsSince = (col: SQLWrapper) =>
  sql<number>`extract(epoch from (now() - ${col}))`.mapWith(Number);

const claimWindow = sql.raw(`interval '${CLAIM_MINUTES} minutes'`);

/** Minutes the submission can claim: entries of its phase logged before it was created. */
const phaseMinutes = sql<number>`(
  select coalesce(sum(${logEntries.minutes}), 0) from ${logEntries}
  where ${logEntries.projectId} = ${submissions.projectId}
    and ${logEntries.phase}::text = (case when ${submissions.kind} = 'design' then 'design' else 'build' end)
    and ${logEntries.createdAt} < ${submissions.createdAt}
)`.mapWith(Number);

/** 1 when someone other than the viewer holds a fresh claim, so those sort last. */
const heldByOther = (viewerId: string) =>
  sql<number>`case when ${submissions.claimedById} is not null
    and ${submissions.claimedById} <> ${viewerId}
    and ${submissions.claimedAt} > now() - ${claimWindow}
    then 1 else 0 end`;

export type Claim = { byId: string; byName: string; ageSeconds: number };

/** A claim that still counts (younger than CLAIM_MINUTES), else null. */
function freshClaim(
  byId: string | null,
  byName: string | null,
  ageSeconds: number | null,
): Claim | null {
  if (!byId || ageSeconds === null || ageSeconds >= CLAIM_SECONDS) return null;
  return { byId, byName: byName ?? "Someone", ageSeconds };
}

export type QueueRow = {
  id: string;
  projectId: string;
  title: string;
  tier: number;
  makerName: string;
  minutes: number;
  waitingSeconds: number;
  claim: Claim | null;
};

/** Pending submissions of a kind, oldest first. */
export async function listQueue(kind: SubmissionKind): Promise<QueueRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: submissions.id,
      projectId: projects.id,
      title: projects.title,
      tier: projects.tier,
      makerName: owner.name,
      minutes: phaseMinutes,
      waitingSeconds: secondsSince(submissions.createdAt),
      claimedById: submissions.claimedById,
      claimerName: claimer.name,
      claimAgeSeconds: secondsSince(submissions.claimedAt),
    })
    .from(submissions)
    .innerJoin(projects, eq(submissions.projectId, projects.id))
    .innerJoin(owner, eq(projects.ownerId, owner.id))
    .leftJoin(claimer, eq(submissions.claimedById, claimer.id))
    .where(and(eq(submissions.status, "pending"), eq(submissions.kind, kind)))
    .orderBy(asc(submissions.createdAt));

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    tier: r.tier,
    makerName: r.makerName,
    minutes: r.minutes,
    waitingSeconds: r.waitingSeconds,
    claim: freshClaim(r.claimedById, r.claimerName, r.claimAgeSeconds),
  }));
}

export type QueueStats = {
  pending: Record<SubmissionKind, number>;
  /** Longest wait in the selected kind's queue, or null when it's empty. */
  oldestSeconds: number | null;
  /** Mean submission -> review time over the last 30 days, or null with no reviews. */
  avgTurnaroundSeconds: number | null;
};

export async function queueStats(kind: SubmissionKind): Promise<QueueStats> {
  const db = await getDb();
  const [[counts], [turnaround]] = await Promise.all([
    db
      .select({
        design: sql<number>`count(*) filter (where ${submissions.kind} = 'design')`.mapWith(Number),
        flight: sql<number>`count(*) filter (where ${submissions.kind} = 'flight')`.mapWith(Number),
        oldest: sql<number | null>`max(extract(epoch from (now() - ${submissions.createdAt}))) filter (where ${submissions.kind} = ${kind})`.mapWith(
          Number,
        ),
      })
      .from(submissions)
      .where(eq(submissions.status, "pending")),
    db
      .select({
        avg: sql<number | null>`avg(extract(epoch from (${reviews.createdAt} - ${submissions.createdAt})))`.mapWith(
          Number,
        ),
      })
      .from(reviews)
      .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
      .where(
        and(
          eq(submissions.kind, kind),
          sql`${reviews.createdAt} > now() - interval '30 days'`,
        ),
      ),
  ]);

  return {
    pending: { design: counts?.design ?? 0, flight: counts?.flight ?? 0 },
    oldestSeconds: counts?.oldest ?? null,
    avgTurnaroundSeconds: turnaround?.avg ?? null,
  };
}

/** Someone marked this review's HCB grant as sent (an audit entry, no schema change). */
export const grantSent = sql<boolean>`exists (select 1 from ${auditLog} where ${auditLog.action} = 'grant.sent'
    and ${auditLog.targetType} = 'review' and ${auditLog.targetId} = ${reviews.id})`;

export type GrantToSend = {
  reviewId: string;
  projectId: string;
  title: string;
  ownerName: string;
  ownerEmail: string;
  grantCents: number;
  createdAt: Date;
};

/** Approved Design Reviews whose HCB grant hasn't been marked as sent yet. Oldest first. */
export async function listGrantsToSend(): Promise<GrantToSend[]> {
  const db = await getDb();
  return db
    .select({
      reviewId: reviews.id,
      projectId: projects.id,
      title: projects.title,
      ownerName: owner.name,
      ownerEmail: owner.email,
      grantCents: reviews.grantCents,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
    .innerJoin(projects, eq(reviews.projectId, projects.id))
    .innerJoin(owner, eq(projects.ownerId, owner.id))
    .where(
      and(
        eq(reviews.result, "approved"),
        eq(submissions.kind, "design"),
        gt(reviews.grantCents, 0),
        not(grantSent),
      ),
    )
    .orderBy(asc(reviews.createdAt));
}

export type HistoryReview = Review & {
  kind: SubmissionKind;
  reviewerName: string | null;
  grantSent: boolean;
};

export type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  actorName: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
};

export type ReviewDetail = {
  submission: Submission;
  project: Project;
  owner: { id: string; name: string; email: string };
  waitingSeconds: number;
  /** Fresh claim by anyone (including the viewer), else null. */
  claim: Claim | null;
  /** All of the project's entries, newest first. */
  entries: LogEntry[];
  /** Every review of this project, newest first. */
  history: HistoryReview[];
  /** Newest first. */
  audit: AuditRow[];
};

export async function getReviewDetail(submissionId: string): Promise<ReviewDetail | null> {
  const db = await getDb();
  const [head] = await db
    .select({
      submission: submissions,
      project: projects,
      owner: { id: owner.id, name: owner.name, email: owner.email },
      waitingSeconds: secondsSince(submissions.createdAt),
      claimerName: claimer.name,
      claimAgeSeconds: secondsSince(submissions.claimedAt),
    })
    .from(submissions)
    .innerJoin(projects, eq(submissions.projectId, projects.id))
    .innerJoin(owner, eq(projects.ownerId, owner.id))
    .leftJoin(claimer, eq(submissions.claimedById, claimer.id))
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!head) return null;

  const projectId = head.project.id;
  const [entries, historyRows, audit] = await Promise.all([
    db
      .select()
      .from(logEntries)
      .where(eq(logEntries.projectId, projectId))
      .orderBy(desc(logEntries.createdAt)),
    db
      .select({
        review: reviews,
        kind: submissions.kind,
        reviewerName: reviewer.name,
        grantSent,
      })
      .from(reviews)
      .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
      .leftJoin(reviewer, eq(reviews.reviewerId, reviewer.id))
      .where(eq(reviews.projectId, projectId))
      .orderBy(desc(reviews.createdAt)),
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        targetType: auditLog.targetType,
        actorName: actor.name,
        meta: auditLog.meta,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(actor, eq(auditLog.actorId, actor.id))
      .where(
        or(
          and(eq(auditLog.targetType, "project"), eq(auditLog.targetId, projectId)),
          sql`${auditLog.meta}->>'projectId' = ${projectId}`,
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(100),
  ]);

  return {
    submission: head.submission,
    project: head.project,
    owner: head.owner,
    waitingSeconds: head.waitingSeconds,
    claim: freshClaim(head.submission.claimedById, head.claimerName, head.claimAgeSeconds),
    entries,
    history: historyRows.map((r) => ({
      ...r.review,
      kind: r.kind,
      reviewerName: r.reviewerName,
      grantSent: r.grantSent === true,
    })),
    audit,
  };
}

/**
 * The oldest pending submission of a kind, skipping `excludeId`. Ones someone
 * else is actively reviewing come last. With `after`, starts looking after
 * that submission and wraps around, so Skip walks the queue instead of
 * bouncing between the first two.
 */
export async function nextPendingId(
  kind: SubmissionKind,
  viewerId: string,
  opts: { excludeId?: string; after?: Date } = {},
): Promise<string | null> {
  const db = await getDb();
  const find = async (after?: Date) => {
    const [row] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.status, "pending"),
          eq(submissions.kind, kind),
          opts.excludeId ? ne(submissions.id, opts.excludeId) : undefined,
          after ? gt(submissions.createdAt, after) : undefined,
        ),
      )
      .orderBy(asc(heldByOther(viewerId)), asc(submissions.createdAt))
      .limit(1);
    return row?.id ?? null;
  };
  return (opts.after ? await find(opts.after) : null) ?? (await find());
}
