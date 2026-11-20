import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  logEntries,
  projects,
  reviews,
  submissions,
  users,
  type LogEntry,
  type Project,
  type Review,
  type Submission,
  type User,
} from "@/lib/db/schema";
import { isReviewer } from "@/lib/auth/session";
import { OPEN_STATUSES, isClosed, isInReview } from "@/lib/status";

export type ProjectSummary = Project & { designMinutes: number; buildMinutes: number };

export type ProjectOwner = Pick<User, "id" | "name" | "avatarUrl">;

/** A review without the internal justification, safe to render to the maker. */
export type PublicReview = Omit<Review, "justification">;

export type ProjectDetail = {
  project: Project;
  owner: ProjectOwner;
  /** Newest first. */
  entries: LogEntry[];
  /** Newest first. */
  submissions: Submission[];
  /** Newest first. */
  reviews: PublicReview[];
};

const publicReviewColumns = {
  id: reviews.id,
  submissionId: reviews.submissionId,
  projectId: reviews.projectId,
  reviewerId: reviews.reviewerId,
  result: reviews.result,
  hoursSubmitted: reviews.hoursSubmitted,
  hoursOverride: reviews.hoursOverride,
  tier: reviews.tier,
  tierOverride: reviews.tierOverride,
  grantCents: reviews.grantCents,
  fuel: reviews.fuel,
  feedback: reviews.feedback,
  createdAt: reviews.createdAt,
};

const minutesIn = (phase: LogEntry["phase"]) =>
  sql<number>`coalesce(sum(${logEntries.minutes}) filter (where ${logEntries.phase} = ${phase}), 0)`.mapWith(
    Number,
  );

/** The user's aircraft, most recently touched first, with logged minutes per phase. */
export async function listProjectsForUser(userId: string): Promise<ProjectSummary[]> {
  const db = await getDb();
  const rows = await db
    .select({
      project: projects,
      designMinutes: minutesIn("design"),
      buildMinutes: minutesIn("build"),
    })
    .from(projects)
    .leftJoin(logEntries, eq(logEntries.projectId, projects.id))
    .where(eq(projects.ownerId, userId))
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt));

  return rows.map((r) => ({
    ...r.project,
    designMinutes: r.designMinutes,
    buildMinutes: r.buildMinutes,
  }));
}

