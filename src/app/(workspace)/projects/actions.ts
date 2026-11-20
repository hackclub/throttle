"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, exists, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { aircraftCategory, logEntries, projects } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { parseRepoUrl, repoWebUrl } from "@/lib/github";
import { canDeleteEntry, canEdit } from "@/lib/projects";
import { OPEN_STATUSES, isInReview, logPhaseFor } from "@/lib/status";
import { isUploadUrl } from "@/lib/upload-rules";
import {
  MAX_BODY_CHARS,
  MAX_PHOTOS,
  MAX_PITCH_CHARS,
  MIN_BODY_CHARS,
  MIN_ENTRY_MINUTES,
  MIN_PHOTOS,
  MINUTE_STEPS,
  type CreateProjectState,
  type FieldErrors,
  type LogEntryState,
} from "./form-state";

// Not a policy limit, just a guard against typos and integer overflow.
const SANITY_MAX_MINUTES = 60_000;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

const projectInput = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give it a title, at least 3 characters.")
    .max(80, "Keep the title under 80 characters."),
  category: z.enum(aircraftCategory.enumValues, { error: "Pick a category." }),
  tier: z.enum(["1", "2", "3"], { error: "Pick a tier." }).transform(Number),
  repoUrl: z
    .string()
    .trim()
    .refine((v) => parseRepoUrl(v) !== null, "Paste a GitHub repo link, like https://github.com/you/plane."),
  pitch: z
    .string()
    .trim()
    .min(1, "Say what you're building in a line or two.")
    .max(MAX_PITCH_CHARS, `Keep the pitch under ${MAX_PITCH_CHARS} characters.`),
});

export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const user = await requireUser();

  const parsed = projectInput.safeParse({
    title: str(formData, "title"),
    category: str(formData, "category"),
    tier: str(formData, "tier"),
    repoUrl: str(formData, "repoUrl"),
    pitch: str(formData, "pitch"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const { title, category, tier, repoUrl, pitch } = parsed.data;
  const ref = parseRepoUrl(repoUrl);
  if (!ref) return { fieldErrors: { repoUrl: "Paste a GitHub repo link." } };

  const db = await getDb();
  const [created] = await db
    .insert(projects)
    .values({ ownerId: user.id, title, category, tier, repoUrl: repoWebUrl(ref), pitch })
    .returning({ id: projects.id });

  await logAudit(user.id, "project.create", "project", created.id, { tier, category });
  revalidatePath("/hangar");
  redirect(`/projects/${created.id}`);
}

export async function addLogEntry(
  prev: LogEntryState,
  formData: FormData,
): Promise<LogEntryState> {
  const user = await requireUser();
  // Keep the composer mounted (and its inputs filled) when we bounce it.
  const fail = (s: Omit<LogEntryState, "savedId">): LogEntryState => ({ ...s, savedId: prev.savedId });

  const projectId = str(formData, "projectId");
  const db = await getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || !canEdit(user, project) || isInReview(project.status)) {
    return fail({ error: "You can't add entries to this aircraft right now." });
  }

  const fieldErrors: FieldErrors = {};

  const hours = Number(str(formData, "hours") || "0");
  const mins = Number(str(formData, "minutes") || "0");
  const minutes = hours * 60 + mins;
  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    !(MINUTE_STEPS as readonly number[]).includes(mins) ||
    !Number.isInteger(minutes)
  ) {
    fieldErrors.time = "Enter whole hours and pick the minutes.";
  } else if (minutes < MIN_ENTRY_MINUTES) {
    fieldErrors.time = `Log at least ${MIN_ENTRY_MINUTES} minutes per entry.`;
  } else if (minutes > SANITY_MAX_MINUTES) {
    fieldErrors.time = "That's over 1,000 hours in one entry. Check the number.";
  }

  const body = str(formData, "body").trim();
  if (body.length < MIN_BODY_CHARS) {
    fieldErrors.body = `Write at least ${MIN_BODY_CHARS} characters. What did you do, what broke?`;
  } else if (body.length > MAX_BODY_CHARS) {
    fieldErrors.body = `That's a lot. Keep it under ${MAX_BODY_CHARS.toLocaleString("en-US")} characters.`;
  }

  // The composer uploads photos first (uploadFile) and sends their URLs.
  const urls = [
    ...new Set(
      formData
        .getAll("photos")
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  if (urls.length < MIN_PHOTOS) {
    fieldErrors.photos = "Add at least one photo.";
  } else if (urls.length > MAX_PHOTOS) {
    fieldErrors.photos = `Up to ${MAX_PHOTOS} photos per entry.`;
  } else if (!urls.every((u) => isUploadUrl(u, "photo"))) {
    fieldErrors.photos = "One of the photos didn't upload properly. Remove it and add it again.";
  }

  if (Object.keys(fieldErrors).length > 0) return fail({ fieldErrors });

  const phase = logPhaseFor(project.status);
  const [entry] = await db
    .insert(logEntries)
    .values({ projectId, authorId: user.id, minutes, body, photos: urls, phase })
    .returning({ id: logEntries.id });
  // Bumps updatedAt so the hangar sorts recently worked-on aircraft first.
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

  await logAudit(user.id, "log.create", "log_entry", entry.id, {
    projectId,
    minutes,
    phase,
    photos: urls.length,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/hangar");
  return { savedId: entry.id };
}

export async function deleteLogEntry(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = str(formData, "entryId");
  const db = await getDb();

  const [row] = await db
    .select({ entry: logEntries, project: projects })
    .from(logEntries)
    .innerJoin(projects, eq(logEntries.projectId, projects.id))
    .where(eq(logEntries.id, entryId))
    .limit(1);
  if (!row || !canDeleteEntry(user, row.project, row.entry)) return;

  // Re-check the status in the same statement so a submission that lands
  // between the read and the delete can't lose hours it already counted.
  const deleted = await db
    .delete(logEntries)
    .where(
      and(
        eq(logEntries.id, entryId),
        exists(
          db
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, row.project.id),
                eq(projects.ownerId, user.id),
                inArray(projects.status, [...OPEN_STATUSES[row.entry.phase]]),
              ),
            ),
        ),
      ),
    )
    .returning({ id: logEntries.id });
  if (deleted.length === 0) return;

  await logAudit(user.id, "log.delete", "log_entry", entryId, {
    projectId: row.project.id,
    minutes: row.entry.minutes,
    phase: row.entry.phase,
  });
  revalidatePath(`/projects/${row.project.id}`);
  revalidatePath("/hangar");
}
