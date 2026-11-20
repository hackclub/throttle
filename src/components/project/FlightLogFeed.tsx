import { deleteLogEntry } from "@/app/(workspace)/projects/actions";
import { Markdown } from "@/components/Markdown";
import type { LogEntry } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { formatHoursExact, minutesToHours } from "@/lib/tiers";

type Props = {
  /** Newest first. */
  entries: LogEntry[];
  /** Entry ids the viewer may delete. */
  deletable: ReadonlySet<string>;
};

export function FlightLogFeed({ entries, deletable }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white px-5 py-10 text-center text-sm text-hc-dark/70">
        No entries yet. Log your first session: what you did, what broke, a photo.
      </div>
    );
  }

  return (
    <ol className="divide-y divide-line rounded-lg border border-line bg-white">
      {entries.map((entry) => (
        <li key={entry.id} className="px-5 py-5">
          <div className="flex items-center gap-2 font-mono text-xs text-hc-muted">
            <time dateTime={entry.createdAt.toISOString()}>{formatDate(entry.createdAt)}</time>
            <span aria-hidden>·</span>
            <span className="tabular-nums text-hc-dark">
              {formatHoursExact(minutesToHours(entry.minutes))}
            </span>
            <span className="ml-1 rounded border border-line px-1.5 py-px text-[10px] tracking-wide">
              {entry.phase === "design" ? "DESIGN" : "BUILD"}
            </span>
            {deletable.has(entry.id) && (
              <form action={deleteLogEntry} className="ml-auto">
                <input type="hidden" name="entryId" value={entry.id} />
                <button
                  type="submit"
                  className="rounded px-1.5 py-0.5 font-sans text-xs text-hc-muted transition-colors hover:text-hc-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40"
                >
                  Delete
                </button>
              </form>
            )}
          </div>

          <Markdown className="mt-3">{entry.body}</Markdown>

          {entry.photos.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {entry.photos.map((src, i) => (
                <li key={src}>
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40 rounded-lg"
                  >
                    {/* Uploads live on R2 or /public, at arbitrary sizes. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Photo ${i + 1} from this session`}
                      loading="lazy"
                      className="size-20 rounded-lg border border-line object-cover sm:size-24"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
