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

/**
 * Public base URL. APP_URL wins; on Vercel without it we fall back to the
 * project's production domain rather than sending localhost to Hack Club Auth.
 */
export function appUrl(): string {
  if (process.env.APP_URL) return trimSlash(process.env.APP_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${trimSlash(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  }
  return "http://localhost:3000";
}

/** Which step of the Hack Club sign-in broke. Shown as ?reason= on /signin. */
export type AuthFailure =
  | "config"
  | "discovery"
  | "token"
  | "userinfo"
  | "email_unverified";

export class AuthStepError extends Error {
  constructor(
    readonly step: AuthFailure,
    message: string,
  ) {
    super(message);
  }
}

/** First 300 chars of a failed response, for the server log only. */
async function bodySnippet(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
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
  if (!clientId || !clientSecret) {
    throw new AuthStepError("config", "HCA_CLIENT_ID or HCA_CLIENT_SECRET is not set");
  }
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
    if (!res.ok) throw new AuthStepError("discovery", `OIDC discovery failed: ${res.status}`);
    const parsed = discoverySchema.safeParse(await res.json());
    if (!parsed.success) throw new AuthStepError("discovery", "OIDC discovery document is missing endpoints");
    return parsed.data;
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
  if (!tokenRes.ok) {
    throw new AuthStepError("token", `Token exchange failed: ${tokenRes.status} ${await bodySnippet(tokenRes)}`);
  }
  const token = tokenSchema.safeParse(await tokenRes.json().catch(() => null));
  if (!token.success) throw new AuthStepError("token", "Token response had no access_token");

  const infoRes = await fetch(endpoints.userinfo_endpoint, {
    headers: { authorization: `Bearer ${token.data.access_token}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!infoRes.ok) {
    throw new AuthStepError("userinfo", `Userinfo failed: ${infoRes.status} ${await bodySnippet(infoRes)}`);
  }
  const body: unknown = await infoRes.json().catch(() => null);
  const parsed = claimsSchema.safeParse(body);
  if (!parsed.success) {
    // Log which claims came back (names only, not values) to spot a missing scope.
    const keys = body && typeof body === "object" ? Object.keys(body).join(",") : typeof body;
    throw new AuthStepError("userinfo", `Userinfo missing required claims; got keys: ${keys}`);
  }
  const claims = parsed.data;

  // Accounts are linked by email, so never trust an address the provider
  // says it hasn't verified.
  if (claims.email_verified === false) {
    throw new AuthStepError("email_unverified", "Hack Club Auth reports the email as unverified");
  }

  return {
    email: claims.email,
    name: claims.name,
    hcaId: claims.sub,
    avatarUrl: claims.picture,
    slackId: claims.slack_id,
  };
}
