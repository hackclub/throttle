"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { addLogEntry } from "@/app/(workspace)/projects/actions";
import {
  MAX_PHOTOS,
  MIN_BODY_CHARS,
  MIN_ENTRY_MINUTES,
  MINUTE_STEPS,
  type LogEntryState,
} from "@/app/(workspace)/projects/form-state";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import type { LogPhase } from "@/lib/status";
import { checkFile, uploadFile } from "@/lib/upload-client";
import { formatHoursExact } from "@/lib/tiers";

const initial: LogEntryState = {};

type Props = { projectId: string; phase: LogPhase };

export function FlightLogComposer({ projectId, phase }: Props) {
  const [state, formAction, pending] = useActionState(addLogEntry, initial);
  const anchor = useRef<HTMLDivElement>(null);

  // The composer streams in after navigation, so the browser's own #log jump
  // can miss it. Scroll once it's actually on the page.
  useEffect(() => {
    if (window.location.hash === "#log") anchor.current?.scrollIntoView({ block: "start" });
  }, []);

  // A new savedId remounts the fields, which clears them after a successful save.
  return (
    <div id="log" ref={anchor} className="scroll-mt-6">
      <ComposerForm
        key={state.savedId ?? "new"}
        projectId={projectId}
        phase={phase}
        state={state}
        formAction={formAction}
        pending={pending}
      />
    </div>
  );
}

function ComposerForm({
  projectId,
  phase,
  state,
  formAction,
  pending,
}: Props & {
  state: LogEntryState;
  formAction: (data: FormData) => void;
  pending: boolean;
}) {
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Files already uploaded, so a bounced submit doesn't upload them twice.
  const uploaded = useRef(new Map<File, string>());

  const fe = state.fieldErrors ?? {};
  const total = (Number(hours) || 0) * 60 + Number(minutes);
  const timeOk = total >= MIN_ENTRY_MINUTES;
  const bodyLen = body.trim().length;
  const tooManyFiles = files.length > MAX_PHOTOS;
  const busy = pending || uploading !== null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || tooManyFiles) return;
    // The file input has no name, so only URLs end up in the form data.
    const data = new FormData(e.currentTarget);
    setUploadError(null);

    const urls: string[] = [];
    const todo = files.filter((f) => !uploaded.current.has(f));
    setUploading({ done: 0, total: todo.length });
    try {
      let done = 0;
      for (const file of files) {
        let url = uploaded.current.get(file);
        if (!url) {
          url = await uploadFile(file, "photo");
          uploaded.current.set(file, url);
          setUploading({ done: ++done, total: todo.length });
        }
        urls.push(url);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't upload a photo.");
      return;
    } finally {
      setUploading(null);
    }

    for (const url of urls) data.append("photos", url);
    startTransition(() => formAction(data));
  }

  const timeError = fe.time;
  const photosError =
    uploadError ??
    (tooManyFiles ? `Up to ${MAX_PHOTOS} photos per entry.` : undefined) ??
    fe.photos;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-lg border border-line bg-white px-5 py-5"
    >
      <input type="hidden" name="projectId" value={projectId} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Log a session</h2>
        <span className="rounded border border-line px-1.5 py-px font-mono text-[10px] tracking-wide text-hc-muted">
          {phase === "design" ? "DESIGN" : "BUILD"}
        </span>
      </div>

      <Field
        label="Time spent"
        htmlFor="log-hours"
        hint={
          <span className="font-mono tabular-nums">
            = {formatHoursExact(total / 60)}
            {!timeOk && ` · At least ${MIN_ENTRY_MINUTES} minutes.`}
          </span>
        }
        error={timeError}
      >
        <div className="flex items-center gap-2">
          <Input
            id="log-hours"
            name="hours"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-20 font-mono tabular-nums"
            invalid={!!timeError}
            aria-describedby={describedBy("log-hours", { hint: true, error: timeError })}
          />
          <span className="font-mono text-sm text-hc-muted">h</span>
          <div className="w-24">
            <Select
              name="minutes"
              aria-label="Minutes"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="font-mono tabular-nums"
            >
              {MINUTE_STEPS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <span className="font-mono text-sm text-hc-muted">min</span>
        </div>
      </Field>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="log-body" className="text-sm font-medium">
            Notes
          </label>
          <div className="flex gap-1" role="tablist" aria-label="Notes mode">
            {(["write", "preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cx(
                  "rounded-md px-2 py-0.5 font-mono text-xs transition-colors",
                  mode === m ? "bg-mist text-hc-dark" : "text-hc-muted hover:text-hc-dark",
                )}
              >
                {m === "write" ? "Write" : "Preview"}
              </button>
            ))}
          </div>
        </div>
        {/* Stays mounted in preview so it's still part of the form data. */}
        <div hidden={mode === "preview"}>
          <Textarea
            id="log-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"What did you work on? What broke? What's next?\n\nMarkdown works: **bold**, lists, `code`, links."}
            className="min-h-40"
            invalid={!!fe.body}
            aria-describedby={describedBy("log-body", { hint: true, error: fe.body })}
          />
        </div>
        {mode === "preview" && (
          <div className="min-h-40 rounded-lg border border-line px-3 py-2">
            {body.trim() ? (
              <Markdown>{body}</Markdown>
            ) : (
              <p className="text-sm text-hc-muted">Nothing to preview yet.</p>
            )}
          </div>
        )}
        <p id="log-body-hint" className="font-mono text-xs tabular-nums text-hc-muted">
          <span className={bodyLen >= MIN_BODY_CHARS ? "text-hc-dark" : undefined}>{bodyLen}</span>{" "}
          / {MIN_BODY_CHARS} min chars
        </p>
        {fe.body && (
          <p id="log-body-error" className="text-sm text-hc-red">
            {fe.body}
          </p>
        )}
      </div>

      <Field
        label="Photos"
        htmlFor="log-photos"
        hint="Real photos of your build only. No AI images."
        error={photosError}
      >
        <input
          id="log-photos"
          type="file"
          multiple
          accept="image/*"
          disabled={busy}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            setFiles(picked);
            setUploadError(picked.map((f) => checkFile(f, "photo")).find(Boolean) ?? null);
          }}
          aria-invalid={photosError ? true : undefined}
          aria-describedby={describedBy("log-photos", { hint: true, error: photosError })}
          className={cx(
            "block w-full text-sm text-hc-muted",
            "file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-hc-dark hover:file:bg-mist",
          )}
        />
        {files.length > 0 && (
          <ul className="space-y-0.5 font-mono text-xs text-hc-dark/80">
            {files.map((file, i) => (
              <li key={`${i}-${file.name}`} className="truncate">
                {file.name}
              </li>
            ))}
          </ul>
        )}
        <p className="font-mono text-xs text-hc-muted">
          {files.length} / {MAX_PHOTOS} · at least 1
        </p>
      </Field>

      {state.error && <p className="text-sm text-hc-red">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy || tooManyFiles}>
          {uploading && uploading.total > 0
            ? `Uploading ${Math.min(uploading.done + 1, uploading.total)}/${uploading.total}…`
            : busy
              ? "Saving…"
              : "Add entry"}
        </Button>
      </div>
    </form>
  );
}
