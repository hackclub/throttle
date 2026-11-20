import "server-only";
import { and, asc, count, desc, eq, gt, ilike, inArray, not, or, sql, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import {
  auditLog,
  logEntries,
  projects,
  reviews,
  submissions,
  users,
  type Project,
  type Submission,
  type User,
} from "@/lib/db/schema";
import { grantSent } from "@/lib/reviews";
import type { ProjectStatus } from "@/lib/status";

// Staff panel queries. Every page that calls these runs requireReviewer() first.

export const PAGE_SIZE = 50;

type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePage(value: Param): number {
  const n = Number(first(value));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function parseQuery(value: Param): string {
  return (first(value) ?? "").trim().slice(0, 100);
}

/** ILIKE pattern that treats the search as literal text. */
function contains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const owner = alias(users, "owner");
const actor = alias(users, "actor");
const targetUser = alias(users, "target_user");

const secondsSince = (col: SQLWrapper) =>
  sql<number>`extract(epoch from (now() - ${col}))`.mapWith(Number);

// ---- Overview ----------------------------------------------------------------

export type OverviewStats = {
  pendingDesign: number;
  pendingFlight: number;
  /** Longest wait across both queues, or null when both are empty. */
  oldestSeconds: number | null;
  makers: number;
  airborne: number;
};

export async function getOverviewStats(): Promise<OverviewStats> {
  const db = await getDb();
  const [[pending], [people], [aircraft]] = await Promise.all([
    db
      .select({
        design: sql<number>`count(*) filter (where ${submissions.kind} = 'design')`.mapWith(Number),
        flight: sql<number>`count(*) filter (where ${submissions.kind} = 'flight')`.mapWith(Number),
        oldest: sql<number | null>`max(extract(epoch from (now() - ${submissions.createdAt})))`.mapWith(
          Number,
        ),
      })
      .from(submissions)
      .where(eq(submissions.status, "pending")),
    db.select({ n: count() }).from(users).where(eq(users.role, "maker")),
    db.select({ n: count() }).from(projects).where(eq(projects.status, "airborne")),
  ]);

  return {
    pendingDesign: pending?.design ?? 0,
    pendingFlight: pending?.flight ?? 0,
    oldestSeconds: pending?.oldest ?? null,
    makers: people?.n ?? 0,
    airborne: aircraft?.n ?? 0,
  };
}

export type PendingRow = {
  id: string;
  kind: Submission["kind"];
  title: string;
  makerName: string;
  waitingSeconds: number;
};

/** Oldest pending submissions across both queues. */
export async function listOldestPending(limit = 5): Promise<PendingRow[]> {
  const db = await getDb();
  return db
    .select({
      id: submissions.id,
      kind: submissions.kind,
      title: projects.title,
      makerName: owner.name,
      waitingSeconds: secondsSince(submissions.createdAt),
    })
    .from(submissions)
    .innerJoin(projects, eq(submissions.projectId, projects.id))
    .innerJoin(owner, eq(projects.ownerId, owner.id))
    .where(eq(submissions.status, "pending"))
    .orderBy(asc(submissions.createdAt))
    .limit(limit);
}

// ---- Grants ------------------------------------------------------------------

export const GRANT_FILTERS = [
  { key: "to_send", label: "To send" },
  { key: "sent", label: "Sent" },
  { key: "all", label: "All" },
] as const;

export type GrantFilter = (typeof GRANT_FILTERS)[number]["key"];

export function parseGrantFilter(value: Param): GrantFilter {
  const v = first(value);
  return GRANT_FILTERS.some((f) => f.key === v) ? (v as GrantFilter) : "to_send";
}

export type GrantRow = {
  reviewId: string;
  projectId: string;
  title: string;
  ownerName: string;
  ownerEmail: string;
  hoursSubmitted: number;
  hoursOverride: number | null;
  tier: number;
  tierOverride: number | null;
  grantCents: number;
  approvedAt: Date;
  sent: boolean;
};

/** Every approved Design Review. "To send" is oldest first; the others newest first. */
export async function listGrants(filter: GrantFilter): Promise<GrantRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      reviewId: reviews.id,
      projectId: projects.id,
      title: projects.title,
      ownerName: owner.name,
      ownerEmail: owner.email,
      hoursSubmitted: reviews.hoursSubmitted,
      hoursOverride: reviews.hoursOverride,
      tier: reviews.tier,
      tierOverride: reviews.tierOverride,
      grantCents: reviews.grantCents,
      approvedAt: reviews.createdAt,
      sent: grantSent,
    })
    .from(reviews)
    .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
    .innerJoin(projects, eq(reviews.projectId, projects.id))
    .innerJoin(owner, eq(projects.ownerId, owner.id))
    .where(
      and(
        eq(reviews.result, "approved"),
        eq(submissions.kind, "design"),
        filter === "to_send" ? and(gt(reviews.grantCents, 0), not(grantSent)) : undefined,
        filter === "sent" ? grantSent : undefined,
      ),
    )
    .orderBy(filter === "to_send" ? asc(reviews.createdAt) : desc(reviews.createdAt));

  return rows.map((r) => ({ ...r, sent: r.sent === true }));
}

// ---- Projects ----------------------------------------------------------------

