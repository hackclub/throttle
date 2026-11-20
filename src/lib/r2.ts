import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UPLOAD_RULES, type UploadKind } from "@/lib/upload-rules";

// Cloudflare R2 speaks the S3 API. The browser PUTs files straight to the
// bucket with a presigned URL, so they never pass through our functions.

const PRESIGN_SECONDS = 300;

/** True when all five R2_* variables are set. Otherwise uploads go to public/uploads. */
export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL,
  );
}

let client: S3Client | null = null;

export function getR2(): S3Client {
  if (!r2Configured()) throw new Error("R2 isn't configured.");
  client ??= new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    // <endpoint>/<bucket>/<key>, which is what the other Hack Club apps use.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // Without these the SDK signs checksum headers the browser never sends,
    // and R2 rejects the PUT.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

/**
 * A presigned PUT for one file. ContentType and ContentLength are part of the
 * signature, so R2 refuses a different type or size. Callers validate first.
 */
export async function presignUpload({
  kind,
  contentType,
  size,
}: {
  kind: UploadKind;
  contentType: string;
  size: number;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const types = UPLOAD_RULES[kind].types;
  const ext = Object.hasOwn(types, contentType) ? types[contentType] : undefined;
  if (!ext) throw new Error(`Unsupported ${kind} type: ${contentType}`);

  // isUploadUrl relies on this exact shape: <kind>s/<uuid>.<ext>
  const key = `${kind}s/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = await getSignedUrl(
    getR2(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    {
      expiresIn: PRESIGN_SECONDS,
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );

  const base = process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");
  return { uploadUrl, publicUrl: `${base}/${key}` };
}
