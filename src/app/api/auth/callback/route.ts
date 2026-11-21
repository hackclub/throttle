import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { AuthStepError, OAUTH_COOKIE, appUrl, exchangeCode } from "@/lib/auth/hackclub";
import { safeEqual } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { upsertUser } from "@/lib/auth/users";

// Sends people back to /signin with a short reason code, and logs the details
// server-side (Vercel → Logs, search "[auth]").
function fail(reason: string, detail?: unknown) {
  console.error(`[auth] hack club callback failed: ${reason}`, detail ?? "");
  const url = new URL("/signin", appUrl());
  url.searchParams.set("error", "hackclub");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const store = await cookies();
  const saved = store.get(OAUTH_COOKIE)?.value;
  store.delete(OAUTH_COOKIE); // one shot, whatever happens next

  const params = request.nextUrl.searchParams;
  const providerError = params.get("error");
  if (providerError) {
    // e.g. access_denied, invalid_scope. Keep it to a safe slug.
    const slug = providerError.toLowerCase().replace(/[^a-z_]/g, "").slice(0, 40);
    return fail(`provider_${slug || "error"}`, params.get("error_description"));
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("no_code");

  const [savedState, verifier] = saved?.split(".") ?? [];
  // Usually means sign-in started on a different domain than APP_URL, or the
  // 10-minute window ran out.
  if (!savedState || !verifier) return fail("cookie_missing", `host=${request.nextUrl.host} app=${appUrl()}`);
  if (!safeEqual(state, savedState)) return fail("state_mismatch");

  let profile;
  try {
    profile = await exchangeCode(code, verifier);
  } catch (err) {
    return fail(err instanceof AuthStepError ? err.step : "token", err);
  }

  try {
    const user = await upsertUser(profile);
    await createSession(user.id);
  } catch (err) {
    return fail("database", err);
  }

  return NextResponse.redirect(new URL("/hangar", appUrl()));
}
