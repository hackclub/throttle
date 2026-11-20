import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="font-mono text-[11px] uppercase tracking-wide text-hc-muted">{label}</p>
      <p className="mt-1 font-mono text-xl text-hc-dark tabular-nums">{value}</p>
    </div>
  );
}
