import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArtSlot } from "@/components/ui/ArtSlot";
import { buttonClass } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in · Throttle" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The panel prerenders into the shell. The session check and the ?error read
// are request-time, so each sits behind its own <Suspense>.
export default function SignInPage({ searchParams }: Props) {
  return (
    <main className="sky relative flex min-h-svh flex-col items-center justify-center px-4 pb-16 pt-28 sm:pt-36">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      {/* Official Hack Club flag banner (hackclub.com/brand) */}
      <a href="https://hackclub.com/" className="absolute left-2.5 top-0 z-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://assets.hackclub.com/flag-orpheus-top.svg" alt="Hack Club" className="w-36 sm:w-56" />
      </a>

      <div className="w-full max-w-sm">
        <ArtSlot name="signin-orpheus.svg" ratio="3/2" />

        <div className="mt-4 rounded-lg border border-line bg-white p-6">
          <h1 className="text-xl font-bold text-hc-dark">Sign in to Throttle</h1>
          <p className="mt-1 text-sm text-hc-muted">Your projects, flight log and reviews live here.</p>

          <Suspense fallback={null}>
            <HackClubError searchParams={searchParams} />
          </Suspense>

          {/* Plain <a>: a route handler, so it must not be prefetched like a page. */}
          <a href="/api/auth/hackclub" className={buttonClass({ className: "mt-5 w-full" })}>
            Continue with Hack Club
          </a>
        </div>
      </div>
    </main>
  );
}

async function RedirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect("/hangar");
  return null;
}

async function HackClubError({ searchParams }: Pick<Props, "searchParams">) {
  const { error, reason } = await searchParams;
  if (error !== "hackclub") return null;
  // Only short slugs from our own callback; anything else is ignored.
  const code = typeof reason === "string" && /^[a-z_]{1,48}$/.test(reason) ? reason : null;
  return (
    <div className="mt-4" role="alert">
      <p className="text-sm text-hc-red">
        {code === "provider_access_denied"
          ? "Sign-in was cancelled. Try again when you're ready."
          : "Hack Club sign-in didn't work. Try again."}
      </p>
      {code && code !== "provider_access_denied" && (
        <p className="mt-1 font-mono text-xs text-hc-muted">reason: {code}</p>
      )}
    </div>
  );
}
