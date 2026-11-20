import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Submitted · Throttle" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Lives in its own route group so it skips the workspace header: a full-sky
// milestone screen after a submission goes in.
export default function SubmitDonePage({ searchParams }: Props) {
  return (
    <main className="sky flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center text-white">
      <Suspense fallback={<div className="h-40" aria-hidden />}>
        <Done searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function Done({ searchParams }: Props) {
  const params = await searchParams;
  const kind = first(params.kind) === "flight" ? "flight" : "design";
  const projectId = first(params.project);
  // Only ids we'd generate (UUIDs) make it into the link.
  const href =
    projectId && /^[a-zA-Z0-9-]{1,64}$/.test(projectId) ? `/projects/${projectId}` : "/hangar";

  return (
    <>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        {kind === "flight" ? "Maiden flight submitted." : "Design submitted."}
      </h1>
      <p className="mt-4 max-w-md text-lg text-white/90">
        A reviewer will take a look soon. You&apos;ll see their notes on your project page.
      </p>
      <Button href={href} variant="secondary" className="mt-10 border-white">
        Back to your aircraft
      </Button>
    </>
  );
}
