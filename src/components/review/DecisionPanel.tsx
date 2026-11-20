"use client";

import {
  startTransition,
  useActionState,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type Ref,
} from "react";
import { decide } from "@/app/(workspace)/admin/reviews/actions";
import {
  MAX_OVERRIDE_HOURS,
  MIN_JUSTIFICATION_CHARS,
  type DecideState,
  type ReviewResult,
} from "@/app/(workspace)/admin/reviews/form-state";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import {
  FUEL_PER_HOUR,
  TIERS,
  formatHoursExact,
  formatMultiplier,
  formatRate,
  formatUSD,
  fuelFor,
  grantCents,
  rateCents,
  type Tier,
} from "@/lib/tiers";

const TIER_KEYS = [1, 2, 3] as const satisfies readonly Tier[];

const CHECKLIST: Record<"design" | "flight", string[]> = {
  design: [
    "Repo has source/CAD for what's described",
    "BOM matches the design and prices look right",
    "Journal hours are believable for the work shown",
    "All four safety pledges ticked",
    "Tier fits the difficulty",
  ],
  flight: [
    "Video shows a sustained, controlled flight",
    "Aircraft in the video matches the project",
    "Build journal hours are believable",
  ],
};

const VERB: Record<ReviewResult, string> = {
  approved: "Approve",
  returned: "Return",
  rejected: "Reject",
};

export type DecisionHandle = {
  /** Validates, asks window.confirm with the computed amount, then submits. */
  trigger: (result: ReviewResult) => void;
  focusFeedback: () => void;
  focusJustification: () => void;
};

type Props = {
  ref?: Ref<DecisionHandle>;
  submissionId: string;
  kind: "design" | "flight";
  hoursSubmitted: number;
  projectTier: Tier;
};

const initial: DecideState = {};

/** Pure tiers.ts maths, rendered as an equation. */
export function resultLine(kind: "design" | "flight", hours: number, tier: Tier): string {
  return kind === "design"
    ? `${formatHoursExact(hours)} × ${formatUSD(rateCents(tier))} = ${formatUSD(grantCents(hours, tier))}`
    : `${formatHoursExact(hours)} × ${FUEL_PER_HOUR} × ${formatMultiplier(tier)} = ${fuelFor(hours, tier).toLocaleString("en-US")} fuel`;
}

