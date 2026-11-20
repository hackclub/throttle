import type { ReactNode } from "react";
import { markGrantSent } from "@/app/(workspace)/admin/reviews/actions";
import { PLEDGES } from "@/app/(workspace)/submit/form-state";
import { FlightLogFeed } from "@/components/project/FlightLogFeed";
import { Icon } from "@/components/ui/Icon";
import { SubmissionPill } from "@/components/ui/Pill";
import { cx } from "@/components/ui/cx";
import type {
  DesignSubmissionData,
  FlightSubmissionData,
  LogEntry,
  Submission,
} from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { reviewedHours, reviewedTier } from "@/lib/projects";
import type { AuditRow, HistoryReview } from "@/lib/reviews";
import {
  FUEL_PER_HOUR,
  TIERS,
  formatHoursExact,
  formatMultiplier,
  formatUSD,
  isTier,
  minutesToHours,
  rateCents,
  toTier,
} from "@/lib/tiers";
import { isPlayableVideo } from "@/lib/upload-rules";

const panel = "rounded-lg border border-line bg-white";
const label = "font-mono text-[11px] uppercase tracking-wide text-hc-muted";

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className={cx(panel, "px-5 py-10 text-center text-sm text-hc-dark/70")}>{children}</div>
  );
}

// ---- 1 Journal -------------------------------------------------------------

const LONG_ENTRY_MINUTES = 180;
const FEW_WORDS = 80;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function entryFlags(entry: Pick<LogEntry, "minutes" | "body" | "photos">): string[] {
  const flags: string[] = [];
  if (entry.minutes > LONG_ENTRY_MINUTES && wordCount(entry.body) < FEW_WORDS) {
    flags.push(`>${LONG_ENTRY_MINUTES / 60} h, <${FEW_WORDS} words`);
  }
  if (entry.photos.length === 0) flags.push("no photos");
  return flags;
}

