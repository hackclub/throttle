import { STATUS_LABEL, type ProjectStatus } from "@/lib/status";
import { TIERS, isTier } from "@/lib/tiers";
import { cx } from "./cx";

const pill =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide";

// Text stays dark on every tint so the label is readable; the dot carries the colour.
const tone: Record<ProjectStatus, { bg: string; dot: string }> = {
  drafting: { bg: "bg-hc-muted/15 text-hc-dark", dot: "bg-hc-muted" },
  design_review: { bg: "bg-hc-yellow/20 text-hc-dark", dot: "bg-hc-yellow" },
  flight_review: { bg: "bg-hc-yellow/20 text-hc-dark", dot: "bg-hc-yellow" },
  parts_funded: { bg: "bg-hc-blue/15 text-hc-dark", dot: "bg-hc-blue" },
  design_returned: { bg: "bg-hc-red/15 text-hc-dark", dot: "bg-hc-red" },
  flight_returned: { bg: "bg-hc-red/15 text-hc-dark", dot: "bg-hc-red" },
  airborne: { bg: "bg-hc-green/20 text-hc-dark", dot: "bg-hc-green" },
  rejected: { bg: "bg-hc-dark text-white", dot: "bg-white/70" },
};

export function StatusPill({ status, className }: { status: ProjectStatus; className?: string }) {
  const t = tone[status];
  return (
    <span className={cx(pill, t.bg, className)}>
      <span aria-hidden className={cx("size-1.5 rounded-full", t.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

type SubmissionStatus = "pending" | "approved" | "returned" | "rejected";

const submissionTone: Record<SubmissionStatus, { bg: string; dot: string; label: string }> = {
  pending: { bg: "bg-hc-yellow/20 text-hc-dark", dot: "bg-hc-yellow", label: "In review" },
  approved: { bg: "bg-hc-green/20 text-hc-dark", dot: "bg-hc-green", label: "Approved" },
  returned: { bg: "bg-hc-red/15 text-hc-dark", dot: "bg-hc-red", label: "Returned" },
  rejected: { bg: "bg-hc-dark text-white", dot: "bg-white/70", label: "Rejected" },
};

export function SubmissionPill({
  status,
  className,
}: {
  status: SubmissionStatus;
  className?: string;
}) {
  const t = submissionTone[status];
  return (
    <span className={cx(pill, t.bg, className)}>
      <span aria-hidden className={cx("size-1.5 rounded-full", t.dot)} />
      {t.label}
    </span>
  );
}

export function TierPill({ tier, className }: { tier: number; className?: string }) {
  return (
    <span className={cx(pill, "border border-line bg-white text-hc-dark", className)}>
      {isTier(tier) ? TIERS[tier].name : `Tier ${tier}`}
    </span>
  );
}
