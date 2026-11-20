import "server-only";
import { and, eq } from "drizzle-orm";
import { fetchBom, isBomError, type BomResult } from "@/lib/bom";
import { getDb } from "@/lib/db";
import { logEntries, projects, submissions, type LogEntry, type Project } from "@/lib/db/schema";
import { parseRepoUrl, type RepoRef } from "@/lib/github";
import type { ProjectStatus } from "@/lib/status";

/** Statuses a maker can submit from. */
export const SUBMIT_FROM: Record<"design" | "flight", readonly ProjectStatus[]> = {
  design: ["drafting", "design_returned"],
  flight: ["parts_funded", "flight_returned"],
};

export type OwnProject = { project: Project; entries: LogEntry[] };

/** The project and its entries, or null if it doesn't exist or isn't the user's. */
export async function loadOwnProject(projectId: string, userId: string): Promise<OwnProject | null> {
  if (!projectId) return null;
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  if (!project) return null;
  const entries = await db.select().from(logEntries).where(eq(logEntries.projectId, projectId));
  return { project, entries };
}

export async function hasPendingSubmission(projectId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(eq(submissions.projectId, projectId), eq(submissions.status, "pending")))
    .limit(1);
  return !!row;
}

export type DesignChecks = {
  repo: RepoRef | null;
  bom: BomResult;
  entryCount: number;
  minutes: number;
  ready: boolean;
};

/** Everything the Design Review checklist needs. Fetches bom.csv, so call it at request time. */
export async function designChecks(
  project: Pick<Project, "repoUrl">,
  entries: Pick<LogEntry, "phase" | "minutes">[],
): Promise<DesignChecks> {
  const repo = parseRepoUrl(project.repoUrl);
  const bom: BomResult = repo ? await fetchBom(project.repoUrl) : { error: "not_found" };
  const design = entries.filter((e) => e.phase === "design");
  const minutes = design.reduce((sum, e) => sum + e.minutes, 0);
  return {
    repo,
    bom,
    entryCount: design.length,
    minutes,
    ready: repo !== null && !isBomError(bom) && design.length > 0 && minutes > 0,
  };
}

export type FlightChecks = { entryCount: number; minutes: number; ready: boolean };

export function flightChecks(entries: Pick<LogEntry, "phase" | "minutes">[]): FlightChecks {
  const build = entries.filter((e) => e.phase === "build");
  const minutes = build.reduce((sum, e) => sum + e.minutes, 0);
  return { entryCount: build.length, minutes, ready: build.length > 0 && minutes > 0 };
}