/** Entries of the phase under review, newest first. */
export function JournalPanel({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return <Empty>No entries in this phase.</Empty>;

  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
  const flagged = entries.filter((e) => entryFlags(e).length > 0).length;

  return (
    <div className="space-y-5">
      <div className={cx(panel, "overflow-x-auto")}>
        <div className="flex items-baseline justify-between gap-3 px-5 pt-3 pb-2">
          <h3 className="text-sm font-medium">Hours per entry</h3>
          <p className="font-mono text-xs tabular-nums text-hc-muted">
            {entries.length} entries · {formatHoursExact(minutesToHours(totalMinutes))}
            {flagged > 0 && <span className="text-hc-red"> · {flagged} flagged</span>}
          </p>
        </div>
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-y border-line font-mono text-[11px] uppercase tracking-wide text-hc-muted">
              <th scope="col" className="px-5 py-1.5 text-left font-normal">
                Date
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-normal">
                Min
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-normal">
                Words
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-normal">
                Photos
              </th>
              <th scope="col" className="px-5 py-1.5 text-left font-normal">
                Flag
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-mono text-xs tabular-nums">
            {entries.map((e) => {
              const flags = entryFlags(e);
              return (
                <tr key={e.id} className={flags.length > 0 ? "text-hc-red" : undefined}>
                  <td className="px-5 py-1.5">
                    <time dateTime={e.createdAt.toISOString()}>{formatDate(e.createdAt)}</time>
                  </td>
                  <td className="px-3 py-1.5 text-right">{e.minutes}</td>
                  <td className="px-3 py-1.5 text-right">{wordCount(e.body)}</td>
                  <td className="px-3 py-1.5 text-right">{e.photos.length}</td>
                  <td className="px-5 py-1.5">{flags.length > 0 ? flags.join(" · ") : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FlightLogFeed entries={entries} deletable={new Set()} />
    </div>
  );
}

// ---- 3 Submission ----------------------------------------------------------

function Spec({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className={label}>{name}</dt>
      <dd className="min-w-0 text-sm break-words text-hc-dark">{children}</dd>
    </div>
  );
}

export function SubmissionPanel({ submission }: { submission: Submission }) {
  if (submission.kind === "design") {
    const d = submission.data as DesignSubmissionData;
    return (
      <dl className={cx(panel, "divide-y divide-line")}>
        <Spec name="All-up weight">
          <span className="font-mono tabular-nums">{d.weightGrams.toLocaleString("en-US")} g</span>
        </Spec>
        <Spec name="Battery">{d.battery}</Spec>
        <Spec name="Propulsion">{d.propulsion}</Spec>
        <Spec name="Notes">
          {d.notes ? (
            <span className="whitespace-pre-line">{d.notes}</span>
          ) : (
            <span className="text-hc-muted">None</span>
          )}
        </Spec>
        <Spec name="bom.csv">
          <a
            href={d.bomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 font-mono text-xs text-hc-blue hover:underline"
          >
            <span className="truncate">{d.bomUrl}</span>
            <Icon name="external" size={13} className="shrink-0" />
          </a>
        </Spec>
        <Spec name="Safety pledge">
          <ul className="space-y-2">
            {PLEDGES.map((p) => {
              const ok = d.pledges?.[p.key] === true;
              return (
                <li key={p.key} className="flex items-start gap-2.5">
                  <Icon
                    name={ok ? "check" : "x"}
                    label={ok ? "Ticked" : "Not ticked"}
                    className={cx("mt-0.5 shrink-0", ok ? "text-hc-dark" : "text-hc-red")}
                  />
                  <span className={ok ? undefined : "text-hc-red"}>{p.text}</span>
                </li>
              );
            })}
          </ul>
        </Spec>
      </dl>
    );
  }

  const f = submission.data as FlightSubmissionData;
  const playable = isPlayableVideo(f.videoUrl);
  let host = f.videoUrl;
  try {
    host = new URL(f.videoUrl).hostname.replace(/^www\./, "");
  } catch {
    // Stored links were validated on submit; fall back to the raw string.
  }

  return (
    <div className="space-y-5">
      <section className={cx(panel, "space-y-3 px-5 py-4")}>
        <h3 className={label}>Flight video</h3>
        {playable ? (
          <video
            controls
            preload="metadata"
            src={f.videoUrl}
            className="w-full rounded-lg border border-line bg-hc-dark"
          />
        ) : (
          <a
            href={f.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-lg border border-hc-blue px-5 py-5 transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hc-blue text-white">
              <Icon name="play" size={18} />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-hc-dark">Open flight video</span>
              <span className="block truncate font-mono text-xs text-hc-muted">
                {host} · {f.videoUrl}
              </span>
            </span>
            <Icon name="external" className="ml-auto shrink-0 text-hc-blue" />
          </a>
        )}
      </section>

      <section className={cx(panel, "space-y-3 px-5 py-4")}>
        <h3 className={label}>Final build photo</h3>
        <a href={f.finalPhotoUrl} target="_blank" rel="noopener noreferrer" className="block">
          {/* Uploads live on R2 or /public, at arbitrary sizes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.finalPhotoUrl}
            alt="Final build"
            className="max-h-[28rem] w-full rounded-lg border border-line object-contain"
          />
        </a>
      </section>

      <section className={cx(panel, "space-y-2 px-5 py-4")}>
        <h3 className={label}>What I learned</h3>
        <p className="text-[15px] leading-relaxed whitespace-pre-line text-hc-dark">{f.learned}</p>
      </section>
    </div>
  );
}

// ---- 4 History -------------------------------------------------------------

const KIND_LABEL: Record<Submission["kind"], string> = {
  design: "Design Review",
  flight: "Flight Review",
};

function Equation({ review }: { review: HistoryReview }) {
  const hours = reviewedHours(review);
  const tierValue = reviewedTier(review);
  if (!isTier(tierValue)) return null;
  const tier = toTier(tierValue);
  if (review.kind === "design") {
    return (
      <>
        {formatHoursExact(hours)} × {formatUSD(rateCents(tier))} ={" "}
        <span className="font-bold">{formatUSD(review.grantCents)}</span>
      </>
    );
  }
  return (
    <>
      {formatHoursExact(hours)} × {FUEL_PER_HOUR} × {formatMultiplier(tier)} ={" "}
      <span className="font-bold">{review.fuel.toLocaleString("en-US")} fuel</span>
    </>
  );
}

function auditMeta(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  return Object.entries(meta)
    .filter(([k, v]) => k !== "projectId" && v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" ");
}

export function HistoryPanel({
  reviews,
  audit,
  ownerEmail,
}: {
  reviews: HistoryReview[];
  audit: AuditRow[];
  ownerEmail: string;
}) {
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className={label}>Previous reviews</h3>
        {reviews.length === 0 ? (
          <Empty>No reviews of this aircraft yet.</Empty>
        ) : (
          <ol className={cx(panel, "divide-y divide-line")}>
            {reviews.map((r) => {
              const tier = reviewedTier(r);
              const needsGrant = r.kind === "design" && r.result === "approved" && r.grantCents > 0;
              return (
                <li key={r.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <SubmissionPill status={r.result} />
                    <span className="font-medium">{KIND_LABEL[r.kind]}</span>
                    <span className="text-sm text-hc-dark/70">by {r.reviewerName ?? "unknown"}</span>
                    <time
                      dateTime={r.createdAt.toISOString()}
                      className="ml-auto font-mono text-xs text-hc-muted"
                    >
                      {formatDate(r.createdAt)}
                    </time>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular-nums sm:grid-cols-4">
                    <div>
                      <dt className="text-hc-muted">Hours</dt>
                      <dd>
                        {formatHoursExact(reviewedHours(r))}
                        {r.hoursOverride !== null && (
                          <span className="text-hc-muted"> (was {formatHoursExact(r.hoursSubmitted)})</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-hc-muted">Tier</dt>
                      <dd>
                        {isTier(tier) ? TIERS[tier].name : `Tier ${tier}`}
                        {r.tierOverride !== null && (
                          <span className="text-hc-muted"> (was {r.tier})</span>
                        )}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-hc-muted">{r.kind === "design" ? "Grant" : "Fuel"}</dt>
                      <dd>
                        {r.result === "approved" ? <Equation review={r} /> : <span className="text-hc-muted">—</span>}
                      </dd>
                    </div>
                  </dl>

                  {needsGrant && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-l-2 border-line border-l-hc-red px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        Send <span className="font-mono font-bold">{formatUSD(r.grantCents)}</span> HCB grant to{" "}
                        <span className="font-mono">{ownerEmail}</span>
                      </span>
                      {r.grantSent ? (
                        <span className="font-mono text-[11px] uppercase tracking-wide text-hc-muted">
                          marked sent
                        </span>
                      ) : (
                        <form action={markGrantSent}>
                          <input type="hidden" name="reviewId" value={r.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-line px-2 py-0.5 text-xs transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40"
                          >
                            Mark sent
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className={label}>Justification (internal)</p>
                    <p className="text-sm whitespace-pre-line text-hc-dark">{r.justification}</p>
                  </div>
                  {r.feedback && (
                    <div className="space-y-1">
                      <p className={label}>Feedback to builder</p>
                      <p className="text-sm whitespace-pre-line text-hc-dark">{r.feedback}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="space-y-2">
        <h3 className={label}>Audit log</h3>
        {audit.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <div className={cx(panel, "overflow-x-auto")}>
            <table className="w-full min-w-[36rem] font-mono text-xs">
              <tbody className="divide-y divide-line">
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-1.5 whitespace-nowrap text-hc-muted">
                      <time dateTime={a.createdAt.toISOString()}>{formatDate(a.createdAt)}</time>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-hc-dark">{a.action}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-hc-dark/80">{a.actorName ?? "system"}</td>
                    <td className="px-5 py-1.5 break-all text-hc-muted">{auditMeta(a.meta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
