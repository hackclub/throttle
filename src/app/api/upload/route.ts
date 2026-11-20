import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { presignUpload, r2Configured } from "@/lib/r2";
import { MB, UPLOAD_RULES, isUploadKind } from "@/lib/upload-rules";
import { saveUpload } from "@/lib/uploads";

// Two ways in:
// - JSON { kind, contentType, size, name? }: we check the file details and,
//   when R2 is set up, hand back a short-lived presigned PUT URL. The browser
//   sends the file straight to R2, so it never hits the ~4.5 MB function body
//   limit. Without R2 we answer { mode: "local" } and the browser falls back to:
// - multipart/form-data with `file` and `kind` (local dev only). The file is
//   written to public/uploads via saveUpload() and we return { url }.
export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) return multipart(request);
  if (type.startsWith("application/json")) return presign(request);
  return fail("Unsupported upload request.");
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function multipart(request: Request): Promise<Response> {
  if (r2Configured()) return fail("Use a presigned upload.");

  const user = await getCurrentUser();
  if (!user) return fail("Sign in to upload files.", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Couldn't read that upload.");
  }

  const kind = form.get("kind");
  const file = form.get("file");
  if (!isUploadKind(kind)) return fail("Unknown upload kind.");
  if (!(file instanceof File)) return fail("No file attached.");

  try {
    const url = await saveUpload(file, kind);
    return NextResponse.json({ url });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Couldn't save that file.");
  }
}

async function presign(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in to upload files.", 401);

  let body: { kind?: unknown; contentType?: unknown; size?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return fail("Couldn't read that upload request.");
  }
  if (typeof body !== "object") return fail("Couldn't read that upload request.");

  const { kind, contentType, size } = body;
  if (!isUploadKind(kind)) return fail("Unknown upload kind.");

  const rule = UPLOAD_RULES[kind];
  if (typeof contentType !== "string" || !Object.hasOwn(rule.types, contentType)) {
    return fail(`${rule.label} must be ${rule.allowed}.`);
  }
  if (typeof size !== "number" || !Number.isInteger(size) || size < 0) {
    return fail("Couldn't read the file size.");
  }
  if (size === 0) return fail("That file is empty.");
  if (size > rule.maxBytes) {
    return fail(`${rule.label} can be up to ${rule.maxBytes / MB} MB.`, 413);
  }

  if (!r2Configured()) return NextResponse.json({ mode: "local" });

  try {
    const { uploadUrl, publicUrl } = await presignUpload({ kind, contentType, size });
    return NextResponse.json({ mode: "r2", uploadUrl, publicUrl });
  } catch (err) {
    console.error("R2 presign failed", err);
    return fail("Couldn't start the upload. Try again in a moment.", 500);
  }
}
