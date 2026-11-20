import Link from "next/link";
import { connection } from "next/server";
import { Icon } from "@/components/ui/Icon";
import { fetchBom, isBomError, lineCents } from "@/lib/bom";
import { parseRepoUrl, repoFileUrl } from "@/lib/github";
import { formatUSD } from "@/lib/tiers";

const panel = "rounded-lg border border-line bg-white";

export async function BomPanel({ repoUrl }: { repoUrl: string }) {
  await connection();
  const bom = await fetchBom(repoUrl);
  const ref = parseRepoUrl(repoUrl);

  if (isBomError(bom)) {
    return (
      <div className={`${panel} px-5 py-10 text-center text-sm`}>
        {bom.error === "not_found" ? (
          <p className="text-hc-dark/80">No bom.csv at the root of your repo yet.</p>
        ) : (
          <p className="text-hc-dark/80">
            Couldn&apos;t read bom.csv. Check it&apos;s plain CSV with a header row.
          </p>
        )}
        <Link href="/docs/bom" className="mt-2 inline-block text-hc-blue hover:underline">
          How to write a bom.csv
        </Link>
      </div>
    );
  }

  const { rows, totalCents, missingColumns } = bom;

  return (
    <div className="space-y-3">
      {missingColumns.length > 0 && (
        <div className="rounded-lg border border-l-2 border-line border-l-hc-red bg-white px-4 py-3 text-sm">
          <p>
            bom.csv is missing{" "}
            {missingColumns.map((c, i) => (
              <span key={c}>
                {i > 0 && ", "}
                <code className="font-mono text-[13px]">{c}</code>
              </span>
            ))}
            . Expected columns: <code className="font-mono text-[13px]">part, qty, unit_price, link</code>.{" "}
            <Link href="/docs/bom" className="text-hc-blue hover:underline">
              Format guide
            </Link>
          </p>
        </div>
      )}

      <div className={`${panel} overflow-x-auto`}>
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wide text-hc-muted">
              <th scope="col" className="px-5 py-2.5 text-left font-normal">
                Part
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">
                Qty
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">
                Unit
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">
                Subtotal
              </th>
              <th scope="col" className="px-5 py-2.5 text-left font-normal">
                Link
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-hc-muted">
                  bom.csv has a header but no parts yet.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="px-5 py-2.5">{row.part || <span className="text-hc-muted">-</span>}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.qty}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {formatUSD(row.unitPriceCents)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {formatUSD(lineCents(row))}
                </td>
                <td className="px-5 py-2.5">
                  {row.link ? (
                    <a
                      href={row.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-48 items-center gap-1 text-hc-blue hover:underline"
                    >
                      <span className="truncate">{new URL(row.link).hostname.replace(/^www\./, "")}</span>
                      <Icon name="external" size={13} className="shrink-0" />
                    </a>
                  ) : (
                    <span className="text-hc-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <th scope="row" colSpan={3} className="px-5 py-3 text-left font-medium">
                Total
              </th>
              <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">
                {formatUSD(totalCents)}
              </td>
              <td className="px-5 py-3">
                {ref && (
                  <a
                    href={repoFileUrl(ref, "bom.csv")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-hc-blue hover:underline"
                  >
                    bom.csv
                    <Icon name="external" size={13} />
                  </a>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function BomSkeleton() {
  return <div className={`${panel} h-64`} aria-hidden />;
}
