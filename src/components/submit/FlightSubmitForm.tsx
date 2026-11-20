"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { submitFlight } from "@/app/(workspace)/submit/actions";
import {
  type FieldErrors,
  MAX_LEARNED_CHARS,
  MIN_LEARNED_CHARS,
  type SubmitState,
} from "@/app/(workspace)/submit/form-state";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, describedBy } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { checkFile, uploadFile, type UploadKind } from "@/lib/upload-client";

const initial: SubmitState = {};

const fileInput = cx(
  "block w-full text-sm text-hc-muted",
  "file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-hc-dark hover:file:bg-mist",
);

type Props = {
  projectId: string;
  /** Why the checklist blocks submitting, or null when it's complete. */
  blockedReason: string | null;
};

type Progress = { label: string; percentage: number };

export function FlightSubmitForm({ projectId, blockedReason }: Props) {
  const [state, formAction, pending] = useActionState(submitFlight, initial);
  const [source, setSource] = useState<"upload" | "link">("upload");
  const [video, setVideo] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [learned, setLearned] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [localErrors, setLocalErrors] = useState<Partial<Record<"video" | "finalPhoto", string>>>({});
  // Files already uploaded, so a bounced submit doesn't upload them twice.
  const uploaded = useRef(new Map<File, string>());

  const busy = pending || progress !== null;
  const fe: FieldErrors = { ...state.fieldErrors, ...stripEmpty(localErrors) };
  const learnedLen = learned.trim().length;

  async function ensureUploaded(file: File, kind: UploadKind, label: string): Promise<string> {
    const cached = uploaded.current.get(file);
    if (cached) return cached;
    setProgress({ label, percentage: 0 });
    const url = await uploadFile(file, kind, {
      onProgress: (percentage) => setProgress({ label, percentage }),
    });
    uploaded.current.set(file, url);
    return url;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || blockedReason) return;
    // File inputs have no name, so only URLs end up in the form data.
    const data = new FormData(e.currentTarget);

    const errors: typeof localErrors = {};
    if (source === "upload" && !video) errors.video = "Choose your flight video, or paste a link instead.";
    if (source === "link" && !link.trim()) errors.video = "Paste a link to your flight video.";
    if (!photo) errors.finalPhoto = "Add a photo of the finished build.";
    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors);
      return;
    }
    setLocalErrors({});

    let videoUrl = link.trim();
    let photoUrl = "";
    try {
      if (source === "upload" && video) videoUrl = await ensureUploaded(video, "video", "video");
    } catch (err) {
      setProgress(null);
      setLocalErrors({ video: err instanceof Error ? err.message : "Couldn't upload the video." });
      return;
    }
    try {
      if (photo) photoUrl = await ensureUploaded(photo, "photo", "photo");
    } catch (err) {
      setProgress(null);
      setLocalErrors({ finalPhoto: err instanceof Error ? err.message : "Couldn't upload the photo." });
      return;
    }
    setProgress(null);

    data.set("videoSource", source);
    data.set("videoUrl", videoUrl);
    data.set("finalPhotoUrl", photoUrl);
    startTransition(() => formAction(data));
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-6 rounded-lg border border-line bg-white px-5 py-6 sm:px-6"
    >
      <input type="hidden" name="projectId" value={projectId} />

      <fieldset className="space-y-2">
        <legend className="mb-1.5 block text-sm font-medium text-hc-dark">Flight video</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Video source">
          {(["upload", "link"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={source === s}
              disabled={busy}
              onClick={() => {
                setSource(s);
                setLocalErrors((prev) => ({ ...prev, video: undefined }));
              }}
              className={cx(
                "rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
                source === s ? "bg-mist text-hc-dark" : "text-hc-muted hover:text-hc-dark",
              )}
            >
              {s === "upload" ? "Upload a file" : "Paste a link"}
            </button>
          ))}
        </div>

        {/* Both stay mounted so switching back keeps what was picked or typed. */}
        <div className="space-y-1.5" hidden={source !== "upload"}>
          <input
            id="flight-video-file"
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            aria-label="Flight video file"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setVideo(file);
              setLocalErrors((prev) => ({
                ...prev,
                video: file ? (checkFile(file, "video") ?? undefined) : undefined,
              }));
            }}
            aria-invalid={fe.video ? true : undefined}
            aria-describedby={cx("flight-video-file-hint", fe.video && "flight-video-error")}
            className={fileInput}
          />
          <p id="flight-video-file-hint" className="text-sm text-hc-muted">
            MP4, MOV or WebM, up to 100 MB. Bigger? Put it on YouTube or Drive and paste the link.
          </p>
        </div>
        <div className="space-y-1.5" hidden={source !== "link"}>
          <Input
            id="flight-video-link"
            type="url"
            inputMode="url"
            aria-label="Flight video link"
            placeholder="https://youtu.be/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="font-mono"
            invalid={!!fe.video}
            aria-describedby={cx("flight-video-link-hint", fe.video && "flight-video-error")}
          />
          <p id="flight-video-link-hint" className="text-sm text-hc-muted">
            YouTube, Drive or anywhere a reviewer can watch it without signing in.
          </p>
        </div>
        {fe.video && (
          <p id="flight-video-error" className="text-sm text-hc-red">
            {fe.video}
          </p>
        )}
      </fieldset>

      <Field
        label="Final build photo"
        htmlFor="final-photo"
        hint="The finished aircraft, in one clear shot. Real photos only."
        error={fe.finalPhoto}
      >
        <input
          id="final-photo"
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setPhoto(file);
            setLocalErrors((prev) => ({
              ...prev,
              finalPhoto: file ? (checkFile(file, "photo") ?? undefined) : undefined,
            }));
          }}
          aria-invalid={fe.finalPhoto ? true : undefined}
          aria-describedby={describedBy("final-photo", { hint: true, error: fe.finalPhoto })}
          className={fileInput}
        />
      </Field>

      <div className="space-y-1.5">
        <label htmlFor="learned" className="block text-sm font-medium text-hc-dark">
          What did you learn?
        </label>
        <Textarea
          id="learned"
          name="learned"
          value={learned}
          maxLength={MAX_LEARNED_CHARS}
          onChange={(e) => setLearned(e.target.value)}
          placeholder="What surprised you, what you'd build differently, what the first flight taught you."
          className="min-h-36"
          invalid={!!fe.learned}
          aria-describedby={describedBy("learned", { hint: true, error: fe.learned })}
        />
        <p id="learned-hint" className="font-mono text-xs tabular-nums text-hc-muted">
          <span className={learnedLen >= MIN_LEARNED_CHARS ? "text-hc-dark" : undefined}>
            {learnedLen}
          </span>{" "}
          / {MIN_LEARNED_CHARS} min chars
        </p>
        {fe.learned && (
          <p id="learned-error" className="text-sm text-hc-red">
            {fe.learned}
          </p>
        )}
      </div>

      {state.error && <p className="text-sm text-hc-red">{state.error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        {blockedReason && <p className="mr-auto text-sm text-hc-red">{blockedReason}</p>}
        <Button type="submit" disabled={busy || !!blockedReason}>
          {progress
            ? `Uploading ${progress.label}… ${Math.round(progress.percentage)}%`
            : pending
              ? "Submitting…"
              : "Submit maiden flight"}
        </Button>
      </div>
    </form>
  );
}

function stripEmpty<T extends Record<string, string | undefined>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v)) as Partial<T>;
}
