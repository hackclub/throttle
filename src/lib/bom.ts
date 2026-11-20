import { cache } from "react";
import { parseRepoUrl, rawFileUrl } from "@/lib/github";

export type BomRow = {
  part: string;
  qty: number;
  unitPriceCents: number;
  /** Only http(s) links survive; anything else becomes null. */
  link: string | null;
};

export type Bom = {
  rows: BomRow[];
  totalCents: number;
  /** Canonical names of the columns we couldn't find, e.g. ["qty", "link"]. */
  missingColumns: string[];
};

export type BomError = { error: "not_found" | "unreadable" };

export type BomResult = Bom | BomError;

export function isBomError(result: BomResult): result is BomError {
  return "error" in result;
}

/**
 * RFC 4180-ish: quoted fields, "" inside quotes, commas and newlines inside
 * quotes, LF or CRLF line endings, optional UTF-8 BOM. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const COLUMNS = {
  part: ["part", "name", "item"],
  qty: ["qty", "quantity"],
  unit_price: ["unit_price", "price", "cost"],
  link: ["link", "url", "source"],
} as const;

type Column = keyof typeof COLUMNS;

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

function number(value: string | undefined): number {
  const n = Number.parseFloat((value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function safeLink(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Turns parsed CSV into BOM rows. Returns null if there's no header row. */
export function toBom(table: string[][]): Bom | null {
  const [header, ...body] = table;
  if (!header) return null;

  const names = header.map(normalizeHeader);
  const index = {} as Record<Column, number>;
  for (const col of Object.keys(COLUMNS) as Column[]) {
    index[col] = names.findIndex((n) => (COLUMNS[col] as readonly string[]).includes(n));
  }
  const missingColumns = (Object.keys(index) as Column[]).filter((c) => index[c] === -1);

  const cell = (r: string[], col: Column) => (index[col] === -1 ? undefined : r[index[col]]);

  const rows: BomRow[] = body.map((r) => ({
    part: cell(r, "part")?.trim() ?? "",
    // No qty column at all means one of each.
    qty: index.qty === -1 ? 1 : number(cell(r, "qty")),
    unitPriceCents: Math.round(number(cell(r, "unit_price")) * 100),
    link: safeLink(cell(r, "link")),
  }));

  const totalCents = rows.reduce((sum, r) => sum + lineCents(r), 0);
  return { rows, totalCents, missingColumns };
}

/** qty × unit price, in whole cents. */
export function lineCents(row: Pick<BomRow, "qty" | "unitPriceCents">): number {
  return Math.round(row.qty * row.unitPriceCents);
}

const MAX_BYTES = 256 * 1024;
const MAX_ROWS = 500;

/** Reads bom.csv from the root of the repo's default branch. Deduplicated per request. */
export const fetchBom = cache(async (repoUrl: string): Promise<BomResult> => {
  const ref = parseRepoUrl(repoUrl);
  if (!ref) return { error: "not_found" };

  let text: string;
  try {
    const res = await fetch(rawFileUrl(ref, "bom.csv"), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { error: "not_found" };
    if (!res.ok) return { error: "unreadable" };
    text = await res.text();
  } catch {
    return { error: "unreadable" };
  }

  if (text.length > MAX_BYTES) return { error: "unreadable" };

  const bom = toBom(parseCsv(text).slice(0, MAX_ROWS + 1));
  return bom ?? { error: "unreadable" };
});
