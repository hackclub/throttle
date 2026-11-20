import Link from "next/link";
import { markGrantSent } from "@/app/(workspace)/admin/reviews/actions";
import { formatDate } from "@/lib/format";
import type { GrantToSend } from "@/lib/reviews";
import { formatUSD } from "@/lib/tiers";

/** Approved design grants still waiting to be sent by hand on HCB. */
export function GrantsToSend({ grants }: { grants: GrantToSend[] }) {
  return (
    <section className="rounded-lg border border-l-2 border-line border-l-hc-red bg-white">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <h2 className="text-sm font-medium">HCB grants to send</h2>
        <p className="font-mono text-[11px] uppercase tracking-wide text-hc-muted">
          sent by hand · {grants.length}
        </p>
      </div>
      <ul className="divide-y divide-line">
        {grants.map((g) => (
          <li key={g.reviewId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              Send <span className="font-mono font-bold tabular-nums">{formatUSD(g.grantCents)}</span> HCB
              grant to <span className="font-mono">{g.ownerEmail}</span>
              <span className="text-hc-muted">
                {" "}
                ·{" "}
                <Link href={`/projects/${g.projectId}`} className="hover:text-hc-dark hover:underline">
                  {g.title}
                </Link>
              </span>
            </span>
            <time dateTime={g.createdAt.toISOString()} className="font-mono text-xs text-hc-muted">
              approved {formatDate(g.createdAt)}
            </time>
            <form action={markGrantSent}>
              <input type="hidden" name="reviewId" value={g.reviewId} />
              <button
                type="submit"
                className="rounded-md border border-line px-2 py-0.5 text-xs text-hc-dark transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40"
              >
                Mark sent
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
