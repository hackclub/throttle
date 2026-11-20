import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MB, UPLOAD_RULES, type UploadKind } from "@/lib/upload-rules";

export type { UploadKind };

/**
 * Local dev only (R2 not configured): writes the file to public/uploads and
 * returns its URL. Throws a user-facing Error if the file is rejected.
 */
export async function saveUpload(file: File, kind: UploadKind): Promise<string> {
  const rule = UPLOAD_RULES[kind];
  const ext = Object.hasOwn(rule.types, file.type) ? rule.types[file.type] : undefined;

  if (!ext) throw new Error(`${rule.label} must be ${rule.allowed}.`);
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > rule.maxBytes) {
    throw new Error(`${rule.label} can be up to ${rule.maxBytes / MB} MB.`);
  }

  const name = `${crypto.randomUUID()}.${ext}`;

  // Next serves anything under public/.
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
