import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/cx";
import { STEPS, needsChanges, stepIndex, type ProjectStatus } from "@/lib/status";

type StepState = "done" | "current" | "future";

/** `compact` drops the panel frame and shrinks everything to sit inside another panel. */
export function FlightStepper({
  status,
  compact = false,
}: {
  status: ProjectStatus;
  compact?: boolean;
}) {
  const rejected = status === "rejected";
  const current = stepIndex(status);
  // Airborne is the finish line, so it reads as done rather than in progress.
  const finished = status === "airborne";
  const returned = needsChanges(status);

  const stateOf = (i: number): StepState => {
    if (rejected) return "future";
    if (finished || i < current) return "done";
    return i === current ? "current" : "future";
  };

  return (
    <div className={compact ? undefined : "rounded-lg border border-line bg-white px-4 py-5 sm:px-6"}>
      <div className={compact ? "overflow-x-auto" : "-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"}>
        <ol className={cx("flex", compact ? "min-w-[24rem]" : "min-w-[34rem]")}>
          {STEPS.map((label, i) => {
            const s = stateOf(i);
            const leftDone = i > 0 && stateOf(i - 1) === "done" && s !== "future";
            const rightDone = s === "done" && i < STEPS.length - 1 && stateOf(i + 1) !== "future";
            return (
              <li
                key={label}
                className="flex flex-1 flex-col items-center"
                aria-current={s === "current" ? "step" : undefined}
              >
                <div className="flex w-full items-center">
                  <span
                    aria-hidden
                    className={cx(
                      "h-px flex-1",
                      i === 0 ? "bg-transparent" : leftDone ? "bg-hc-dark" : "bg-line",
                    )}
                  />
                  <span
                    className={cx(
                      "flex shrink-0 items-center justify-center rounded-full border font-mono",
                      compact ? "size-5 text-[10px]" : "size-7 text-xs",
                      s === "done" && "border-hc-dark bg-hc-dark text-white",
                      s === "current" && "border-hc-blue bg-white text-hc-blue",
                      s === "future" && "border-line bg-white text-hc-muted",
                    )}
                  >
                    {s === "done" ? <Icon name="check" size={compact ? 11 : 14} label="Done" /> : i + 1}
                  </span>
                  <span
                    aria-hidden
                    className={cx(
                      "h-px flex-1",
                      i === STEPS.length - 1
                        ? "bg-transparent"
                        : rightDone
                          ? "bg-hc-dark"
                          : "bg-line",
                    )}
                  />
                </div>
                <span
                  className={cx(
                    "px-1 text-center leading-tight",
                    compact ? "mt-1.5 text-[11px]" : "mt-2 text-xs",
                    s === "done" && "text-hc-dark",
                    s === "current" && "font-medium text-hc-blue",
                    s === "future" && "text-hc-muted",
                  )}
                >
                  {label}
                </span>
                {s === "current" && returned && (
                  <span className="mt-1 font-mono text-[10px] uppercase tracking-wide text-hc-red">
                    Needs changes
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {rejected && (
        <p
          className={cx(
            "border-t border-line text-hc-red",
            compact ? "mt-3 pt-2 text-xs" : "mt-4 pt-3 text-sm",
          )}
        >
          This aircraft was rejected at review and won&apos;t move forward.
        </p>
      )}
    </div>
  );
}
