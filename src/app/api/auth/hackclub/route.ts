import { cookies } from "next/headers";
import { NextResponse, connection } from "next/server";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE,
  appUrl,
  getDiscovery,
  hackClubCredentials,
  redirectUri,
} from "@/lib/auth/hackclub";
import { randomToken, sha256Base64Url } from "@/lib/auth/crypto";

export async function GET() {
  // Every visit needs a fresh state/PKCE pair; never prerender this.
  await connection();
  let authorizationEndpoint: string;
  let clientId: string;
  try {
    clientId = hackClubCredentials().clientId;
    authorizationEndpoint = (await getDiscovery()).authorization_endpoint;
  } catch (err) {
    console.error("[auth] hack club sign-in unavailable", err);
    return NextResponse.redirect(new URL("/signin?error=hackclub", appUrl()));
  }

  const state = randomToken(16);
  const verifier = randomToken(32);

  (await cookies()).set(OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  });

  const url = new URL(authorizationEndpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri(),
    scope: "openid email profile",
    state,
    code_challenge: sha256Base64Url(verifier),
    code_challenge_method: "S256",
  }).toString();

  return NextResponse.redirect(url);
}
