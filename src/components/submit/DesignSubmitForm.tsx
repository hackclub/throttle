"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { submitDesign } from "@/app/(workspace)/submit/actions";
import {
  MAX_NOTES_CHARS,
  MAX_SPEC_CHARS,
  MAX_WEIGHT_GRAMS,
  MIN_WEIGHT_GRAMS,
  PLEDGES,
  type SubmitState,
} from "@/app/(workspace)/submit/form-state";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/Field";
import {
  TIERS,
  formatHoursExact,
  formatRate,
  formatUSD,
  grantCents,
  minutesToHours,
  rateCents,
  type Tier,
} from "@/lib/tiers";

const TIER_KEYS = [1, 2, 3] as const satisfies readonly Tier[];
const initial: SubmitState = {};

type Props = {
  projectId: string;
  defaultTier: Tier;
  designMinutes: number;
  /** Why the checklist blocks submitting, or null when it's complete. */
  blockedReason: string | null;
};

export function DesignSubmitForm({ projectId, defaultTier, designMinutes, blockedReason }: Props) {
  const [state, formAction, pending] = useActionState(submitDesign, initial);
  const [tier, setTier] = useState<Tier>(defaultTier);
  const fe = state.fieldErrors ?? {};
  const hours = minutesToHours(designMinutes);

  // Submitting by hand skips React's form reset, so errors don't wipe the form.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blockedReason) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-6 rounded-lg border border-line bg-white px-5 py-6 sm:px-6"
    >
      <input type="hidden" name="projectId" value={projectId} />

      <Field
        label="Tier"
        htmlFor="tier"
        hint={
          <>
            A reviewer can still adjust it.{" "}
            <span className="font-mono tabular-nums text-hc-dark/80">
              {formatHoursExact(hours)} × {formatUSD(rateCents(tier))} ={" "}
              {formatUSD(grantCents(hours, tier))}
            </span>
          </>
        }
        error={fe.tier}
      >
        <Select
          id="tier"
          name="tier"
          value={tier}
          onChange={(e) => setTier(Number(e.target.value) as Tier)}
          invalid={!!fe.tier}
          aria-describedby={describedBy("tier", { hint: true, error: fe.tier })}
        >
          {TIER_KEYS.map((t) => (
            <option key={t} value={t}>
              {TIERS[t].name} · {formatRate(t)} · {TIERS[t].blurb}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Estimated all-up weight"
        htmlFor="weightGrams"
        hint="Everything that flies: airframe, battery, electronics."
        error={fe.weightGrams}
      >
        <div className="flex items-center gap-2">
          <Input
            id="weightGrams"
            name="weightGrams"
            type="number"
            inputMode="decimal"
            min={MIN_WEIGHT_GRAMS}
            max={MAX_WEIGHT_GRAMS}
            step="any"
            required
            placeholder="450"
            className="w-36 font-mono tabular-nums"
            invalid={!!fe.weightGrams}
            aria-describedby={describedBy("weightGrams", { hint: true, error: fe.weightGrams })}
          />
          <span className="font-mono text-sm text-hc-muted">g</span>
        </div>
      </Field>

      <Field label="Battery" htmlFor="battery" error={fe.battery}>
        <Input
          id="battery"
          name="battery"
          required
          maxLength={MAX_SPEC_CHARS}
          placeholder="2S 450 mAh LiPo"
          invalid={!!fe.battery}
          aria-describedby={describedBy("battery", { error: fe.battery })}
        />
      </Field>

      <Field label="Motors / propulsion" htmlFor="propulsion" error={fe.propulsion}>
        <Input
          id="propulsion"
          name="propulsion"
          required
          maxLength={MAX_SPEC_CHARS}
          placeholder="1806 2300 kV brushless, 5x3 prop"
          invalid={!!fe.propulsion}
          aria-describedby={describedBy("propulsion", { error: fe.propulsion })}
        />
      </Field>

      <Field
        label={
          <>
            Notes for the reviewer <span className="font-normal text-hc-muted">(optional)</span>
          </>
        }
        htmlFor="notes"
        error={fe.notes}
      >
        <Textarea
          id="notes"
          name="notes"
          maxLength={MAX_NOTES_CHARS}
          placeholder="Anything that helps: where the CAD lives, parts you already own, open questions."
          invalid={!!fe.notes}
          aria-describedby={describedBy("notes", { error: fe.notes })}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 block text-sm font-medium text-hc-dark">Safety pledge</legend>
        {PLEDGES.map((p) => {
          const name = `pledge_${p.key}`;
          const error = fe[name];
          return (
            <div key={p.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-4 py-3 text-sm transition-colors hover:bg-mist">
                <input
                  type="checkbox"
                  name={name}
                  required
                  aria-invalid={error ? true : undefined}
                  className="mt-0.5 size-4 shrink-0 accent-hc-blue"
                />
                <span className="text-hc-dark">{p.text}</span>
              </label>
              {error && <p className="mt-1 text-sm text-hc-red">{error}</p>}
            </div>
          );
        })}
      </fieldset>

      {state.error && <p className="text-sm text-hc-red">{state.error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
        {blockedReason && <p className="mr-auto text-sm text-hc-red">{blockedReason}</p>}
        <Button type="submit" disabled={pending || !!blockedReason}>
          {pending ? "Submitting…" : "Submit for Design Review"}
        </Button>
      </div>
    </form>
  );
}
