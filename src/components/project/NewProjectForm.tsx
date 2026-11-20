"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { createProject } from "@/app/(workspace)/projects/actions";
import { MAX_PITCH_CHARS, type CreateProjectState } from "@/app/(workspace)/projects/form-state";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { CATEGORY_LABEL, type AircraftCategory } from "@/lib/categories";
import { TIERS, formatRate, type Tier } from "@/lib/tiers";

const TIER_KEYS = [1, 2, 3] as const satisfies readonly Tier[];
const TIER_HINT = "Pick what fits. A reviewer can move it up or down at Design Review.";

const initial: CreateProjectState = {};

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, initial);
  const [tier, setTier] = useState<Tier | null>(null);
  const [pitch, setPitch] = useState("");
  const fe = state.fieldErrors ?? {};

  // Submitting by hand (instead of <form action>) skips React's automatic
  // form reset, so a validation error doesn't wipe what was typed.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Field label="Title" htmlFor="title" error={fe.title}>
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={80}
          placeholder="Foamboard Cub"
          invalid={!!fe.title}
          aria-describedby={describedBy("title", { error: fe.title })}
        />
      </Field>

      <Field label="Category" htmlFor="category" error={fe.category}>
        <Select
          id="category"
          name="category"
          defaultValue=""
          required
          invalid={!!fe.category}
          aria-describedby={describedBy("category", { error: fe.category })}
        >
          <option value="" disabled>
            Pick one
          </option>
          {(Object.keys(CATEGORY_LABEL) as AircraftCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="space-y-1.5" aria-describedby="tier-hint">
        <legend className="mb-1.5 block text-sm font-medium text-hc-dark">Tier</legend>
        <div className="space-y-2">
          {TIER_KEYS.map((t) => {
            const info = TIERS[t];
            const selected = tier === t;
            return (
              <label
                key={t}
                className={cx(
                  "flex cursor-pointer gap-3 rounded-lg border bg-white p-4 transition-colors",
                  selected ? "border-hc-blue" : "border-line hover:bg-mist",
                )}
              >
                <input
                  type="radio"
                  name="tier"
                  value={t}
                  checked={selected}
                  onChange={() => setTier(t)}
                  className="mt-1 accent-hc-blue"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{info.name}</span>
                    <span className="font-mono text-sm tabular-nums">{formatRate(t)}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-hc-dark/80">{info.blurb}</span>
                  <span className="mt-0.5 block text-sm text-hc-muted">
                    {info.examples.join(" · ")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p id="tier-hint" className="text-sm text-hc-muted">
          {TIER_HINT}
        </p>
        {fe.tier && <p className="text-sm text-hc-red">{fe.tier}</p>}
      </fieldset>

      <Field
        label="GitHub repo"
        htmlFor="repoUrl"
        hint="Public repo. Put a bom.csv at the root when you have a parts list."
        error={fe.repoUrl}
      >
        <Input
          id="repoUrl"
          name="repoUrl"
          type="url"
          inputMode="url"
          required
          placeholder="https://github.com/you/your-plane"
          className="font-mono"
          invalid={!!fe.repoUrl}
          aria-describedby={describedBy("repoUrl", {
            hint: true,
            error: fe.repoUrl,
          })}
        />
      </Field>

      <Field
        label={
          <span className="flex items-baseline justify-between">
            <span>Pitch</span>
            <span
              className={cx(
                "font-mono text-xs tabular-nums",
                pitch.length >= MAX_PITCH_CHARS ? "text-hc-red" : "text-hc-muted",
              )}
            >
              {pitch.length} / {MAX_PITCH_CHARS}
            </span>
          </span>
        }
        htmlFor="pitch"
        hint="One or two lines. What is it and why do you want to fly it?"
        error={fe.pitch}
      >
        <Textarea
          id="pitch"
          name="pitch"
          required
          maxLength={MAX_PITCH_CHARS}
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          placeholder="A 1 m span foamboard trainer I can crash a hundred times and keep flying."
          invalid={!!fe.pitch}
          aria-describedby={describedBy("pitch", { hint: true, error: fe.pitch })}
        />
      </Field>

      {state.error && <p className="text-sm text-hc-red">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create aircraft"}
      </Button>
    </form>
  );
}
