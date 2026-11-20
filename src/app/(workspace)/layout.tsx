import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { getCurrentUser, isReviewer } from "@/lib/auth/session";

const navLink =
  "rounded-md px-2 py-1 text-sm text-hc-dark/70 transition-colors hover:text-hc-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-blue/40";

// The frame is static and prerenders into the shell; only the parts that read
// the session cookie stream in behind <Suspense>. Docs are public, so the
// fallbacks match what a signed-out visitor sees.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="blueprint min-h-screen text-hc-dark">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Suspense fallback={<NavLinks signedIn={false} reviewer={false} />}>
            <MainNav />
          </Suspense>
          <Suspense fallback={<div className="h-8 w-28" aria-hidden />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

async function MainNav() {
  const user = await getCurrentUser();
  return <NavLinks signedIn={user !== null} reviewer={user !== null && isReviewer(user)} />;
}

function NavLinks({ signedIn, reviewer }: { signedIn: boolean; reviewer: boolean }) {
  return (
    <nav className="flex items-center gap-4">
      <Link href={signedIn ? "/hangar" : "/"} className="mr-2 inline-flex items-center gap-2 font-bold tracking-tight">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="" className="size-6 rounded-md" />
        Throttle
      </Link>
      {signedIn && (
        <Link href="/hangar" className={navLink}>
          Hangar
        </Link>
      )}
      <Link href="/docs" className={navLink}>
        Docs
      </Link>
      {reviewer && (
        <Link href="/admin" className={`${navLink} inline-flex items-center gap-1.5`}>
          <span aria-hidden className="size-1.5 rounded-full bg-hc-red" />
          Staff
        </Link>
      )}
    </nav>
  );
}

async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Button href="/signin" variant="secondary" size="sm">
        Sign in
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-hc-dark/80 sm:inline">{user.name}</span>
      <form action="/api/auth/signout" method="post">
        <Button type="submit" variant="secondary" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
