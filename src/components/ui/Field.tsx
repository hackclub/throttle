import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

type FieldProps = {
  label: ReactNode;
  /** id of the control, used to wire up the label, hint and error. */
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-hc-dark">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-sm text-hc-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-hc-red">
          {error}
        </p>
      )}
    </div>
  );
}

/** aria-describedby value matching the ids Field renders. */
export function describedBy(id: string, opts: { hint?: unknown; error?: unknown }) {
  const ids = [opts.hint ? `${id}-hint` : "", opts.error ? `${id}-error` : ""];
  return ids.filter(Boolean).join(" ") || undefined;
}

const control =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-hc-dark " +
  "placeholder:text-hc-muted focus:border-hc-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40 " +
  "disabled:cursor-not-allowed disabled:bg-mist disabled:text-hc-muted " +
  "aria-[invalid=true]:border-hc-red";

type Invalid = { invalid?: boolean };

export function Input({ className, invalid, ...rest }: ComponentProps<"input"> & Invalid) {
  return <input aria-invalid={invalid || undefined} className={cx(control, className)} {...rest} />;
}

export function Textarea({ className, invalid, ...rest }: ComponentProps<"textarea"> & Invalid) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cx(control, "min-h-28 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Select({ className, invalid, children, ...rest }: ComponentProps<"select"> & Invalid) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cx(control, "appearance-none pr-9", className)}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevron-right"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rotate-90 text-hc-muted"
      />
    </div>
  );
}
