import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NewProjectForm } from "@/components/project/NewProjectForm";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New aircraft · Throttle" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/hangar"
        className="font-mono text-xs text-hc-muted transition-colors hover:text-hc-dark"
      >
        ← Hangar
      </Link>
      <h1 className="mt-3 text-2xl font-bold">New aircraft</h1>
      <p className="mt-1 text-hc-dark/70">
        Set it up here, then start logging design hours.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-[640px]" aria-hidden />}>
          <SignedIn>
            <NewProjectForm />
          </SignedIn>
        </Suspense>
      </div>
    </div>
  );
}

// Sends signed-out visitors to /signin before they fill anything in.
async function SignedIn({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
