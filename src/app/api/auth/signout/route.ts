import { NextResponse } from "next/server";
import { appUrl } from "@/lib/auth/hackclub";
import { signOut } from "@/lib/auth/session";

export async function POST() {
  await signOut();
  // 303 so the browser follows with a GET rather than re-POSTing to "/".
  return NextResponse.redirect(new URL("/", appUrl()), 303);
}
