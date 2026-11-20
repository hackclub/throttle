import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const userRole = pgEnum("user_role", ["maker", "reviewer", "admin"]);

export const aircraftCategory = pgEnum("aircraft_category", [
  "drone",
  "rc_plane",
  "glider",
  "helicopter",
  "rocket",
  "blimp",
  "ornithopter",
  "other",
]);

export const projectStatus = pgEnum("project_status", [
  "drafting",
  "design_review",
  "design_returned",
  "parts_funded",
  "flight_review",
  "flight_returned",
  "airborne",
  "rejected",
]);

export const logPhase = pgEnum("log_phase", ["design", "build"]);

export const submissionKind = pgEnum("submission_kind", ["design", "flight"]);

export const submissionStatus = pgEnum("submission_status", [
  "pending",
  "approved",
  "returned",
  "rejected",
]);

export const reviewResult = pgEnum("review_result", [
  "approved",
  "returned",
  "rejected",
]);

export type DesignSubmissionData = {
  weightGrams: number;
  battery: string;
  propulsion: string;
  bomUrl: string;
  pledges: { lipo: boolean; props: boolean; airspace: boolean; people: boolean };
  notes?: string;
};

export type FlightSubmissionData = {
  videoUrl: string;
  finalPhotoUrl: string;
  learned: string;
};

export const users = pgTable(
  "users",
  {
    id: id(),
    // Callers lowercase before insert/lookup; the check catches any that forget.
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    slackId: text("slack_id"),
    hcaId: text("hca_id").unique(),
    avatarUrl: text("avatar_url"),
    role: userRole("role").default("maker").notNull(),
    fuel: integer("fuel").default(0).notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("users_email_lowercase", sql`${t.email} = lower(${t.email})`)],
);

export const sessions = pgTable("sessions", {
  // sha256 hex of the cookie token, so a DB leak can't be replayed as a cookie.
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const projects = pgTable(
  "projects",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    category: aircraftCategory("category").notNull(),
    tier: integer("tier").notNull(),
    repoUrl: text("repo_url").notNull(),
    pitch: text("pitch").notNull(),
    status: projectStatus("status").default("drafting").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [check("projects_tier_range", sql`${t.tier} between 1 and 3`)],
);

export const logEntries = pgTable("log_entries", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  minutes: integer("minutes").notNull(),
  body: text("body").notNull(),
  photos: jsonb("photos").$type<string[]>().default([]).notNull(),
  phase: logPhase("phase").notNull(),
  createdAt: createdAt(),
});

export const submissions = pgTable("submissions", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: submissionKind("kind").notNull(),
  status: submissionStatus("status").default("pending").notNull(),
  data: jsonb("data")
    .$type<DesignSubmissionData | FlightSubmissionData>()
    .notNull(),
  claimedById: text("claimed_by_id").references(() => users.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const reviews = pgTable("reviews", {
  id: id(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => submissions.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => users.id),
  result: reviewResult("result").notNull(),
  hoursSubmitted: real("hours_submitted").notNull(),
  hoursOverride: real("hours_override"),
  // Frozen at review time so later tier edits don't rewrite history.
  tier: integer("tier").notNull(),
  tierOverride: integer("tier_override"),
  grantCents: integer("grant_cents").default(0).notNull(),
  fuel: integer("fuel").default(0).notNull(),
  justification: text("justification").notNull(), // internal only
  feedback: text("feedback"), // shown to the maker
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type LogEntry = typeof logEntries.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Review = typeof reviews.$inferSelect;