export function DecisionPanel({ ref, submissionId, kind, hoursSubmitted, projectTier }: Props) {
  const [state, formAction, pending] = useActionState(decide, initial);
  const [override, setOverride] = useState("");
  const [tier, setTier] = useState<Tier>(projectTier);
  const [justification, setJustification] = useState("");
  const [feedback, setFeedback] = useState("");
  const [localErrors, setLocalErrors] = useState<DecideState["fieldErrors"]>({});

  const formRef = useRef<HTMLFormElement>(null);
  const justificationRef = useRef<HTMLTextAreaElement>(null);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);

  const overrideNum = override.trim() === "" ? null : Number(override);
  const overrideValid =
    overrideNum === null ||
    (Number.isFinite(overrideNum) && overrideNum >= 0 && overrideNum <= MAX_OVERRIDE_HOURS);
  const hours = overrideNum !== null && overrideValid ? overrideNum : hoursSubmitted;
  const line = resultLine(kind, hours, tier);

  const fe = { ...state.fieldErrors, ...localErrors };

  /** Client-side mirror of the server checks. Returns false (and focuses the field) if invalid. */
  function validate(result: ReviewResult): boolean {
    const errors: NonNullable<DecideState["fieldErrors"]> = {};
    if (!overrideValid) errors.hoursOverride = `Hours must be between 0 and ${MAX_OVERRIDE_HOURS}.`;
    if (justification.trim().length < MIN_JUSTIFICATION_CHARS) {
      errors.justification = `Write at least ${MIN_JUSTIFICATION_CHARS} characters: what did you check?`;
    }
    if (result !== "approved" && feedback.trim().length === 0) {
      errors.feedback = "Tell the builder what to change.";
    }
    setLocalErrors(errors);
    if (errors.justification) justificationRef.current?.focus();
    else if (errors.feedback) feedbackRef.current?.focus();
    return Object.keys(errors).length === 0;
  }

  function submit(result: ReviewResult) {
    const form = formRef.current;
    if (!form || pending) return;
    const data = new FormData(form);
    data.set("result", result);
    startTransition(() => formAction(data));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const result = (submitter?.value ?? "") as ReviewResult;
    if (!(result in VERB) || !validate(result)) return;
    submit(result);
  }

  useImperativeHandle(ref, () => ({
    trigger(result) {
      if (pending || !validate(result)) return;
      const note = result === "approved" ? line : `${line} (not paid on ${VERB[result].toLowerCase()})`;
      if (!window.confirm(`${VERB[result]} this submission?\n\n${note}`)) return;
      submit(result);
    },
    focusFeedback: () => feedbackRef.current?.focus(),
    focusJustification: () => justificationRef.current?.focus(),
  }));

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-lg border border-line bg-white px-5 py-5"
    >
      {/* Disabled default button: pressing Enter in a field must not approve. */}
      <button type="submit" disabled hidden aria-hidden tabIndex={-1} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <h2 className="text-sm font-medium">Decision</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-hc-dark">Hours submitted</p>
          <p className="flex h-[38px] items-center font-mono text-sm tabular-nums">
            {formatHoursExact(hoursSubmitted)}
          </p>
        </div>
        <Field label="Hours override" htmlFor="hoursOverride" error={fe.hoursOverride}>
          <Input
            id="hoursOverride"
            name="hoursOverride"
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_OVERRIDE_HOURS}
            step={0.25}
            placeholder={String(Math.round(hoursSubmitted * 100) / 100)}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            className="font-mono tabular-nums"
            invalid={!!fe.hoursOverride}
            aria-describedby={describedBy("hoursOverride", { error: fe.hoursOverride })}
          />
        </Field>
      </div>

      <Field label="Tier (override)" htmlFor="tier" error={fe.tier}>
        <Select
          id="tier"
          name="tier"
          value={tier}
          onChange={(e) => setTier(Number(e.target.value) as Tier)}
          invalid={!!fe.tier}
        >
          {TIER_KEYS.map((t) => (
            <option key={t} value={t}>
              {TIERS[t].name} · {kind === "design" ? formatRate(t) : `× ${formatMultiplier(t)}`}
              {t === projectTier ? " (project)" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <div className="rounded-lg border border-line bg-mist px-3 py-2.5">
        <p className="font-mono text-[11px] uppercase tracking-wide text-hc-muted">
          {kind === "design" ? "Grant if approved" : "Fuel if approved"}
        </p>
        <p className="mt-1 font-mono text-sm tabular-nums text-hc-dark" aria-live="polite">
          {line}
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium text-hc-dark">Reviewer checklist</legend>
        {CHECKLIST[kind].map((item) => (
          <label key={item} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-hc-blue" />
            <span className="text-hc-dark/90">{item}</span>
          </label>
        ))}
        <p className="text-xs text-hc-muted">Just for you. Not saved.</p>
      </fieldset>

      <Field label="Justification (internal)" htmlFor="justification" error={fe.justification}>
        <Textarea
          ref={justificationRef}
          id="justification"
          name="justification"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Cite what you checked: journal pace, commits, photos. Another reviewer should reach the same call."
          className="min-h-24"
          invalid={!!fe.justification}
          aria-describedby={describedBy("justification", { error: fe.justification })}
        />
      </Field>

      <Field
        label="Feedback to the builder"
        htmlFor="feedback"
        hint="Required for Return and Reject."
        error={fe.feedback}
      >
        <Textarea
          ref={feedbackRef}
          id="feedback"
          name="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What does the builder need to know?"
          className="min-h-24"
          invalid={!!fe.feedback}
          aria-describedby={describedBy("feedback", { hint: true, error: fe.feedback })}
        />
      </Field>

      {state.error && <p className="text-sm text-hc-red">{state.error}</p>}

      <div className="space-y-2 border-t border-line pt-4">
        <DecisionButton result="approved" variant="primary" hint="A" disabled={pending} />
        <div className="grid grid-cols-2 gap-2">
          <DecisionButton result="returned" variant="secondary" hint="R" disabled={pending} />
          <DecisionButton
            result="rejected"
            variant="ghost"
            hint="X"
            disabled={pending}
            className="text-hc-red hover:text-hc-red"
          />
        </div>
        {pending && <p className="font-mono text-xs text-hc-muted">Saving…</p>}
      </div>
    </form>
  );
}

function DecisionButton({
  result,
  variant,
  hint,
  disabled,
  className,
}: {
  result: ReviewResult;
  variant: "primary" | "secondary" | "ghost";
  hint: string;
  disabled: boolean;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      name="result"
      value={result}
      variant={variant}
      disabled={disabled}
      className={cx("w-full", className)}
    >
      {VERB[result]}
      <kbd
        className={cx(
          "rounded border px-1 font-mono text-[10px] leading-4",
          variant === "primary" ? "border-white/40 text-white/80" : "border-line text-hc-muted",
        )}
      >
        {hint}
      </kbd>
    </Button>
  );
}
