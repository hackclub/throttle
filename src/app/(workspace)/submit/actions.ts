"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  projects,
  submissions,
  type DesignSubmissionData,
  type FlightSubmissionData,
} from "@/lib/db/schema";
import { rawFileUrl } from "@/lib/github";
import type { ProjectStatus } from "@/lib/status";
import {
  SUBMIT_FROM,
  designChecks,
  flightChecks,
  hasPendingSubmission,
  loadOwnProject,
} from "@/lib/submissions";
import { isUploadUrl } from "@/lib/upload-rules";
import {
  MAX_LEARNED_CHARS,
  MAX_NOTES_CHARS,
  MAX_SPEC_CHARS,
  MAX_WEIGHT_GRAMS,
  MIN_LEARNED_CHARS,
  MIN_WEIGHT_GRAMS,
  PLEDGES,
  type FieldErrors,
  type SubmitState,
} from "./form-state";

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

const pledge = z.literal("on", { error: "Tick this to submit." });

const designInput = z.object({
  tier: z.enum(["1", "2", "3"], { error: "Pick a tier." }).transform(Number),
  weightGrams: z
    .string()
    .trim()
    .min(1, "Estimate the all-up weight.")
    .transform(Number)
    .pipe(
      z
        .number({ error: "Enter a weight in grams." })
        .min(MIN_WEIGHT_GRAMS, `Between ${MIN_WEIGHT_GRAMS} and ${MAX_WEIGHT_GRAMS.toLocaleString("en-US")} g.`)
        .max(MAX_WEIGHT_GRAMS, `Between ${MIN_WEIGHT_GRAMS} and ${MAX_WEIGHT_GRAMS.toLocaleString("en-US")} g.`),
    ),
  battery: z
    .string()
    .trim()
    .min(1, "Say what battery it runs on.")
    .max(MAX_SPEC_CHARS, `Keep it under ${MAX_SPEC_CHARS} characters.`),
  propulsion: z
    .string()
    .trim()
    .min(1, "Say what motors or propulsion it uses.")
    .max(MAX_SPEC_CHARS, `Keep it under ${MAX_SPEC_CHARS} characters.`),
  notes: z
    .string()
    .trim()
    .max(MAX_NOTES_CHARS, `Keep notes under ${MAX_NOTES_CHARS.toLocaleString("en-US")} characters.`),
  pledge_lipo: pledge,
  pledge_props: pledge,
  pledge_airspace: pledge,
  pledge_people: pledge,
});

/**
 * Moves the project into review only if it's still in a submittable status.
 * The condition makes double submits and races harmless: only one wins.
 */
async function lockForReview(
  projectId: string,
  ownerId: string,
  from: readonly ProjectStatus[],
  to: ProjectStatus,
  tier?: number,
): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(projects)
    .set({ status: to, updatedAt: new Date(), ...(tier ? { tier } : {}) })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.ownerId, ownerId),
        inArray(projects.status, [...from]),
      ),
    )
    .returning({ id: projects.id });
  return rows.length > 0;
}

