import type { ReactNode } from "react";
import type { Project } from "@/lib/db/schema";
import { reviewedHours, reviewedTier, type PublicReview } from "@/lib/projects";
import {
  FUEL_PER_HOUR,
  formatHoursExact,
  formatMultiplier,
  formatUSD,
  fuelFor,
  grantCents,
  minutesToHours,
  rateCents,
  toTier,
} from "@/lib/tiers";

const FUNDED: Project["status"][] = ["parts_funded", "flight_review", "flight_returned", "airborne"];

type Props = {
  project: Pick<Project, "status" | "tier">;
  designMinutes: number;
  buildMinutes: number;
  approvedDesign: PublicReview | null;
  approvedFlight: PublicReview | null;
};

export function GrantReadout({
  project,
  designMinutes,
  buildMinutes,
  approvedDesign,
  approvedFlight,
}: Props) {
  const design =
    FUNDED.includes(project.status) && approvedDesign
      ? {
          hours: reviewedHours(approvedDesign),
          tier: toTier(reviewedTier(approvedDesign)),
          cents: approvedDesign.grantCents,
          approved: true,
        }
      : (() => {
          const hours = minutesToHours(designMinutes);
          const tier = toTier(project.tier);
          return { hours, tier, cents: grantCents(hours, tier), approved: false };
        })();

  const build =
    project.status === "airborne" && approvedFlight
      ? {
          hours: reviewedHours(approvedFlight),
          tier: toTier(reviewedTier(approvedFlight)),
          fuel: approvedFlight.fuel,
          approved: true,
        }
      : (() => {
          const hours = minutesToHours(buildMinutes);
          const tier = toTier(project.tier);
          return { hours, tier, fuel: fuelFor(hours, tier), approved: false };
        })();

  return (
    <section className="rounded-lg border border-line bg-white">
      <h2 className="px-5 pt-4 text-sm font-medium">Payout</h2>
      <div className="divide-y divide-line">
        <Row label="Design hours" approved={design.approved} note="HCB grant for parts">
          {formatHoursExact(design.hours)} × {formatUSD(rateCents(design.tier))} ={" "}
          <span className="font-bold">{formatUSD(design.cents)}</span>
        </Row>
        <Row label="Build hours" approved={build.approved} note="Fuel for the shop">
          {formatHoursExact(build.hours)} × {FUEL_PER_HOUR} × {formatMultiplier(build.tier)} ={" "}
          <span className="font-bold">{build.fuel.toLocaleString("en-US")} fuel</span>
        </Row>
      </div>
    </section>
  );
}

function Row({
  label,
  approved,
  note,
  children,
}: {
  label: string;
  approved: boolean;
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-wide text-hc-muted">{label}</p>
        <span
          className={
            approved
              ? "font-mono text-[11px] uppercase tracking-wide text-hc-dark"
              : "font-mono text-[11px] uppercase tracking-wide text-hc-muted"
          }
        >
          {approved ? "approved" : "estimate"}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-sm tabular-nums text-hc-dark">{children}</p>
      <p className="mt-1 text-xs text-hc-muted">{note}</p>
    </div>
  );
}
