import "server-only";
import { z } from "zod";
import type { SignInProfile } from "./users";

// Short-lived cookie holding the OAuth state and PKCE verifier between the
// redirect out and the callback.
export const OAUTH_COOKIE = "throttle_oauth";
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function appUrl(): string {
  return trimSlash(process.env.APP_URL || "http://localhost:3000");
}

export function redirectUri(): string {
  return `${appUrl()}/api/auth/callback`;
}

function issuer(): string {
  return trimSlash(process.env.HCA_ISSUER || "https://auth.hackclub.com");
}

export function hackClubCredentials() {
  const clientId = process.env.HCA_CLIENT_ID;
  const clientSecret = process.env.HCA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Hack Club Auth is not configured");
  return { clientId, clientSecret };
}

const discoverySchema = z.object({
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  userinfo_endpoint: z.url(),
});

type Discovery = z.infer<typeof discoverySchema>;

let discovery: Promise<Discovery> | undefined;

export function getDiscovery(): Promise<Discovery> {
  discovery ??= (async () => {
    const res = await fetch(`${issuer()}/.well-known/openid-configuration`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
    return discoverySchema.parse(await res.json());
  })().catch((err) => {
    // Don't cache a failure; retry on the next sign-in.
    discovery = undefined;
    throw err;
  });
  return discovery;
}

const tokenSchema = z.object({ access_token: z.string().min(1) });

const claimsSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().optional(),
  name: z.string().nullish(),
  picture: z.string().nullish(),
  slack_id: z.string().nullish(),
});

/** Trades an authorization code for the user's profile claims. */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<SignInProfile> {
  const { clientId, clientSecret } = hackClubCredentials();
  const endpoints = await getDiscovery();

  const tokenRes = await fetch(endpoints.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
  const { access_token } = tokenSchema.parse(await tokenRes.json());

  const infoRes = await fetch(endpoints.userinfo_endpoint, {
    headers: { authorization: `Bearer ${access_token}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!infoRes.ok) throw new Error(`Userinfo failed: ${infoRes.status}`);
  const claims = claimsSchema.parse(await infoRes.json());

  // Accounts are linked by email, so never trust an address the provider
  // says it hasn't verified.
  if (claims.email_verified === false) throw new Error("Email not verified");

  return {
    email: claims.email,
    name: claims.name,
    hcaId: claims.sub,
    avatarUrl: claims.picture,
    slackId: claims.slack_id,
  };
}
