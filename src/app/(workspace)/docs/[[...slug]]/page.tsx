import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Markdown } from "@/components/Markdown";
import { ArtSlot } from "@/components/ui/ArtSlot";
import { cx } from "@/components/ui/cx";

const DOCS = [
  { slug: "how-it-works", title: "How it works" },
  { slug: "tiers", title: "Tier rates" },
  { slug: "journaling", title: "Good journaling" },
  { slug: "bom", title: "bom.csv & funding" },
  { slug: "safety", title: "Aviation safety" },
  { slug: "faq", title: "FAQ" },
] as const;

type Doc = (typeof DOCS)[number];

// Art that sits above a page's markdown.
const DOC_ART: Partial<Record<Doc["slug"], { name: string; alt: string }>> = {
  safety: {
    name: "safety-diagram.svg",
    alt: "LiPo in a fireproof bag, hands clear of the prop arc, and no flying over people, roads or airports",
  },
  bom: { name: "bom-example.png", alt: "An example bom.csv" },
};

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "docs");

type Props = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: [d.slug] }));
}

/** /docs is the first page; anything not in DOCS is a 404. */
function findDoc(slug: string[] | undefined): Doc | null {
  if (!slug || slug.length === 0) return DOCS[0];
  if (slug.length !== 1) return null;
  return DOCS.find((d) => d.slug === slug[0]) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = findDoc((await params).slug);
  return { title: doc ? `${doc.title} · Throttle docs` : "Docs · Throttle" };
}

// params are awaited inside the boundary so unlisted URLs still get the
// prerendered shell; the six listed pages prerender in full.
export default function DocsPage({ params }: Props) {
  return (
    <Suspense fallback={<DocsFrame active={null} />}>
      <DocContent params={params} />
    </Suspense>
  );
}

async function DocContent({ params }: Props) {
  const doc = findDoc((await params).slug);
  if (!doc) notFound();

  const source = readFileSync(path.join(CONTENT_DIR, `${doc.slug}.md`), "utf8");
  const art = DOC_ART[doc.slug];

  return (
    <DocsFrame active={doc.slug}>
      <h1 className="text-3xl font-bold tracking-tight text-hc-dark">{doc.title}</h1>
      {art && <ArtSlot name={art.name} ratio="16/9" alt={art.alt} className="mt-6" />}
      <Markdown className="mt-6 [&_h2]:mt-9 [&_h3]:mt-6 [&_table]:my-5">{source}</Markdown>
    </DocsFrame>
  );
}

function DocsFrame({ active, children }: { active: Doc["slug"] | null; children?: ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <aside className="-mx-4 mb-8 border-b border-line px-4 sm:-mx-6 sm:px-6 md:mx-0 md:mb-0 md:border-r md:border-b-0 md:px-0">
        <nav aria-label="Docs" className="overflow-x-auto md:sticky md:top-6 md:overflow-visible">
          <ul className="flex gap-4 whitespace-nowrap md:flex-col md:gap-0.5">
            {DOCS.map((d) => {
              const isActive = d.slug === active;
              return (
                <li key={d.slug}>
                  <Link
                    href={`/docs/${d.slug}`}
                    aria-current={isActive ? "page" : undefined}
                    className={cx(
                      "block border-b-2 py-2.5 text-sm transition-colors md:border-b-0 md:border-l-2 md:py-1.5 md:pl-3",
                      isActive
                        ? "border-hc-blue font-bold text-hc-dark"
                        : "border-transparent text-hc-muted hover:text-hc-dark",
                    )}
                  >
                    {d.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <article className="min-w-0 max-w-2xl">{children ?? <ContentSkeleton />}</article>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div aria-hidden>
      <div className="h-9 w-56 rounded-lg bg-line" />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full rounded bg-line/60" />
        <div className="h-4 w-11/12 rounded bg-line/60" />
        <div className="h-4 w-4/5 rounded bg-line/60" />
      </div>
    </div>
  );
}