/** Underline tabs. Some cover both the design and flight variant of a status. */
export const PROJECT_FILTERS: { key: string; label: string; statuses: ProjectStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "drafting", label: "Drafting", statuses: ["drafting"] },
  { key: "in_review", label: "In review", statuses: ["design_review", "flight_review"] },
  { key: "parts_funded", label: "Funded", statuses: ["parts_funded"] },
  { key: "airborne", label: "Airborne", statuses: ["airborne"] },
  { key: "returned", label: "Returned", statuses: ["design_returned", "flight_returned"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
];

const ALL_STATUSES: readonly ProjectStatus[] = [
  "drafting",
  "design_review",
  "design_returned",
  "parts_funded",
  "flight_review",
  "flight_returned",
  "airborne",
  "rejected",
];

export type ProjectFilter = { key: string; statuses: ProjectStatus[] | null };

/** A tab key, or any single project_status value. Anything else means All. */
export function parseProjectFilter(value: Param): ProjectFilter {
  const v = first(value);
  const tab = PROJECT_FILTERS.find((f) => f.key === v);
  if (tab) return { key: tab.key, statuses: tab.statuses };
  if (v && (ALL_STATUSES as readonly string[]).includes(v)) {
    return { key: v, statuses: [v as ProjectStatus] };
  }
  return { key: "all", statuses: null };
}

const phaseMinutes = (phase: "design" | "build") =>
  sql<number>`(select coalesce(sum(${logEntries.minutes}), 0) from ${logEntries}
    where ${logEntries.projectId} = ${projects.id} and ${logEntries.phase} = ${phase})`.mapWith(Number);

export type AdminProjectRow = Pick<
  Project,
  "id" | "title" | "category" | "tier" | "status" | "updatedAt"
> & {
  ownerName: string;
  ownerEmail: string;
  designMinutes: number;
  buildMinutes: number;
};

export type Paged<T> = { rows: T[]; total: number; page: number; pageCount: number };

function paged<T>(rows: T[], total: number, page: number): Paged<T> {
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listAllProjects(opts: {
  statuses: ProjectStatus[] | null;
  q: string;
  page: number;
}): Promise<Paged<AdminProjectRow>> {
  const db = await getDb();
  const pattern = contains(opts.q);
  const where = and(
    opts.statuses ? inArray(projects.status, opts.statuses) : undefined,
    opts.q
      ? or(ilike(projects.title, pattern), ilike(owner.name, pattern), ilike(owner.email, pattern))
      : undefined,
  );

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: projects.id,
        title: projects.title,
        category: projects.category,
        tier: projects.tier,
        status: projects.status,
        updatedAt: projects.updatedAt,
        ownerName: owner.name,
        ownerEmail: owner.email,
        designMinutes: phaseMinutes("design"),
        buildMinutes: phaseMinutes("build"),
      })
      .from(projects)
      .innerJoin(owner, eq(projects.ownerId, owner.id))
      .where(where)
      .orderBy(desc(projects.updatedAt), asc(projects.id))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db
      .select({ n: count() })
      .from(projects)
      .innerJoin(owner, eq(projects.ownerId, owner.id))
      .where(where),
  ]);

  return paged(rows, totals?.n ?? 0, opts.page);
}

// ---- Users -------------------------------------------------------------------

export type AdminUserRow = Pick<
  User,
  "id" | "name" | "email" | "slackId" | "role" | "fuel" | "createdAt"
> & { aircraft: number };

export async function listUsers(opts: { q: string; page: number }): Promise<Paged<AdminUserRow>> {
  const db = await getDb();
  const pattern = contains(opts.q);
  const where = opts.q
    ? or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.slackId, pattern))
    : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        slackId: users.slackId,
        role: users.role,
        fuel: users.fuel,
        createdAt: users.createdAt,
        aircraft: sql<number>`(select count(*) from ${projects} where ${projects.ownerId} = ${users.id})`.mapWith(
          Number,
        ),
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt), asc(users.id))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(users).where(where),
  ]);

  return paged(rows, totals?.n ?? 0, opts.page);
}

// ---- Activity ----------------------------------------------------------------

export type ActivityRow = {
  id: string;
  createdAt: Date;
  action: string;
  targetType: string;
  targetId: string;
  meta: Record<string, unknown> | null;
  actorName: string | null;
  /** The project the entry is about, when there is one. */
  projectId: string | null;
  projectTitle: string | null;
  /** Set when the target is a user. */
  targetUserName: string | null;
  targetUserEmail: string | null;
};

/** Project the entry points at: the target itself, or meta.projectId. */
const auditProjectId = sql`coalesce(
  case when ${auditLog.targetType} = 'project' then ${auditLog.targetId} end,
  ${auditLog.meta}->>'projectId'
)`;

/** The audit log, newest first. */
export async function listActivity(opts: {
  page: number;
  pageSize?: number;
}): Promise<Paged<ActivityRow>> {
  const db = await getDb();
  const size = opts.pageSize ?? PAGE_SIZE;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        meta: auditLog.meta,
        actorName: actor.name,
        projectId: projects.id,
        projectTitle: projects.title,
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
      })
      .from(auditLog)
      .leftJoin(actor, eq(auditLog.actorId, actor.id))
      .leftJoin(projects, eq(projects.id, auditProjectId))
      .leftJoin(
        targetUser,
        and(eq(auditLog.targetType, "user"), eq(auditLog.targetId, targetUser.id)),
      )
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(size)
      .offset((opts.page - 1) * size),
    db.select({ n: count() }).from(auditLog),
  ]);

  const total = totals?.n ?? 0;
  return { rows, total, page: opts.page, pageCount: Math.max(1, Math.ceil(total / size)) };
}
