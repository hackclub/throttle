import type { LogEntry, Project } from "@/lib/db/schema";

export type ProjectStatus = Project["status"];
export type LogPhase = LogEntry["phase"];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  drafting: "Drafting",
  design_review: "Design Review",
  design_returned: "Design Returned",
  parts_funded: "Parts Funded",
  flight_review: "Flight Review",
  flight_returned: "Flight Returned",
  airborne: "Airborne",
  rejected: "Rejected",
};

export const STEPS = [
  "Drafting",
  "Design Review",
  "Parts Funded",
  "Flight Review",
  "Airborne",
] as const;

// Returned projects sit on the step they were sent back from. Rejected
// projects have no meaningful step, so they report -1.
const STEP_INDEX: Record<ProjectStatus, number> = {
  drafting: 0,
  design_review: 1,
  design_returned: 1,
  parts_funded: 2,
  flight_review: 3,
  flight_returned: 3,
  airborne: 4,
  rejected: -1,
};

export function stepIndex(status: ProjectStatus): number {
  return STEP_INDEX[status];
}

export function needsChanges(status: ProjectStatus): boolean {
  return status === "design_returned" || status === "flight_returned";
}

/** Waiting on a reviewer. Nothing in the journal changes while this is true. */
export function isInReview(status: ProjectStatus): boolean {
  return status === "design_review" || status === "flight_review";
}

/** Finished one way or the other. */
export function isClosed(status: ProjectStatus): boolean {
  return status === "airborne" || status === "rejected";
}

/** Journal entries count as design hours until parts are funded, build hours after. */
export function logPhaseFor(status: ProjectStatus): LogPhase {
  return status === "drafting" || status === "design_review" || status === "design_returned"
    ? "design"
    : "build";
}

/**
 * One-line version of the project page's NextStep panel. `phaseMinutes` is
 * what's logged in the phase the project is currently in.
 */
export function nextStepSentence(status: ProjectStatus, phaseMinutes: number): string {
  switch (status) {
    case "drafting":
      return phaseMinutes > 0
        ? "Check your repo has a bom.csv, then submit for Design Review."
        : "Log your first design session, then submit for Design Review.";
    case "design_returned":
      return "Design Review came back with changes. Read the feedback, update it, then resubmit.";
    case "design_review":
      return "Design Review is with a reviewer. The log is locked until it comes back.";
    case "parts_funded":
      return phaseMinutes > 0
        ? "Fly it, film the maiden flight, then submit for Flight Review."
        : "Parts are funded. Log your first build session.";
    case "flight_returned":
      return "Flight Review came back with changes. Read the feedback, fix it, then resubmit.";
    case "flight_review":
      return "Flight Review is with a reviewer. The log is locked until it comes back.";
    case "airborne":
      return "Shipped.";
    case "rejected":
      return "This aircraft won't move forward.";
  }
}

/** Statuses where entries of a phase can still be added or removed. */
export const OPEN_STATUSES: Record<LogPhase, readonly ProjectStatus[]> = {
  design: ["drafting", "design_returned"],
  build: ["parts_funded", "flight_returned"],
};