export async function submitDesign(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await requireUser();
  const projectId = str(formData, "projectId");

  const parsed = designInput.safeParse({
    tier: str(formData, "tier"),
    weightGrams: str(formData, "weightGrams"),
    battery: str(formData, "battery"),
    propulsion: str(formData, "propulsion"),
    notes: str(formData, "notes"),
    ...Object.fromEntries(PLEDGES.map((p) => [`pledge_${p.key}`, str(formData, `pledge_${p.key}`)])),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const own = await loadOwnProject(projectId, user.id);
  if (!own || !SUBMIT_FROM.design.includes(own.project.status)) {
    return { error: "This aircraft can't go to Design Review right now." };
  }
  const { project, entries } = own;

  const checks = await designChecks(project, entries);
  if (!checks.repo) return { error: "Your repo link isn't a valid GitHub repo. Fix it first." };
  if (!checks.ready) {
    return { error: "The checklist isn't complete yet: you need bom.csv and at least one design entry." };
  }
  if (await hasPendingSubmission(project.id)) {
    return { error: "There's already a submission waiting for a reviewer." };
  }

  const { tier, weightGrams, battery, propulsion, notes } = parsed.data;
  const data: DesignSubmissionData = {
    weightGrams,
    battery,
    propulsion,
    bomUrl: rawFileUrl(checks.repo, "bom.csv"),
    pledges: { lipo: true, props: true, airspace: true, people: true },
    ...(notes ? { notes } : {}),
  };

  if (!(await lockForReview(project.id, user.id, SUBMIT_FROM.design, "design_review", tier))) {
    return { error: "This aircraft can't go to Design Review right now." };
  }

  const db = await getDb();
  let submissionId: string;
  try {
    const [created] = await db
      .insert(submissions)
      .values({ projectId: project.id, kind: "design", data })
      .returning({ id: submissions.id });
    submissionId = created.id;
  } catch {
    // Put the project back so the maker can try again.
    await db
      .update(projects)
      .set({ status: project.status, tier: project.tier })
      .where(eq(projects.id, project.id));
    return { error: "Couldn't submit. Try again in a moment." };
  }

  await logAudit(user.id, "submission.create", "submission", submissionId, {
    projectId: project.id,
    kind: "design",
    tier,
    previousTier: project.tier,
    designMinutes: checks.minutes,
  });

  revalidatePath(`/projects/${project.id}`);
  revalidatePath("/hangar");
  revalidatePath("/admin/reviews");
  redirect(`/submit/done?kind=design&project=${project.id}`);
}

function httpLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function submitFlight(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await requireUser();
  const projectId = str(formData, "projectId");
  const fieldErrors: FieldErrors = {};

  // The form uploads files first (uploadFile) and sends their URLs here.
  const source = str(formData, "videoSource");
  const rawVideo = str(formData, "videoUrl").trim();
  let videoUrl: string | null = null;
  if (source === "upload") {
    videoUrl = isUploadUrl(rawVideo, "video") ? rawVideo : null;
    if (!videoUrl) fieldErrors.video = "Upload your flight video.";
  } else if (source === "link") {
    videoUrl = rawVideo.length <= 2000 ? httpLink(rawVideo) : null;
    if (!videoUrl) fieldErrors.video = "Paste a link to your video, like a YouTube or Drive URL.";
  } else {
    fieldErrors.video = "Upload a video or paste a link.";
  }

  const finalPhotoUrl = str(formData, "finalPhotoUrl").trim();
  if (!isUploadUrl(finalPhotoUrl, "photo")) fieldErrors.finalPhoto = "Add a photo of the finished build.";

  const learned = str(formData, "learned").trim();
  if (learned.length < MIN_LEARNED_CHARS) {
    fieldErrors.learned = `Write at least ${MIN_LEARNED_CHARS} characters.`;
  } else if (learned.length > MAX_LEARNED_CHARS) {
    fieldErrors.learned = `Keep it under ${MAX_LEARNED_CHARS.toLocaleString("en-US")} characters.`;
  }

  if (Object.keys(fieldErrors).length > 0 || !videoUrl) return { fieldErrors };

  const own = await loadOwnProject(projectId, user.id);
  if (!own || !SUBMIT_FROM.flight.includes(own.project.status)) {
    return { error: "This aircraft can't go to Flight Review right now." };
  }
  const { project, entries } = own;

  const checks = flightChecks(entries);
  if (!checks.ready) return { error: "Log at least one build entry first." };
  if (await hasPendingSubmission(project.id)) {
    return { error: "There's already a submission waiting for a reviewer." };
  }

  const data: FlightSubmissionData = { videoUrl, finalPhotoUrl, learned };

  if (!(await lockForReview(project.id, user.id, SUBMIT_FROM.flight, "flight_review"))) {
    return { error: "This aircraft can't go to Flight Review right now." };
  }

  const db = await getDb();
  let submissionId: string;
  try {
    const [created] = await db
      .insert(submissions)
      .values({ projectId: project.id, kind: "flight", data })
      .returning({ id: submissions.id });
    submissionId = created.id;
  } catch {
    await db.update(projects).set({ status: project.status }).where(eq(projects.id, project.id));
    return { error: "Couldn't submit. Try again in a moment." };
  }

  await logAudit(user.id, "submission.create", "submission", submissionId, {
    projectId: project.id,
    kind: "flight",
    buildMinutes: checks.minutes,
    videoSource: source,
  });

  revalidatePath(`/projects/${project.id}`);
  revalidatePath("/hangar");
  revalidatePath("/admin/reviews");
  redirect(`/submit/done?kind=flight&project=${project.id}`);
}