/** Sum of grants from approved Design Reviews across the user's aircraft, in cents. */
export async function approvedGrantCentsForUser(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${reviews.grantCents}), 0)`.mapWith(Number),
    })
    .from(reviews)
    .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
    .innerJoin(projects, eq(reviews.projectId, projects.id))
    .where(
      and(
        eq(projects.ownerId, userId),
        eq(reviews.result, "approved"),
        eq(submissions.kind, "design"),
      ),
    );
  return row?.total ?? 0;
}

export type ReturnedItem = {
  projectId: string;
  title: string;
  kind: Submission["kind"];
  /** What the reviewer told the maker. Never the internal justification. */
  feedback: string | null;
  returnedAt: Date;
};

/** The user's aircraft currently sent back for changes, with the latest feedback for each. */
export async function listReturnedForUser(userId: string): Promise<ReturnedItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      projectId: projects.id,
      title: projects.title,
      status: projects.status,
      kind: submissions.kind,
      feedback: reviews.feedback,
      returnedAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
    .innerJoin(projects, eq(reviews.projectId, projects.id))
    .where(
      and(
        eq(projects.ownerId, userId),
        eq(reviews.result, "returned"),
        inArray(projects.status, ["design_returned", "flight_returned"]),
      ),
    )
    .orderBy(desc(reviews.createdAt));

  const seen = new Set<string>();
  const items: ReturnedItem[] = [];
  for (const r of rows) {
    // Only the review that put the project in its current returned state.
    const matches = r.status === (r.kind === "design" ? "design_returned" : "flight_returned");
    if (!matches || seen.has(r.projectId)) continue;
    seen.add(r.projectId);
    items.push({
      projectId: r.projectId,
      title: r.title,
      kind: r.kind,
      feedback: r.feedback,
      returnedAt: r.returnedAt,
    });
  }
  return items;
}

export type LoggedDay = {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  minutes: number;
  entries: number;
};

/** Minutes the user logged per UTC day over the last 182 days (26 weeks). */
export async function loggedDaysForUser(userId: string): Promise<LoggedDay[]> {
  const db = await getDb();
  const day = sql<string>`to_char(date_trunc('day', ${logEntries.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  return db
    .select({
      day,
      minutes: sql<number>`sum(${logEntries.minutes})`.mapWith(Number),
      entries: sql<number>`count(*)`.mapWith(Number),
    })
    .from(logEntries)
    .where(
      and(
        eq(logEntries.authorId, userId),
        sql`${logEntries.createdAt} > now() - interval '182 days'`,
      ),
    )
    .groupBy(day)
    .orderBy(day);
}

/** Everything the project workspace needs. Deduplicated per request. */
export const getProject = cache(async (id: string): Promise<ProjectDetail | null> => {
  const db = await getDb();
  const [head] = await db
    .select({
      project: projects,
      owner: { id: users.id, name: users.name, avatarUrl: users.avatarUrl },
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerId, users.id))
    .where(eq(projects.id, id))
    .limit(1);
  if (!head) return null;

  const [entryRows, submissionRows, reviewRows] = await Promise.all([
    db
      .select()
      .from(logEntries)
      .where(eq(logEntries.projectId, id))
      .orderBy(desc(logEntries.createdAt)),
    db
      .select()
      .from(submissions)
      .where(eq(submissions.projectId, id))
      .orderBy(desc(submissions.createdAt)),
    db
      .select(publicReviewColumns)
      .from(reviews)
      .where(eq(reviews.projectId, id))
      .orderBy(desc(reviews.createdAt)),
  ]);

  return {
    project: head.project,
    owner: head.owner,
    entries: entryRows,
    submissions: submissionRows,
    reviews: reviewRows,
  };
});

/** Most recent approved review of the given kind, or null. */
export async function latestApprovedReview(
  projectId: string,
  kind: Submission["kind"],
): Promise<PublicReview | null> {
  const db = await getDb();
  const [row] = await db
    .select(publicReviewColumns)
    .from(reviews)
    .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
    .where(
      and(
        eq(reviews.projectId, projectId),
        eq(submissions.kind, kind),
        eq(reviews.result, "approved"),
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(1);
  return row ?? null;
}

type Viewer = Pick<User, "id" | "role">;

export function canView(user: Viewer, project: Pick<Project, "ownerId">): boolean {
  return user.id === project.ownerId || isReviewer(user);
}

export function canEdit(user: Viewer, project: Pick<Project, "ownerId" | "status">): boolean {
  return user.id === project.ownerId && !isClosed(project.status);
}

/** Owners can remove an entry while its phase is still open and nothing is in review. */
export function canDeleteEntry(
  user: Viewer,
  project: Pick<Project, "ownerId" | "status">,
  entry: Pick<LogEntry, "phase">,
): boolean {
  return (
    canEdit(user, project) &&
    !isInReview(project.status) &&
    OPEN_STATUSES[entry.phase].includes(project.status)
  );
}

export function minutesByPhase(entries: Pick<LogEntry, "phase" | "minutes">[]): {
  design: number;
  build: number;
} {
  const totals = { design: 0, build: 0 };
  for (const e of entries) totals[e.phase] += e.minutes;
  return totals;
}

/**
 * Minutes a submission can claim: entries of the matching phase (design for
 * Design Review, build for Flight Review) logged before it was created. A
 * phase closes once its review is approved, so nothing is counted twice.
 */
export function reviewableMinutes(
  entries: Pick<LogEntry, "phase" | "minutes" | "createdAt">[],
  submission: Pick<Submission, "kind" | "createdAt">,
): number {
  const phase: LogEntry["phase"] = submission.kind === "design" ? "design" : "build";
  return entries
    .filter((e) => e.phase === phase && e.createdAt < submission.createdAt)
    .reduce((sum, e) => sum + e.minutes, 0);
}

/** Hours a review settled on (the reviewer's override wins). */
export function reviewedHours(review: Pick<Review, "hoursSubmitted" | "hoursOverride">): number {
  return review.hoursOverride ?? review.hoursSubmitted;
}

/** Tier a review settled on (the reviewer's override wins). */
export function reviewedTier(review: Pick<Review, "tier" | "tierOverride">): number {
  return review.tierOverride ?? review.tier;
}
