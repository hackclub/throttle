import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, appUrl, exchangeCode } from "@/lib/auth/hackclub";
import { safeEqual } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { upsertUser } from "@/lib/auth/users";

export async function GET(request: NextRequest) {
  const fail = () =>
    NextResponse.redirect(new URL("/signin?error=hackclub", appUrl()));

  const store = await cookies();
  const saved = store.get(OAUTH_COOKIE)?.value;
  store.delete(OAUTH_COOKIE); // one shot, whatever happens next

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const [savedState, verifier] = saved?.split(".") ?? [];

  if (params.get("error") || !code || !state || !savedState || !verifier) {
    return fail();
  }
  if (!safeEqual(state, savedState)) return fail();

  try {
    const profile = await exchangeCode(code, verifier);
    const user = await upsertUser(profile);
    await createSession(user.id);
  } catch (err) {
    console.error("[auth] hack club callback failed", err);
    return fail();
  }

  return NextResponse.redirect(new URL("/hangar", appUrl()));
}
