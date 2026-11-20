import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/auth/hackclub";
import { createSession } from "@/lib/auth/session";
import { upsertUser } from "@/lib/auth/users";

// Local-only shortcut: /api/auth/dev?as=maker|reviewer|admin
const DEV_USERS = {
  maker: { email: "dev-maker@throttle.local", name: "Dev Maker", role: "maker", home: "/hangar" },
  reviewer: { email: "dev-reviewer@throttle.local", name: "Dev Reviewer", role: "reviewer", home: "/admin/reviews" },
  admin: { email: "dev-admin@throttle.local", name: "Dev Admin", role: "admin", home: "/admin" },
} as const;

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const requested = request.nextUrl.searchParams.get("as") ?? "maker";
  const who = requested in DEV_USERS ? DEV_USERS[requested as keyof typeof DEV_USERS] : DEV_USERS.maker;

  const user = await upsertUser({ email: who.email, name: who.name, role: who.role });
  await createSession(user.id);

  return NextResponse.redirect(new URL(who.home, appUrl()));
}
